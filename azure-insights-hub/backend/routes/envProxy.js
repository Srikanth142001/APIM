/**
 * Environment Proxy Routes
 * Loads environment config from DB and proxies requests to Azure App Insights.
 *
 * GET /api/:envId/overview
 * GET /api/:envId/top-apis
 * GET /api/:envId/failures
 * GET /api/:envId/request-rate
 * GET /api/:envId/performance/timeline
 * GET /api/:envId/performance/operations
 * GET /api/:envId/performance/detail
 * GET /api/:envId/failures-panel/timeline
 * GET /api/:envId/failures-panel/operations
 * GET /api/:envId/api-search
 */
const express = require("express");
const router = express.Router({ mergeParams: true });
const db = require("../db");
const { queryAppInsights } = require("../services/appInsightsService");
const { buildTimeFilter, getBinSize, fmtTime, fmtDateTime } = require("./dateHelper");

// ── Spike Detector ────────────────────────────────────────────────────────────
router.get("/spike-detector", loadEnv, async (req, res) => {
  try {
    const now = new Date();
    const t0 = new Date(now.getTime() - 5 * 60 * 1000);
    const t1 = new Date(now.getTime() - 10 * 60 * 1000);

    const query = `
let current = requests
| where timestamp between (datetime("${t0.toISOString()}") .. datetime("${now.toISOString()}"))
| summarize
    curr_total = count(),
    curr_errors = countif(success == false),
    curr_avg_rt = avg(duration)
| extend period = "current";

let previous = requests
| where timestamp between (datetime("${t1.toISOString()}") .. datetime("${t0.toISOString()}"))
| summarize
    prev_total = count(),
    prev_errors = countif(success == false),
    prev_avg_rt = avg(duration)
| extend period = "previous";

union current, previous
`;

    const rows = await queryAppInsights(query, req.env.app_insights_app_id, req.env.app_insights_api_key);

    let curr = { total: 0, errors: 0, avgRt: 0 };
    let prev = { total: 0, errors: 0, avgRt: 0 };

    for (const row of rows) {
      const [total, errors, avgRt, period] = row;
      if (period === "current") curr = { total, errors, avgRt: Math.round(avgRt || 0) };
      else prev = { total, errors, avgRt: Math.round(avgRt || 0) };
    }

    const errorRateCurr = curr.total > 0 ? (curr.errors / curr.total) * 100 : 0;
    const errorRatePrev = prev.total > 0 ? (prev.errors / prev.total) * 100 : 0;

    const spikes = [];

    if (errorRateCurr > 10 && errorRateCurr > errorRatePrev * 1.5) {
      spikes.push({
        type: "ERROR_SPIKE",
        severity: errorRateCurr > 20 ? "critical" : "warning",
        title: "Error Rate Spike Detected",
        message: `Error rate jumped from ${errorRatePrev.toFixed(1)}% to ${errorRateCurr.toFixed(1)}% in last 5 min`,
        current: errorRateCurr.toFixed(2),
        previous: errorRatePrev.toFixed(2),
        unit: "%",
        change: errorRatePrev > 0 ? +(((errorRateCurr - errorRatePrev) / errorRatePrev) * 100).toFixed(1) : 100,
      });
    }

    if (prev.total > 50 && curr.total < prev.total * 0.5) {
      spikes.push({
        type: "TRAFFIC_DROP",
        severity: "critical",
        title: "Traffic Drop Detected",
        message: `Request volume dropped from ${prev.total} to ${curr.total} (${(((prev.total - curr.total) / prev.total) * 100).toFixed(0)}% drop)`,
        current: curr.total,
        previous: prev.total,
        unit: "req",
        change: -(((prev.total - curr.total) / prev.total) * 100).toFixed(1),
      });
    }

    if (curr.avgRt > 1000 && prev.avgRt > 0 && curr.avgRt > prev.avgRt * 1.5) {
      spikes.push({
        type: "LATENCY_SPIKE",
        severity: curr.avgRt > 3000 ? "critical" : "warning",
        title: "Response Time Spike",
        message: `Avg response time jumped from ${prev.avgRt}ms to ${curr.avgRt}ms`,
        current: curr.avgRt,
        previous: prev.avgRt,
        unit: "ms",
        change: +(((curr.avgRt - prev.avgRt) / prev.avgRt) * 100).toFixed(1),
      });
    }

    res.json({
      current: { ...curr, errorRate: +errorRateCurr.toFixed(2) },
      previous: { ...prev, errorRate: +errorRatePrev.toFixed(2) },
      spikes,
      checkedAt: now.toISOString(),
    });
  } catch (err) {
    console.error("[spike-detector]", err.message);
    res.status(500).json({ error: "Failed to detect spikes" });
  }
});

