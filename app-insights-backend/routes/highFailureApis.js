/**
 * High Failure APIs — ranked by failure count OR latency spike for a given date range
 * Returns APIs with failures OR significant response time anomalies
 * Covers two outage patterns:
 *   1. HTTP failures (success == false) — classic error spike
 *   2. Latency-only outages — API returns 200 but takes 3x+ longer than normal
 */
const express = require("express");
const router = express.Router();
const { queryAppInsights } = require("../services/appInsightsService");
const { buildTimeFilter, fmtSASTTime } = require("./dateHelper");

router.get("/", async (req, res) => {
  try {
    const timeFilter = buildTimeFilter(req);
    const { range, startDate, endDate, compareStart, compareEnd } = req.query;

    // ── Comparison time filter ────────────────────────────────────────────────
    // Priority: explicit compareStart/compareEnd > auto day-1
    let compareTimeFilter;
    let compareLabel;

    if (compareStart && compareEnd) {
      // User picked a custom comparison period
      compareTimeFilter = `timestamp between (datetime("${compareStart}") .. datetime("${compareEnd}"))`;
      compareLabel = "custom";
    } else if (startDate && endDate) {
      // Auto day-1: shift the current window back 24h
      const cmpStart = new Date(new Date(startDate).getTime() - 86400000);
      const cmpEnd   = new Date(new Date(endDate).getTime()   - 86400000);
      compareTimeFilter = `timestamp between (datetime("${cmpStart.toISOString()}") .. datetime("${cmpEnd.toISOString()}"))`;
      compareLabel = "day-1";
    } else {
      const r = range || "24h";
      const hours = r.endsWith("h") ? parseInt(r) : r.endsWith("m") ? parseInt(r) / 60 : 24;
      const now = new Date();
      const cmpEnd   = new Date(now.getTime() - 86400000);
      const cmpStart = new Date(cmpEnd.getTime() - hours * 3600000);
      compareTimeFilter = `timestamp between (datetime("${cmpStart.toISOString()}") .. datetime("${cmpEnd.toISOString()}"))`;
      compareLabel = "day-1";
    }

    // ── Current period: failures + latency ────────────────────────────────────
    // NOTE: make_bag removed — not supported in all App Insights versions
    // Result code breakdown is fetched separately via /detail endpoint on click
    const currentQuery = `
requests
| where ${timeFilter}
| summarize
    total_requests = count(),
    failure_count  = countif(success == false),
    avg_rt         = avg(duration),
    result_codes   = make_set(resultCode, 10),
    last_seen      = max(timestamp),
    first_seen     = min(timestamp)
  by operation_Name
| where failure_count > 0 or avg_rt > 2000
| extend error_rate = round(failure_count * 100.0 / total_requests, 2)
| order by failure_count desc
`;

    // ── Comparison period query ───────────────────────────────────────────────
    const day1Query = `
requests
| where ${compareTimeFilter}
| summarize
    day1_total    = count(),
    day1_failures = countif(success == false),
    day1_avg_rt   = avg(duration)
  by operation_Name
| where day1_total > 0
| extend day1_error_rate = round(day1_failures * 100.0 / day1_total, 2)
`;

    const [currentRows, day1Rows] = await Promise.all([
      queryAppInsights(currentQuery),
      queryAppInsights(day1Query),
    ]);

    // Build day-1 lookup map — keyed by operation_Name
    const day1Map = new Map();
    for (const row of day1Rows) {
      const [op, total, failures, avgRt, errorRate] = row;
      day1Map.set(op, {
        total:     Number(total)     || 0,
        failures:  Number(failures)  || 0,
        avgRt:     Math.round(Number(avgRt) || 0),
        errorRate: parseFloat(Number(errorRate).toFixed(2)) || 0,
      });
    }

    const data = currentRows.map(row => {
      const [operation_Name, total_requests, failure_count, avg_rt, result_codes, last_seen, first_seen, error_rate] = row;

      const totalReq  = Number(total_requests) || 0;
      const failCount = Number(failure_count)  || 0;
      const errRate   = Number(error_rate)      || 0;
      const avgRtMs   = Math.round(Number(avg_rt) || 0);

      const day1 = day1Map.get(operation_Name) || { total: 0, failures: 0, avgRt: 0, errorRate: 0 };
      const hasDay1Data = day1.total > 0;

      // ── Percentage-based comparison ────────────────────────────────────────
      // Only compute deltas when day-1 has actual traffic
      // If day-1 total = 0 → API is new or had no traffic → show N/A, not 999%
      const errRateDelta    = hasDay1Data ? parseFloat((errRate - day1.errorRate).toFixed(2)) : null;
      const errRateDeltaPct = hasDay1Data && day1.errorRate > 0
        ? parseFloat(((errRateDelta / day1.errorRate) * 100).toFixed(1))
        : null;

      const rtDelta    = hasDay1Data && day1.avgRt > 0 ? avgRtMs - day1.avgRt : null;
      const rtDeltaPct = hasDay1Data && day1.avgRt > 0
        ? parseFloat(((rtDelta / day1.avgRt) * 100).toFixed(1))
        : null;

      return {
        operation_Name,
        total_requests: totalReq,
        failure_count:  failCount,
        error_rate:     parseFloat(errRate.toFixed(2)),
        avg_rt:         avgRtMs,
        result_codes:   Array.isArray(result_codes) ? result_codes.filter(Boolean).join(", ") : (result_codes || ""),
        last_seen:      last_seen  ? new Date(last_seen).toISOString()  : null,
        first_seen:     first_seen ? new Date(first_seen).toISOString() : null,
        // Day-1 — null when no data (API is new or had zero traffic yesterday)
        day1_error_rate:    hasDay1Data ? day1.errorRate : null,
        day1_avg_rt:        hasDay1Data && day1.avgRt > 0 ? day1.avgRt : null,
        day1_failures:      hasDay1Data ? day1.failures : null,
        // Deltas — null when no day-1 data
        err_rate_delta:     errRateDelta,
        err_rate_delta_pct: errRateDeltaPct,
        rt_delta:           rtDelta,
        rt_delta_pct:       rtDeltaPct,
      };
    });

    res.json({ total: data.length, data, compareLabel, generatedAt: new Date().toISOString() });
  } catch (err) {
    console.error("[High Failure APIs] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Detail endpoint: called when user clicks a row ────────────────────────────
// Returns result-code breakdown, hourly trend, and day-1 comparison for one API
router.get("/detail", async (req, res) => {
  const { api, range, startDate, endDate, compareStart, compareEnd } = req.query;
  if (!api) return res.status(400).json({ error: "?api= required" });

  const safeApi = api.replace(/"/g, "");
  const timeFilter = buildTimeFilter(req);

  // Comparison filter — same logic as main route
  let day1TimeFilter;
  if (compareStart && compareEnd) {
    day1TimeFilter = `timestamp between (datetime("${compareStart}") .. datetime("${compareEnd}"))`;
  } else if (startDate && endDate) {
    const cmpStart = new Date(new Date(startDate).getTime() - 86400000);
    const cmpEnd   = new Date(new Date(endDate).getTime()   - 86400000);
    day1TimeFilter = `timestamp between (datetime("${cmpStart.toISOString()}") .. datetime("${cmpEnd.toISOString()}"))`;
  } else {
    const r = range || "24h";
    const hours = r.endsWith("h") ? parseInt(r) : r.endsWith("m") ? parseInt(r) / 60 : 24;
    const now = new Date();
    const cmpEnd   = new Date(now.getTime() - 86400000);
    const cmpStart = new Date(cmpEnd.getTime() - hours * 3600000);
    day1TimeFilter = `timestamp between (datetime("${cmpStart.toISOString()}") .. datetime("${cmpEnd.toISOString()}"))`;
  }

  try {
    // 1. Result code breakdown (current period)
    const codeQuery = `
requests
| where ${timeFilter}
| where operation_Name == "${safeApi}"
| where success == false
| summarize count_ = count() by resultCode
| order by count_ desc
`;

    // 2. Hourly trend (current period)
    const trendQuery = `
requests
| where ${timeFilter}
| where operation_Name == "${safeApi}"
| summarize
    total   = count(),
    errors  = countif(success == false),
    avg_rt  = avg(duration)
  by bin(timestamp, 1h)
| extend error_rate = round(errors * 100.0 / total, 2)
| order by timestamp asc
`;

    // 3. Day-1 result code breakdown
    const day1CodeQuery = `
requests
| where ${day1TimeFilter}
| where operation_Name == "${safeApi}"
| where success == false
| summarize count_ = count() by resultCode
| order by count_ desc
`;

    // 4. Day-1 summary
    const day1SummaryQuery = `
requests
| where ${day1TimeFilter}
| where operation_Name == "${safeApi}"
| summarize
    total    = count(),
    failures = countif(success == false),
    avg_rt   = avg(duration)
| extend error_rate = round(failures * 100.0 / total, 2)
`;

    const [codeRows, trendRows, day1CodeRows, day1SummaryRows] = await Promise.all([
      queryAppInsights(codeQuery),
      queryAppInsights(trendQuery),
      queryAppInsights(day1CodeQuery),
      queryAppInsights(day1SummaryQuery),
    ]);

    const resultCodeBreakdown = codeRows.map(([code, count]) => ({
      code:  String(code || "unknown"),
      count: Number(count) || 0,
    }));

    const day1CodeBreakdown = day1CodeRows.map(([code, count]) => ({
      code:  String(code || "unknown"),
      count: Number(count) || 0,
    }));

    const hourlyTrend = trendRows.map(([ts, total, errors, avgRt, errorRate]) => ({
      time:      fmtSASTTime(ts),
      total:     Number(total)     || 0,
      errors:    Number(errors)    || 0,
      avg_rt:    Math.round(Number(avgRt) || 0),
      error_rate: parseFloat(Number(errorRate).toFixed(2)) || 0,
    }));

    const [d1] = day1SummaryRows;
    const day1Summary = d1 ? {
      total:      Number(d1[0]) || 0,
      failures:   Number(d1[1]) || 0,
      avg_rt:     Math.round(Number(d1[2]) || 0),
      error_rate: parseFloat(Number(d1[3]).toFixed(2)) || 0,
    } : { total: 0, failures: 0, avg_rt: 0, error_rate: 0 };

    res.json({
      api: safeApi,
      resultCodeBreakdown,
      day1CodeBreakdown,
      hourlyTrend,
      day1Summary,
    });
  } catch (err) {
    console.error("[High Failure APIs Detail] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Debug endpoint: check why a specific API is missing ──────────────────────
router.get("/debug", async (req, res) => {
  const { api } = req.query;
  if (!api) return res.status(400).json({ error: "?api=<operation_Name> required" });
  
  try {
    const timeFilter = buildTimeFilter(req);
    const safeApi = api.replace(/"/g, "");

    const query = `
requests
| where ${timeFilter}
| where operation_Name == "${safeApi}"
| summarize
    total_all        = count(),
    failures_all     = countif(success == false),
    avg_rt_all       = avg(duration),
    // Breakdown by client type
    total_browser    = countif(client_Type == "Browser"),
    total_nonbrowser = countif(client_Type != "Browser"),
    total_null       = countif(isnull(client_Type) or isempty(client_Type)),
    // Breakdown by success
    success_count    = countif(success == true),
    failure_count    = countif(success == false),
    // RT percentiles
    p50_rt           = percentile(duration, 50),
    p95_rt           = percentile(duration, 95),
    p99_rt           = percentile(duration, 99),
    max_rt           = max(duration),
    // Result codes
    result_codes     = make_set(resultCode, 10),
    // Time range
    first_seen       = min(timestamp),
    last_seen        = max(timestamp)
`;

    const rows = await queryAppInsights(query);
    if (!rows.length) {
      return res.json({
        found: false,
        message: `API "${safeApi}" not found in the selected time range. Check the operation_Name spelling or expand the time range.`,
      });
    }

    const [r] = rows;
    const [
      total_all, failures_all, avg_rt_all,
      total_browser, total_nonbrowser, total_null,
      success_count, failure_count,
      p50_rt, p95_rt, p99_rt, max_rt,
      result_codes, first_seen, last_seen
    ] = r;

    const errRate = total_all > 0 ? parseFloat(((failures_all / total_all) * 100).toFixed(2)) : 0;

    res.json({
      found: true,
      api: safeApi,
      summary: {
        total_requests: total_all,
        failures:       failures_all,
        successes:      success_count,
        error_rate:     errRate,
        avg_rt:         Math.round(avg_rt_all),
        p50_rt:         Math.round(p50_rt),
        p95_rt:         Math.round(p95_rt),
        p99_rt:         Math.round(p99_rt),
        max_rt:         Math.round(max_rt),
      },
      client_type_breakdown: {
        browser:    total_browser,
        nonbrowser: total_nonbrowser,
        null_empty: total_null,
        note: total_browser > 0
          ? `⚠️ ${total_browser} requests (${((total_browser / total_all) * 100).toFixed(1)}%) are client_Type="Browser" — these were EXCLUDED by the old filter`
          : "✅ No browser requests — client_Type filter didn't affect this API",
      },
      result_codes: Array.isArray(result_codes) ? result_codes : [result_codes],
      time_range: {
        first_seen: first_seen ? new Date(first_seen).toISOString() : null,
        last_seen:  last_seen  ? new Date(last_seen).toISOString()  : null,
      },
      why_missing: {
        had_failures: failures_all > 0,
        had_latency_spike: avg_rt_all > 2000,
        would_appear_now: failures_all > 0 || avg_rt_all > 2000,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

