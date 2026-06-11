/**
 * Performance Panel Route — Azure Application Insights style
 *
 * GET /api/performance-panel/timeline   — avg response time over time
 * GET /api/performance-panel/operations — per-operation avg RT + request counts
 * GET /api/performance-panel/detail     — detail for one operation (RT timeline + dependencies)
 * GET /api/performance-panel/overall    — slowest dependencies + overall stats
 */
const express = require("express");
const router  = express.Router();
const { queryAppInsights } = require("../services/appInsightsService");
const { buildTimeFilter, fmtSASTTime, fmtSASTDateTime } = require("./dateHelper");

// ── Timeline: avg response time bucketed by time ──────────────────────────────
router.get("/timeline", async (req, res) => {
  try {
    const timeFilter = buildTimeFilter(req);
    const { range, startDate, endDate } = req.query;

    // Determine span in hours to pick the right bucket and label format
    let spanHours = 24;
    if (startDate && endDate) {
      spanHours = (new Date(endDate) - new Date(startDate)) / 3600000;
    } else {
      const r = range || "24h";
      if      (r === "10m") spanHours = 10 / 60;
      else if (r === "30m") spanHours = 0.5;
      else if (r === "1h")  spanHours = 1;
      else if (r === "6h")  spanHours = 6;
      else if (r === "12h") spanHours = 12;
      else if (r === "24h") spanHours = 24;
    }

    // Bucket size: keep data points manageable (target ~200-400 points)
    const bucket = spanHours <= (10 / 60) ? "1m"
      : spanHours <= 0.5  ? "2m"
      : spanHours <= 1    ? "5m"
      : spanHours <= 6    ? "15m"
      : spanHours <= 12   ? "30m"
      : spanHours <= 24   ? "1h"
      : spanHours <= 72   ? "3h"
      : spanHours <= 168  ? "6h"   // up to 7 days
      : "12h";                      // > 7 days (30 days = 60 points)

    // Use date+time labels when range spans more than 1 day
    const useDateTime = spanHours > 24;

    const query = `
requests
| where ${timeFilter}
| where client_Type != "Browser"
| summarize
    avg_rt   = avg(duration),
    total    = sum(itemCount),
    slow     = sumif(itemCount, duration > 2000)
  by bin(timestamp, ${bucket})
| order by timestamp asc
`;
    const rows = await queryAppInsights(query);
    const data = rows.map(([ts, avgRt, total, slow]) => ({
      time:      useDateTime ? fmtSASTDateTime(ts) : fmtSASTTime(ts),
      timestamp: new Date(ts).toISOString(),
      avgRt:     Math.round(Number(avgRt) || 0),
      total:     Number(total) || 0,
      slow:      Number(slow)  || 0,
    }));

    const totalReqs  = data.reduce((s, d) => s + d.total, 0);
    const totalSlow  = data.reduce((s, d) => s + d.slow,  0);
    const overallAvg = data.length
      ? Math.round(data.reduce((s, d) => s + d.avgRt, 0) / data.length)
      : 0;

    res.json({ data, totalReqs, totalSlow, overallAvg, bucket });
  } catch (err) {
    console.error("[performance-panel/timeline]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Operations: per-API avg RT + request counts ───────────────────────────────
router.get("/operations", async (req, res) => {
  try {
    const { windowStart, windowEnd } = req.query;
    let timeFilter;

    if (windowStart && windowEnd) {
      timeFilter = `timestamp between (datetime("${windowStart}") .. datetime("${windowEnd}"))`;
    } else {
      timeFilter = buildTimeFilter(req);
    }

    const query = `
requests
| where ${timeFilter}
| where client_Type != "Browser"
| summarize
    total    = sum(itemCount),
    avg_rt   = avg(duration),
    slow     = sumif(itemCount, duration > 2000),
    errors   = sumif(itemCount, success == false)
  by operation_Name
| extend slow_pct = iff(total > 0, slow * 100.0 / total, 0.0)
| extend error_rate = iff(total > 0, errors * 100.0 / total, 0.0)
| order by avg_rt desc
`;
    const rows = await queryAppInsights(query);
    const data = rows.map(([op, total, avgRt, slow, errors, slowPct, errorRate]) => ({
      operation: op,
      total:     Number(total)    || 0,
      avgRt:     Math.round(Number(avgRt) || 0),
      slow:      Number(slow)     || 0,
      errors:    Number(errors)   || 0,
      slowPct:   parseFloat(Number(slowPct).toFixed(1))   || 0,
      errorRate: parseFloat(Number(errorRate).toFixed(2)) || 0,
    }));

    const overall = {
      total:   data.reduce((s, d) => s + d.total, 0),
      avgRt:   data.length ? Math.round(data.reduce((s, d) => s + d.avgRt, 0) / data.length) : 0,
      slow:    data.reduce((s, d) => s + d.slow,  0),
      slowest: data[0]?.operation || null,
    };

    res.json({ data, overall });
  } catch (err) {
    console.error("[performance-panel/operations]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Detail: RT timeline + dependencies for one operation ──────────────────────
router.get("/detail", async (req, res) => {
  const { operation, windowStart, windowEnd } = req.query;
  if (!operation) return res.status(400).json({ error: "operation param required" });

  const safeOp = operation.replace(/"/g, "");
  let timeFilter;
  if (windowStart && windowEnd) {
    timeFilter = `timestamp between (datetime("${windowStart}") .. datetime("${windowEnd}"))`;
  } else {
    timeFilter = buildTimeFilter(req);
  }

  try {
    const [timelineRows, depRows, statusRows, summaryRows] = await Promise.all([
      // Hourly RT timeline for this operation
      queryAppInsights(`
requests
| where ${timeFilter}
| where client_Type != "Browser"
| where operation_Name == "${safeOp}"
| summarize
    avg_rt = avg(duration),
    total  = sum(itemCount),
    slow   = sumif(itemCount, duration > 2000)
  by bin(timestamp, 1h)
| order by timestamp asc
`),
      // Slowest dependencies called by this operation
      queryAppInsights(`
dependencies
| where ${timeFilter}
| where operation_Name == "${safeOp}"
| summarize
    avg_rt = avg(duration),
    total  = count(),
    failed = countif(success == false)
  by name, type
| order by avg_rt desc
| take 10
`),
      // Status code breakdown
      queryAppInsights(`
requests
| where ${timeFilter}
| where client_Type != "Browser"
| where operation_Name == "${safeOp}"
| summarize count = sum(itemCount) by resultCode
| order by count desc
| take 20
`),
      // Overall summary: total, success, failed, avg/min/max RT, p50/p95/p99
      queryAppInsights(`
requests
| where ${timeFilter}
| where client_Type != "Browser"
| where operation_Name == "${safeOp}"
| summarize
    total      = sum(itemCount),
    success    = sumif(itemCount, success == true),
    failed     = sumif(itemCount, success == false),
    avg_rt     = avg(duration),
    min_rt     = min(duration),
    max_rt     = max(duration),
    p50        = percentile(duration, 50),
    p95        = percentile(duration, 95),
    p99        = percentile(duration, 99)
`),
    ]);

    const { startDate, endDate, windowStart, windowEnd } = req.query;

    // Determine if we need date+time labels
    let spanHours = 24;
    if (windowStart && windowEnd) {
      spanHours = (new Date(windowEnd) - new Date(windowStart)) / 3600000;
    } else if (startDate && endDate) {
      spanHours = (new Date(endDate) - new Date(startDate)) / 3600000;
    }
    const useDateTime = spanHours > 24;

    const timeline = timelineRows.map(([ts, avgRt, total, slow]) => ({
      time:      useDateTime ? fmtSASTDateTime(ts) : fmtSASTTime(ts),
      timestamp: new Date(ts).toISOString(),
      avgRt:     Math.round(Number(avgRt) || 0),
      total:     Number(total) || 0,
      slow:      Number(slow)  || 0,
    }));

    const dependencies = depRows.map(([name, type, avgRt, total, failed]) => ({
      name:   String(name  || "unknown"),
      type:   String(type  || "unknown"),
      avgRt:  Math.round(Number(avgRt) || 0),
      total:  Number(total)  || 0,
      failed: Number(failed) || 0,
    }));

    const statusCodes = statusRows.map(([code, count]) => ({
      code:  String(code || "unknown"),
      count: Number(count) || 0,
    }));

    const s = summaryRows[0] || [];
    const summary = {
      total:   Number(s[0]) || 0,
      success: Number(s[1]) || 0,
      failed:  Number(s[2]) || 0,
      avgRt:   Math.round(Number(s[3]) || 0),
      minRt:   Math.round(Number(s[4]) || 0),
      maxRt:   Math.round(Number(s[5]) || 0),
      p50:     Math.round(Number(s[6]) || 0),
      p95:     Math.round(Number(s[7]) || 0),
      p99:     Math.round(Number(s[8]) || 0),
    };

    res.json({ timeline, dependencies, statusCodes, summary });
  } catch (err) {
    console.error("[performance-panel/detail]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Overall: slowest dependencies across all operations ───────────────────────
router.get("/overall", async (req, res) => {
  const { windowStart, windowEnd } = req.query;
  let timeFilter;
  if (windowStart && windowEnd) {
    timeFilter = `timestamp between (datetime("${windowStart}") .. datetime("${windowEnd}"))`;
  } else {
    timeFilter = buildTimeFilter(req);
  }

  try {
    const depRows = await queryAppInsights(`
dependencies
| where ${timeFilter}
| summarize
    avg_rt = avg(duration),
    total  = count(),
    failed = countif(success == false)
  by name, type
| order by avg_rt desc
| take 10
`);

    res.json({
      dependencies: depRows.map(([name, type, avgRt, total, failed]) => ({
        name:   String(name  || "?"),
        type:   String(type  || "?"),
        avgRt:  Math.round(Number(avgRt) || 0),
        total:  Number(total)  || 0,
        failed: Number(failed) || 0,
      })),
    });
  } catch (err) {
    console.error("[performance-panel/overall]", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