// ── Error Burst Timeline ──────────────────────────────────────────────────────
router.get("/error-burst-timeline", loadEnv, async (req, res) => {
  try {
    const range = req.query.range || "30m";

    const query = `
requests
| where timestamp > ago(${range})
| summarize
    total = count(),
    errors = countif(success == false),
    avgRt = avg(duration)
  by bin(timestamp, 1m)
| extend errorRate = iff(total > 0, (errors * 100.0 / total), 0.0)
| order by timestamp asc
`;

    const rows = await queryAppInsights(query, req.env.app_insights_app_id, req.env.app_insights_api_key);

    const data = rows.map(([timestamp, total, errors, avgRt, errorRate]) => ({
      time: fmtTime(timestamp),
      timestamp,
      total,
      errors,
      avgRt: Math.round(avgRt || 0),
      errorRate: parseFloat((errorRate || 0).toFixed(2)),
    }));

    const bursts = [];
    let inBurst = false;
    let burstStart = null;

    for (const point of data) {
      if (point.errorRate > 10 && !inBurst) {
        inBurst = true;
        burstStart = point.time;
      } else if (point.errorRate <= 10 && inBurst) {
        inBurst = false;
        bursts.push({ start: burstStart, end: point.time });
      }
    }
    if (inBurst) bursts.push({ start: burstStart, end: "ongoing" });

    res.json({ timeline: data, bursts });
  } catch (err) {
    console.error("[error-burst-timeline]", err.message);
    res.status(500).json({ error: "Failed to fetch error burst timeline" });
  }
});

// ── Response Percentiles ──────────────────────────────────────────────────────
router.get("/response-percentiles", loadEnv, async (req, res) => {
  const { startDate, endDate } = req.query;

  let endTime, startCurrent, startPrevious;

  if (startDate && endDate) {
    endTime       = `datetime("${endDate}")`;
    startCurrent  = `datetime("${startDate}")`;
    startPrevious = `datetime("${new Date(new Date(startDate).getTime() - (new Date(endDate) - new Date(startDate))).toISOString()}")`;
  } else {
    endTime       = "now()";
    startCurrent  = "endTime - 30m";
    startPrevious = "endTime - 60m";
  }

  const query = `
let endTime = ${endTime};
let startCurrent = ${startCurrent};
let startPrevious = ${startPrevious};

let current = requests
| where timestamp between (startCurrent .. endTime)
| summarize currentAvg = avg(duration), currentCount = count() by operationName = operation_Name;

let previous = requests
| where timestamp between (startPrevious .. startCurrent)
| summarize pastAvg = avg(duration) by operationName = operation_Name;

current
| join kind=leftouter previous on operationName
| project operationName, currentAvg, pastAvg, currentCount
| order by currentAvg desc
`;

  try {
    const data = await queryAppInsights(query, req.env.app_insights_app_id, req.env.app_insights_api_key);
    const result = data.map(row => {
      const operationName = row[0];
      const currentAvgResponseTime = Math.round(row[1]);
      const previousAvgResponseTime = Math.round(row[2] || 0);
      const currentCount = row[3];
      const diffPercent = previousAvgResponseTime > 0
        ? +(((currentAvgResponseTime - previousAvgResponseTime) / previousAvgResponseTime) * 100).toFixed(2)
        : 0;
      return { operationName, previousAvgResponseTime, currentAvgResponseTime, currentCount, diffPercent };
    });
    res.json(result);
  } catch (err) {
    console.error("[response-percentiles]", err.message);
    res.status(500).json({ error: "Failed to fetch response percentiles" });
  }
});

