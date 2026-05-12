/**
 * Failures Panel Route — Azure Application Insights style
 *
 * GET /api/failures-panel/timeline   — failed request count over time (for brush chart)
 * GET /api/failures-panel/operations — per-operation failure counts (for table)
 * GET /api/failures-panel/detail     — detail for one operation (codes, exceptions, dependencies)
 * GET /api/failures-panel/window     — re-query everything for a specific time window (brush selection)
 */
const express = require("express");
const router  = express.Router();
const { queryAppInsights } = require("../services/appInsightsService");
const { buildTimeFilter, fmtSASTTime, fmtSASTDateTime } = require("./dateHelper");

// ── Timeline: failed + total requests bucketed by time ────────────────────────
router.get("/timeline", async (req, res) => {
  try {
    const timeFilter = buildTimeFilter(req);
    const range = req.query.range || "24h";

    // Choose bucket size based on range
    const bucket = range === "10m" ? "1m"
      : range === "30m" ? "2m"
      : range === "1h"  ? "5m"
      : range === "6h"  ? "15m"
      : range === "12h" ? "30m"
      : "1h"; // 24h default

    const query = `
requests
| where ${timeFilter}
| where client_Type != "Browser"
| summarize
    failed  = countif(success == false),
    total   = count(),
    avg_rt  = avg(duration)
  by bin(timestamp, ${bucket})
| extend error_rate = iff(total > 0, failed * 100.0 / total, 0.0)
| order by timestamp asc
`;
    const rows = await queryAppInsights(query);
    const data = rows.map(([ts, failed, total, avgRt, errorRate]) => ({
      time:      fmtSASTTime(ts),
      timestamp: new Date(ts).toISOString(),
      failed:    Number(failed)   || 0,
      total:     Number(total)    || 0,
      avgRt:     Math.round(Number(avgRt) || 0),
      errorRate: parseFloat(Number(errorRate).toFixed(2)) || 0,
    }));

    const totalFailed = data.reduce((s, d) => s + d.failed, 0);
    const totalReqs   = data.reduce((s, d) => s + d.total,  0);

    res.json({ data, totalFailed, totalReqs, bucket });
  } catch (err) {
    console.error("[failures-panel/timeline]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Operations: per-API failure counts ───────────────────────────────────────
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
    failed  = countif(success == false),
    total   = count(),
    avg_rt  = avg(duration),
    p95_rt  = percentile(duration, 95),
    codes   = make_set(resultCode, 5)
  by operation_Name
| extend error_rate = iff(total > 0, failed * 100.0 / total, 0.0)
| order by failed desc
| take 200
`;
    const rows = await queryAppInsights(query);
    const data = rows.map(([op, failed, total, avgRt, p95Rt, codes, errorRate]) => ({
      operation: op,
      failed:    Number(failed)    || 0,
      total:     Number(total)     || 0,
      avgRt:     Math.round(Number(avgRt) || 0),
      p95Rt:     Math.round(Number(p95Rt) || 0),
      errorRate: parseFloat(Number(errorRate).toFixed(2)) || 0,
      codes:     Array.isArray(codes) ? codes.filter(Boolean).join(", ") : String(codes || ""),
    }));

    const overall = {
      failed:    data.reduce((s, d) => s + d.failed, 0),
      total:     data.reduce((s, d) => s + d.total,  0),
      errorRate: data.length ? parseFloat((data.reduce((s, d) => s + d.errorRate, 0) / data.length).toFixed(2)) : 0,
    };

    res.json({ data, overall });
  } catch (err) {
    console.error("[failures-panel/operations]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Detail: response codes + exceptions + dependencies for one operation ──────
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
    const [codeRows, exRows, depRows, timelineRows] = await Promise.all([
      // Top response codes
      queryAppInsights(`
requests
| where ${timeFilter}
| where client_Type != "Browser"
| where operation_Name == "${safeOp}"
| summarize count_ = count() by resultCode
| order by count_ desc
| take 10
`),
      // Top exception types
      queryAppInsights(`
exceptions
| where ${timeFilter}
| where operation_Name == "${safeOp}"
| summarize count_ = count() by type
| order by count_ desc
| take 5
`),
      // Failed dependencies
      queryAppInsights(`
dependencies
| where ${timeFilter}
| where operation_Name == "${safeOp}"
| where success == false
| summarize count_ = count() by name, type
| order by count_ desc
| take 5
`),
      // Hourly timeline for this operation
      queryAppInsights(`
requests
| where ${timeFilter}
| where client_Type != "Browser"
| where operation_Name == "${safeOp}"
| summarize
    failed = countif(success == false),
    total  = count(),
    avg_rt = avg(duration)
  by bin(timestamp, 1h)
| extend error_rate = iff(total > 0, failed * 100.0 / total, 0.0)
| order by timestamp asc
`),
    ]);

    const responseCodes = codeRows.map(([code, count]) => ({
      code:  String(code || "unknown"),
      count: Number(count) || 0,
    }));

    const exceptions = exRows.map(([type, count]) => ({
      type:  String(type || "unknown").split(".").pop(), // short name
      full:  String(type || "unknown"),
      count: Number(count) || 0,
    }));

    const dependencies = depRows.map(([name, type, count]) => ({
      name:  String(name || "unknown"),
      type:  String(type || "unknown"),
      count: Number(count) || 0,
    }));

    // Use date+time label so multi-day ranges show correctly on x-axis
    const spanDays = timelineRows.length > 0
      ? (new Date(timelineRows[timelineRows.length - 1][0]) - new Date(timelineRows[0][0])) / 86400000
      : 0;
    const timeline = timelineRows.map(([ts, failed, total, avgRt, errorRate]) => {
      const d = new Date(ts);
      const time = spanDays > 1
        ? fmtSASTDateTime(d)
        : fmtSASTTime(d);
      return {
        time,
        timestamp: d.toISOString(),
        failed:    Number(failed)   || 0,
        total:     Number(total)    || 0,
        avgRt:     Math.round(Number(avgRt) || 0),
        errorRate: parseFloat(Number(errorRate).toFixed(2)) || 0,
      };
    });

    res.json({ responseCodes, exceptions, dependencies, timeline });
  } catch (err) {
    console.error("[failures-panel/detail]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Overall stats: top codes + exceptions + dependencies (no operation filter) ─
router.get("/overall", async (req, res) => {
  const { windowStart, windowEnd } = req.query;
  let timeFilter;
  if (windowStart && windowEnd) {
    timeFilter = `timestamp between (datetime("${windowStart}") .. datetime("${windowEnd}"))`;
  } else {
    timeFilter = buildTimeFilter(req);
  }

  try {
    const [codeRows, exRows, depRows] = await Promise.all([
      queryAppInsights(`
requests
| where ${timeFilter}
| where client_Type != "Browser"
| where success == false
| summarize count_ = count() by resultCode
| order by count_ desc
| take 5
`),
      queryAppInsights(`
exceptions
| where ${timeFilter}
| summarize count_ = count() by type
| order by count_ desc
| take 5
`),
      queryAppInsights(`
dependencies
| where ${timeFilter}
| where success == false
| summarize count_ = count() by name
| order by count_ desc
| take 5
`),
    ]);

    res.json({
      responseCodes: codeRows.map(([code, count]) => ({ code: String(code || "?"), count: Number(count) || 0 })),
      exceptions:    exRows.map(([type, count])   => ({ type: String(type || "?").split(".").pop(), full: String(type || "?"), count: Number(count) || 0 })),
      dependencies:  depRows.map(([name, count])  => ({ name: String(name || "?"), count: Number(count) || 0 })),
    });
  } catch (err) {
    console.error("[failures-panel/overall]", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