// ── Top Failing URLs ──────────────────────────────────────────────────────────
router.get("/top-failing-urls", loadEnv, async (req, res) => {
  try {
    const timeFilter = buildTimeFilter(req);

    const query = `
requests
| where ${timeFilter} and success == false
| where client_Type != "Browser"
| summarize
    failureCount = count(),
    resultCodes = make_set(resultCode, 5),
    sample_url = any(url),
    sample_operationId = any(operation_Id),
    lastSeen = max(timestamp),
    firstSeen = min(timestamp)
  by name, operation_Name
| order by failureCount desc
| take 20
| project name, operation_Name, failureCount, resultCodes, sample_url, sample_operationId, lastSeen, firstSeen
`;

    const rows = await queryAppInsights(query, req.env.app_insights_app_id, req.env.app_insights_api_key);

    const data = rows
      .filter(([name]) =>
        !name.endsWith("signout") &&
        !name.endsWith("contactdetails") &&
        !name.includes("deeplink")
      )
      .map(([name, operation_Name, failureCount, resultCodes, sample_url, sample_operationId, lastSeen, firstSeen]) => ({
        name,
        operation_Name: operation_Name || name,
        failure_count: Number(failureCount) || 0,
        failureCount:  Number(failureCount) || 0,
        error_rate:    null, // not available without total — shown as N/A
        avg_rt:        null,
        resultCodes: Array.isArray(resultCodes) ? resultCodes.join(", ") : String(resultCodes || ""),
        sample_url,
        sample_operationId,
        lastSeen:  lastSeen  ? fmtDateTime(lastSeen)  : "-",
        firstSeen: firstSeen ? fmtTime(firstSeen)     : "-",
        duration: firstSeen && lastSeen
          ? Math.round((new Date(lastSeen) - new Date(firstSeen)) / 60000) + "m"
          : "-",
      }));

    res.json(data);
  } catch (err) {
    console.error("[top-failing-urls]", err.message);
    res.status(500).json({ error: "Failed to fetch top failing URLs" });
  }
});

// ── High Failure APIs ─────────────────────────────────────────────────────────
router.get("/high-failure-apis", loadEnv, async (req, res) => {
  try {
    const timeFilter = buildTimeFilter(req);
    const { range, startDate, endDate, compareStart, compareEnd } = req.query;

    let compareTimeFilter;
    let compareLabel;

    if (compareStart && compareEnd) {
      compareTimeFilter = `timestamp between (datetime("${compareStart}") .. datetime("${compareEnd}"))`;
      compareLabel = "custom";
    } else if (startDate && endDate) {
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
      queryAppInsights(currentQuery, req.env.app_insights_app_id, req.env.app_insights_api_key),
      queryAppInsights(day1Query, req.env.app_insights_app_id, req.env.app_insights_api_key),
    ]);

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
        day1_error_rate:    hasDay1Data ? day1.errorRate : null,
        day1_avg_rt:        hasDay1Data && day1.avgRt > 0 ? day1.avgRt : null,
        day1_failures:      hasDay1Data ? day1.failures : null,
        err_rate_delta:     errRateDelta,
        err_rate_delta_pct: errRateDeltaPct,
        rt_delta:           rtDelta,
        rt_delta_pct:       rtDeltaPct,
      };
    });

    res.json({ total: data.length, data, compareLabel, generatedAt: new Date().toISOString() });
  } catch (err) {
    console.error("[high-failure-apis]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── High Failure APIs: Detail ─────────────────────────────────────────────────
router.get("/high-failure-apis/detail", loadEnv, async (req, res) => {
  const { api, range, startDate, endDate, compareStart, compareEnd } = req.query;
  if (!api) return res.status(400).json({ error: "?api= required" });

  const safeApi = api.replace(/"/g, "");
  const timeFilter = buildTimeFilter(req);

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
    const [codeRows, trendRows, day1CodeRows, day1SummaryRows] = await Promise.all([
      queryAppInsights(`
requests
| where ${timeFilter}
| where operation_Name == "${safeApi}"
| where success == false
| summarize count_ = count() by resultCode
| order by count_ desc
`, req.env.app_insights_app_id, req.env.app_insights_api_key),

      queryAppInsights(`
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
`, req.env.app_insights_app_id, req.env.app_insights_api_key),

      queryAppInsights(`
requests
| where ${day1TimeFilter}
| where operation_Name == "${safeApi}"
| where success == false
| summarize count_ = count() by resultCode
| order by count_ desc
`, req.env.app_insights_app_id, req.env.app_insights_api_key),

      queryAppInsights(`
requests
| where ${day1TimeFilter}
| where operation_Name == "${safeApi}"
| summarize
    total    = count(),
    failures = countif(success == false),
    avg_rt   = avg(duration)
| extend error_rate = round(failures * 100.0 / total, 2)
`, req.env.app_insights_app_id, req.env.app_insights_api_key),
    ]);

    const resultCodeBreakdown = codeRows.map(([code, count]) => ({ code: String(code || "unknown"), count: Number(count) || 0 }));
    const day1CodeBreakdown   = day1CodeRows.map(([code, count]) => ({ code: String(code || "unknown"), count: Number(count) || 0 }));
    const hourlyTrend = trendRows.map(([ts, total, errors, avgRt, errorRate]) => ({
      time:       fmtTime(ts),
      total:      Number(total)     || 0,
      errors:     Number(errors)    || 0,
      avg_rt:     Math.round(Number(avgRt) || 0),
      error_rate: parseFloat(Number(errorRate).toFixed(2)) || 0,
    }));

    const [d1] = day1SummaryRows;
    const day1Summary = d1 ? {
      total:      Number(d1[0]) || 0,
      failures:   Number(d1[1]) || 0,
      avg_rt:     Math.round(Number(d1[2]) || 0),
      error_rate: parseFloat(Number(d1[3]).toFixed(2)) || 0,
    } : { total: 0, failures: 0, avg_rt: 0, error_rate: 0 };

    res.json({ api: safeApi, resultCodeBreakdown, day1CodeBreakdown, hourlyTrend, day1Summary });
  } catch (err) {
    console.error("[high-failure-apis/detail]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Failure Codes ─────────────────────────────────────────────────────────────
router.get("/failure-codes", loadEnv, async (req, res) => {
  const range = req.query.range || "1h";
  const query = `
requests
| where timestamp > ago(${range}) and success == false
| summarize count_ = count() by resultCode
| order by count_ desc
`;

  try {
    const rows = await queryAppInsights(query, req.env.app_insights_app_id, req.env.app_insights_api_key);
    const result = rows.map(([code, count]) => ({
      statusCode: code,
      count: Number(count) || 0,
    }));
    res.json(result);
  } catch (err) {
    console.error("[failure-codes]", err.message);
    res.status(500).json({ error: "Failed to fetch failure codes" });
  }
});

// ── Middleware: load environment from DB ──────────────────────────────────────
function loadEnv(req, res, next) {
  const { envId } = req.params;
  const env = db.prepare("SELECT * FROM environments WHERE id = ?").get(envId);
  if (!env) return res.status(404).json({ error: `Environment '${envId}' not found` });
  req.env = env;
  next();
}

// ── Overview ──────────────────────────────────────────────────────────────────
router.get("/overview", loadEnv, async (req, res) => {
  try {
    const timeFilter = buildTimeFilter(req);
    // Simple single-pass query — no joins, no column order issues
    const rows = await queryAppInsights(`
requests
| where ${timeFilter}
| summarize
    totalRequests = count(),
    totalFailures = countif(success == false),
    avgResponseTime = avg(duration)
| extend errorRate = round(totalFailures * 100.0 / totalRequests, 2)
| project totalRequests, totalFailures, avgResponseTime, errorRate
`, req.env.app_insights_app_id, req.env.app_insights_api_key);

    const [data] = rows;
    if (!data) return res.json({ totalRequests: 0, totalFailures: 0, avgResponseTime: 0, errorRate: 0 });

    res.json({
      totalRequests:   Number(data[0]) || 0,
      totalFailures:   Number(data[1]) || 0,
      avgResponseTime: Math.round(Number(data[2]) || 0),
      errorRate:       parseFloat((Number(data[3]) || 0).toFixed(2)),
    });
  } catch (err) {
    console.error("[overview]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Top APIs ──────────────────────────────────────────────────────────────────
router.get("/top-apis", loadEnv, async (req, res) => {
  try {
    const timeFilter = buildTimeFilter(req);
    const rows = await queryAppInsights(`
requests
| where ${timeFilter}
| summarize
    totalCount = count(),
    avgDuration = avg(duration),
    errorCount = countif(success == false)
  by name
| top 10 by totalCount desc
| project name, totalCount, avgDuration, errorCount
`, req.env.app_insights_app_id, req.env.app_insights_api_key);

    // After explicit project, columns are: name, totalCount, avgDuration, errorCount
    const data = rows.map(([name, totalCount, avgDuration, errorCount]) => ({
      name:    String(name || ""),
      count:   Number(totalCount) || 0,
      avg:     parseFloat(((Number(avgDuration) || 0) / 1000).toFixed(2)),
      errors:  Number(errorCount) || 0,
      success: totalCount > 0 ? (((totalCount - errorCount) / totalCount) * 100).toFixed(2) : "0.00",
    }));

    res.json(data);
  } catch (err) {
    console.error("[top-apis]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Failures ──────────────────────────────────────────────────────────────────
router.get("/failures", loadEnv, async (req, res) => {
  try {
    const timeFilter = buildTimeFilter(req);
    const rows = await queryAppInsights(`
requests
| where ${timeFilter} and success == false
| summarize failureCount = count(), status = tostring(take_any(resultCode)) by name
| top 10 by failureCount desc
| project name, failureCount, status
`, req.env.app_insights_app_id, req.env.app_insights_api_key);

    const data = rows.map(([name, failureCount, status]) => ({
      name:         String(name || ""),
      failureCount: Number(failureCount) || 0,
      status:       String(status || ""),
    }));
    res.json(data);
  } catch (err) {
    console.error("[failures]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Request Rate ──────────────────────────────────────────────────────────────
router.get("/request-rate", loadEnv, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const bin = getBinSize(req);

    let selectedStart, selectedEnd, compareStart, compareEnd;

    if (startDate && endDate) {
      selectedStart = new Date(startDate);
      selectedEnd = new Date(endDate);
      const durationMs = selectedEnd - selectedStart;
      compareStart = new Date(selectedStart.getTime() - durationMs);
      compareEnd = new Date(selectedStart);
    } else {
      const now = new Date();
      selectedEnd = now;
      selectedStart = new Date(now);
      selectedStart.setHours(0, 0, 0, 0);
      const elapsed = now - selectedStart;
      compareStart = new Date(selectedStart.getTime() - 24 * 60 * 60 * 1000);
      compareEnd = new Date(compareStart.getTime() + elapsed);
    }

    const kqlQuery = `
let selectedData = requests
  | where timestamp between (datetime("${selectedStart.toISOString()}") .. datetime("${selectedEnd.toISOString()}"))
  | summarize count = count() by timestamp=bin(timestamp, ${bin})
  | extend period = "Selected";

let compareData = requests
  | where timestamp between (datetime("${compareStart.toISOString()}") .. datetime("${compareEnd.toISOString()}"))
  | summarize count = count() by timestamp=bin(timestamp, ${bin})
  | extend period = "Previous";

union selectedData, compareData
| order by timestamp asc, period
`;

    const rows = await queryAppInsights(kqlQuery, req.env.app_insights_app_id, req.env.app_insights_api_key);

    const today = [];
    const yesterday = [];

    for (const [timestamp, count, period] of rows) {
      const formatted = { time: fmtTime(timestamp), count };
      if (period === "Selected") today.push(formatted);
      else yesterday.push(formatted);
    }

    res.json({ today, yesterday });
  } catch (err) {
    console.error("[request-rate]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Response Time Compare (Today vs Yesterday) ────────────────────────────────
router.get("/response-compare", loadEnv, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const bin = getBinSize(req);

    let selectedStart, selectedEnd, compareStart, compareEnd;

    if (startDate && endDate) {
      selectedStart = new Date(startDate);
      selectedEnd   = new Date(endDate);
      const durationMs = selectedEnd - selectedStart;
      compareStart = new Date(selectedStart.getTime() - durationMs);
      compareEnd   = new Date(selectedStart);
    } else {
      const now = new Date();
      selectedEnd   = now;
      selectedStart = new Date(now); selectedStart.setHours(0, 0, 0, 0);
      const elapsed = now - selectedStart;
      compareStart  = new Date(selectedStart.getTime() - 24 * 60 * 60 * 1000);
      compareEnd    = new Date(compareStart.getTime() + elapsed);
    }

    const kql = `
let todayData = requests
  | where timestamp between (datetime("${selectedStart.toISOString()}") .. datetime("${selectedEnd.toISOString()}"))
  | where client_Type != "Browser"
  | summarize value = avg(duration) by timestamp = bin(timestamp, ${bin})
  | extend period = "Today";

let yesterdayData = requests
  | where timestamp between (datetime("${compareStart.toISOString()}") .. datetime("${compareEnd.toISOString()}"))
  | where client_Type != "Browser"
  | summarize value = avg(duration) by timestamp = bin(timestamp, ${bin})
  | extend period = "Yesterday";

union todayData, yesterdayData
| order by timestamp asc, period
`;

    const rows = await queryAppInsights(kql, req.env.app_insights_app_id, req.env.app_insights_api_key);

    const result = rows.map(([ts, value, period]) => ({
      time:   fmtTime(ts),
      value:  Math.round(Number(value) || 0),
      period: String(period),
    }));

    res.json(result);
  } catch (err) {
    console.error("[response-compare]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Performance: Timeline ─────────────────────────────────────────────────────
router.get("/performance/timeline", loadEnv, async (req, res) => {
  try {
    const timeFilter = buildTimeFilter(req);
    const { range, startDate, endDate } = req.query;

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

    const bucket = spanHours <= (10 / 60) ? "1m"
      : spanHours <= 0.5  ? "2m"
      : spanHours <= 1    ? "5m"
      : spanHours <= 6    ? "15m"
      : spanHours <= 12   ? "30m"
      : spanHours <= 24   ? "1h"
      : spanHours <= 72   ? "3h"
      : spanHours <= 168  ? "6h"
      : "12h";

    const useDateTime = spanHours > 24;

    const query = `
requests
| where ${timeFilter}
| where client_Type != "Browser"
| summarize
    avg_rt   = avg(duration),
    total    = count(),
    slow     = countif(duration > 2000)
  by bin(timestamp, ${bucket})
| order by timestamp asc
`;
    const rows = await queryAppInsights(query, req.env.app_insights_app_id, req.env.app_insights_api_key);
    const data = rows.map(([ts, avgRt, total, slow]) => ({
      time:      useDateTime ? fmtDateTime(ts) : fmtTime(ts),
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
    console.error("[performance/timeline]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Performance: Operations ───────────────────────────────────────────────────
router.get("/performance/operations", loadEnv, async (req, res) => {
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
    total    = count(),
    avg_rt   = avg(duration),
    slow     = countif(duration > 2000),
    errors   = countif(success == false)
  by operation_Name
| extend slow_pct   = iff(total > 0, slow   * 100.0 / total, 0.0)
| extend error_rate = iff(total > 0, errors * 100.0 / total, 0.0)
| project operation_Name, total, avg_rt, slow, errors, slow_pct, error_rate
| order by avg_rt desc
`;
    const rows = await queryAppInsights(query, req.env.app_insights_app_id, req.env.app_insights_api_key);
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
    console.error("[performance/operations]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Performance: Detail ───────────────────────────────────────────────────────
router.get("/performance/detail", loadEnv, async (req, res) => {
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
      queryAppInsights(`
requests
| where ${timeFilter}
| where client_Type != "Browser"
| where operation_Name == "${safeOp}"
| summarize avg_rt = avg(duration), total = count(), slow = countif(duration > 2000)
  by bin(timestamp, 1h)
| order by timestamp asc
`, req.env.app_insights_app_id, req.env.app_insights_api_key),

      queryAppInsights(`
dependencies
| where ${timeFilter}
| where operation_Name == "${safeOp}"
| summarize avg_rt = avg(duration), total = count(), failed = countif(success == false)
  by name, type
| order by avg_rt desc
| take 10
`, req.env.app_insights_app_id, req.env.app_insights_api_key),

      queryAppInsights(`
requests
| where ${timeFilter}
| where client_Type != "Browser"
| where operation_Name == "${safeOp}"
| summarize count = count() by resultCode
| order by count desc
| take 20
`, req.env.app_insights_app_id, req.env.app_insights_api_key),

      queryAppInsights(`
requests
| where ${timeFilter}
| where client_Type != "Browser"
| where operation_Name == "${safeOp}"
| summarize
    total = count(), success = countif(success == true), failed = countif(success == false),
    avg_rt = avg(duration), min_rt = min(duration), max_rt = max(duration),
    p50 = percentile(duration, 50), p95 = percentile(duration, 95), p99 = percentile(duration, 99)
`, req.env.app_insights_app_id, req.env.app_insights_api_key),
    ]);

    const { startDate, endDate } = req.query;
    let spanHours = 24;
    if (windowStart && windowEnd) spanHours = (new Date(windowEnd) - new Date(windowStart)) / 3600000;
    else if (startDate && endDate) spanHours = (new Date(endDate) - new Date(startDate)) / 3600000;
    const useDateTime = spanHours > 24;

    const timeline = timelineRows.map(([ts, avgRt, total, slow]) => ({
      time:      useDateTime ? fmtDateTime(ts) : fmtTime(ts),
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
    console.error("[performance/detail]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Failures Panel: Timeline ──────────────────────────────────────────────────
router.get("/failures-panel/timeline", loadEnv, async (req, res) => {
  try {
    const timeFilter = buildTimeFilter(req);
    const range = req.query.range || "24h";

    const bucket = range === "10m" ? "1m"
      : range === "30m" ? "2m"
      : range === "1h"  ? "5m"
      : range === "6h"  ? "15m"
      : range === "12h" ? "30m"
      : "1h";

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
    const rows = await queryAppInsights(query, req.env.app_insights_app_id, req.env.app_insights_api_key);
    const data = rows.map(([ts, failed, total, avgRt, errorRate]) => ({
      time:      fmtTime(ts),
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

// ── Failures Panel: Operations ────────────────────────────────────────────────
router.get("/failures-panel/operations", loadEnv, async (req, res) => {
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
| project operation_Name, failed, total, avg_rt, p95_rt, codes, error_rate
| order by failed desc
| take 200
`;
    const rows = await queryAppInsights(query, req.env.app_insights_app_id, req.env.app_insights_api_key);
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

// ── Performance: Overall (slowest dependencies) ───────────────────────────────
router.get("/performance/overall", loadEnv, async (req, res) => {
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
| summarize avg_rt = avg(duration), total = count(), failed = countif(success == false)
  by name, type
| order by avg_rt desc
| take 10
`, req.env.app_insights_app_id, req.env.app_insights_api_key);

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
    console.error("[performance/overall]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Failures Panel: Overall ───────────────────────────────────────────────────
router.get("/failures-panel/overall", loadEnv, async (req, res) => {
  const { windowStart, windowEnd } = req.query;
  let timeFilter;
  if (windowStart && windowEnd) {
    timeFilter = `timestamp between (datetime("${windowStart}") .. datetime("${windowEnd}"))`;
  } else {
    timeFilter = buildTimeFilter(req);
  }
  try {
    const rows = await queryAppInsights(`
requests
| where ${timeFilter}
| where client_Type != "Browser"
| summarize
    failed    = countif(success == false),
    total     = count(),
    avg_rt    = avg(duration)
| extend error_rate = iff(total > 0, failed * 100.0 / total, 0.0)
| project failed, total, avg_rt, error_rate
`, req.env.app_insights_app_id, req.env.app_insights_api_key);

    const [r] = rows;
    res.json({
      failed:    Number(r?.[0]) || 0,
      total:     Number(r?.[1]) || 0,
      avgRt:     Math.round(Number(r?.[2]) || 0),
      errorRate: parseFloat((Number(r?.[3]) || 0).toFixed(2)),
    });
  } catch (err) {
    console.error("[failures-panel/overall]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Failures Panel: Detail ────────────────────────────────────────────────────
router.get("/failures-panel/detail", loadEnv, async (req, res) => {
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
    const { range, startDate, endDate } = req.query;
    let spanHours = 24;
    if (windowStart && windowEnd) spanHours = (new Date(windowEnd) - new Date(windowStart)) / 3600000;
    else if (startDate && endDate) spanHours = (new Date(endDate) - new Date(startDate)) / 3600000;
    const useDateTime = spanHours > 24;

    const [timelineRows, statusRows, summaryRows] = await Promise.all([
      queryAppInsights(`
requests
| where ${timeFilter}
| where client_Type != "Browser"
| where operation_Name == "${safeOp}"
| summarize failed = countif(success == false), total = count(), avg_rt = avg(duration)
  by bin(timestamp, 1h)
| extend error_rate = iff(total > 0, failed * 100.0 / total, 0.0)
| project timestamp, failed, total, avg_rt, error_rate
| order by timestamp asc
`, req.env.app_insights_app_id, req.env.app_insights_api_key),

      queryAppInsights(`
requests
| where ${timeFilter}
| where client_Type != "Browser"
| where operation_Name == "${safeOp}" and success == false
| summarize count = count() by resultCode
| order by count desc
| take 20
`, req.env.app_insights_app_id, req.env.app_insights_api_key),

      queryAppInsights(`
requests
| where ${timeFilter}
| where client_Type != "Browser"
| where operation_Name == "${safeOp}"
| summarize
    total = count(), failed = countif(success == false),
    avg_rt = avg(duration), p95_rt = percentile(duration, 95)
`, req.env.app_insights_app_id, req.env.app_insights_api_key),
    ]);

    const timeline = timelineRows.map(([ts, failed, total, avgRt, errorRate]) => ({
      time:      useDateTime ? fmtDateTime(ts) : fmtTime(ts),
      timestamp: new Date(ts).toISOString(),
      failed:    Number(failed)    || 0,
      total:     Number(total)     || 0,
      avgRt:     Math.round(Number(avgRt) || 0),
      errorRate: parseFloat((Number(errorRate) || 0).toFixed(2)),
    }));

    const statusCodes = statusRows.map(([code, count]) => ({
      code:  String(code || "unknown"),
      count: Number(count) || 0,
    }));

    const s = summaryRows[0] || [];
    const summary = {
      total:     Number(s[0]) || 0,
      failed:    Number(s[1]) || 0,
      avgRt:     Math.round(Number(s[2]) || 0),
      p95Rt:     Math.round(Number(s[3]) || 0),
      errorRate: s[0] > 0 ? parseFloat(((s[1] / s[0]) * 100).toFixed(2)) : 0,
    };

    res.json({ timeline, statusCodes, summary });
  } catch (err) {
    console.error("[failures-panel/detail]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── API Search ────────────────────────────────────────────────────────────────
router.get("/api-search", loadEnv, async (req, res) => {
  const { q } = req.query;
  if (!q || !q.trim()) return res.json({ results: [] });

  const safe = q.trim().replace(/"/g, "").replace(/\\/g, "");

  try {
    const timeFilter = buildTimeFilter(req);

    const metricsQuery = `
requests
| where ${timeFilter}
| where operation_Name contains "${safe}"
| summarize
    total      = count(),
    success    = countif(success == true),
    failed     = countif(success == false),
    avg_rt     = round(avg(duration), 0),
    min_rt     = round(min(duration), 0),
    max_rt     = round(max(duration), 0),
    p95_rt     = round(percentile(duration, 95), 0)
  by operation_Name
| extend error_rate = round(failed * 100.0 / total, 2)
| order by total desc
| take 50
`;

    const codesQuery = `
requests
| where ${timeFilter}
| where operation_Name contains "${safe}"
| summarize count_ = count() by operation_Name, resultCode
| order by operation_Name asc, count_ desc
`;

    const [metricRows, codeRows] = await Promise.all([
      queryAppInsights(metricsQuery, req.env.app_insights_app_id, req.env.app_insights_api_key),
      queryAppInsights(codesQuery, req.env.app_insights_app_id, req.env.app_insights_api_key),
    ]);

    const codeMap = {};
    for (const row of codeRows) {
      const [opName, code, count] = row;
      if (!codeMap[opName]) codeMap[opName] = [];
      codeMap[opName].push({ code: String(code || ""), count: Number(count) || 0 });
    }

    const results = metricRows.map(row => {
      const [operation_Name, total, success, failed, avg_rt, min_rt, max_rt, p95_rt, error_rate] = row;
      return {
        operation_Name: String(operation_Name || ""),
        total:      Number(total)      || 0,
        success:    Number(success)    || 0,
        failed:     Number(failed)     || 0,
        avg_rt:     Math.round(Number(avg_rt)  || 0),
        min_rt:     Math.round(Number(min_rt)  || 0),
        max_rt:     Math.round(Number(max_rt)  || 0),
        p95_rt:     Math.round(Number(p95_rt)  || 0),
        error_rate: parseFloat(Number(error_rate).toFixed(2)) || 0,
        status_codes: codeMap[operation_Name] || [],
      };
    });

    res.json({ results, query: safe, total: results.length });
  } catch (err) {
    console.error("[api-search]", err.message);
    res.status(500).json({ error: err.message, results: [] });
  }
});

module.exports = router;
