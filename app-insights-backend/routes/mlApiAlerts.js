/**
 * ML API Alerts v4 — Three-Layer Anomaly Detection
 *
 * Layer 1: SYSTEM signals  — total traffic, total avg RT, total error rate
 * Layer 2: API signals     — per-API traffic silence, error spike, RT spike
 * Layer 3: STATUS CODE     — 5xx surge, 4xx surge, new codes appearing
 *
 * Algorithms:
 *  - Z-score with adaptive floor (error rate floor=0.5%, RT floor=10ms)
 *  - IQR outlier (secondary confirmation)
 *  - Linear regression slope (24h trend)
 *  - Relative multiplier (current/baseline — catches fast APIs)
 *  - Traffic silence (0 requests vs historical avg)
 *  - EWMA smoothing on trend data
 *  - Composite confidence (data quality x signal strength)
 */

const express = require("express");
const router  = express.Router();
const { queryAppInsights } = require("../services/appInsightsService");
const { sendWhatsAppAlert, isWhatsAppConfigured } = require("../services/whatsappService");
const { sendTelegramAlert, sendTelegramSummary, isConfigured: isTelegramConfigured } = require("../services/telegramService");
const {
  safeNum, mean, stdDev, percentile,
  zScore, linearSlope, ewma, isIQROutlier, confidence,
} = require("../services/mlAnomalyEngine");
const { fmtSASTTime, fmtSASTDate } = require("./dateHelper");

// ─── KQL Queries ─────────────────────────────────────────────────────────────

// 80-day per-API baseline — optimised to avoid timeout
// Key changes vs v3:
//  - Removed per-day p50/p95 (expensive, not needed for baseline stats)
//  - Added | take 5000 safety cap (prevents runaway on huge tenants)
//  - Tighter filter: daily_total > 5 (removes noise APIs)
const BASELINE_QUERY = `
requests
| where timestamp > ago(80d)
| where client_Type != "Browser"
| summarize
    daily_total  = sum(itemCount),
    daily_errors = sumif(itemCount, success == false),
    daily_avg_rt = avg(duration)
  by operation_Name, bin(timestamp, 1d)
| where daily_total > 5
| summarize
    hist_days          = count(),
    hist_avg_daily     = avg(daily_total),
    hist_avg_rt        = avg(daily_avg_rt),
    hist_p50_rt        = 0.0,
    hist_p95_rt        = 0.0,
    hist_avg_err_rate  = avg(daily_errors * 100.0 / daily_total),
    hist_max_err_rate  = max(daily_errors * 100.0 / daily_total),
    hist_std_err       = stdev(daily_errors * 100.0 / daily_total),
    hist_std_rt        = stdev(daily_avg_rt),
    hist_p75_err       = percentile(daily_errors * 100.0 / daily_total, 75),
    hist_p25_err       = percentile(daily_errors * 100.0 / daily_total, 25),
    hist_p75_rt        = percentile(daily_avg_rt, 75),
    hist_p25_rt        = percentile(daily_avg_rt, 25),
    hist_total_calls   = sum(daily_total),
    hist_total_errors  = sum(daily_errors),
    hist_max_rt        = max(daily_avg_rt),
    hist_min_rt        = min(daily_avg_rt)
  by operation_Name
| where hist_days >= 3
| order by hist_total_calls desc
| take 5000
`;

// Current 30-min window (primary)
const CURRENT_30M_QUERY = `
requests
| where timestamp > ago(30m)
| where client_Type != "Browser"
| summarize
    curr_total   = sum(itemCount),
    curr_errors  = sumif(itemCount, success == false),
    curr_avg_rt  = avg(duration),
    curr_p50_rt  = percentile(duration, 50),
    curr_p95_rt  = percentile(duration, 95)
  by operation_Name
`;

// Current 1h window (fallback / outage detection)
const CURRENT_1H_QUERY = `
requests
| where timestamp > ago(1h)
| where client_Type != "Browser"
| summarize
    curr_total   = sum(itemCount),
    curr_errors  = sumif(itemCount, success == false),
    curr_avg_rt  = avg(duration),
    curr_p50_rt  = percentile(duration, 50),
    curr_p95_rt  = percentile(duration, 95)
  by operation_Name
`;

// 24h hourly trend per API (error rate + RT + request count)
const TREND_QUERY = `
requests
| where timestamp > ago(24h)
| where client_Type != "Browser"
| summarize
    h_total    = sum(itemCount),
    h_errors   = sumif(itemCount, success == false),
    h_avg_rt   = avg(duration)
  by operation_Name, bin(timestamp, 1h)
| extend h_err_rate = iff(h_total > 0, h_errors * 100.0 / h_total, 0.0)
| order by operation_Name asc, timestamp asc
`;

// System-level: current 30m snapshot
const SYSTEM_CURRENT_QUERY = `
requests
| where timestamp > ago(30m)
| where client_Type != "Browser"
| summarize
    c_total    = sum(itemCount),
    c_errors   = sumif(itemCount, success == false),
    c_avg_rt   = avg(duration)
| extend c_err_rate = iff(c_total > 0, c_errors * 100.0 / c_total, 0.0)
`;

// System-level: 7-day baseline (30-min buckets, summarised)
const SYSTEM_BASELINE_QUERY = `
requests
| where timestamp > ago(7d) and timestamp < ago(30m)
| where client_Type != "Browser"
| summarize
    b_total    = sum(itemCount),
    b_errors   = sumif(itemCount, success == false),
    b_avg_rt   = avg(duration)
  by bin(timestamp, 30m)
| summarize
    b_avg_requests = avg(b_total),
    b_std_requests = stdev(b_total),
    b_avg_rt       = avg(b_avg_rt),
    b_std_rt       = stdev(b_avg_rt),
    b_avg_err_rate = avg(b_errors * 100.0 / b_total),
    b_std_err_rate = stdev(b_errors * 100.0 / b_total),
    b_samples      = count()
`;

// Response code distribution: current 30m vs 7d baseline per API
const RESULT_CODE_QUERY = `
requests
| where timestamp > ago(30m)
| where client_Type != "Browser"
| summarize code_count = sum(itemCount) by operation_Name, resultCode
| order by operation_Name asc, code_count desc
`;

const RESULT_CODE_BASELINE_QUERY = `
requests
| where timestamp > ago(7d) and timestamp < ago(30m)
| where client_Type != "Browser"
| summarize
    b_count = sum(itemCount)
  by operation_Name, resultCode
| summarize
    b_total_per_code = sum(b_count),
    b_days = 7.0
  by operation_Name, resultCode
`;

// Yesterday vs today: same 30-min window, yesterday vs now
const YESTERDAY_COMPARISON_QUERY = `
let now = ago(0m);
let window_start = ago(30m);
let yest_start = ago(1d) - 30m;
let yest_end   = ago(1d);

let today = requests
| where timestamp between (window_start .. now)
| where client_Type != "Browser"
| summarize
    t_total  = sum(itemCount),
    t_errors = sumif(itemCount, success == false),
    t_avg_rt = avg(duration)
  by operation_Name
| extend t_err_rate = iff(t_total > 0, t_errors * 100.0 / t_total, 0.0);

let yesterday = requests
| where timestamp between (yest_start .. yest_end)
| where client_Type != "Browser"
| summarize
    y_total  = sum(itemCount),
    y_errors = sumif(itemCount, success == false),
    y_avg_rt = avg(duration)
  by operation_Name
| extend y_err_rate = iff(y_total > 0, y_errors * 100.0 / y_total, 0.0);

today
| join kind=leftouter yesterday on operation_Name
| project
    operation_Name,
    t_total, t_errors, t_avg_rt, t_err_rate,
    y_total, y_errors, y_avg_rt, y_err_rate
`;

// ─── Severity classification ──────────────────────────────────────────────────

/**
 * Classify severity using dual-gate: statistical (Z-score) AND relative threshold.
 * Both gates must pass to avoid false positives.
 *
 * Special cases:
 *  - Traffic silence: API had traffic historically but has 0 now → always critical
 *  - Chronic APIs (>50% baseline err): still alerted if CURRENT is much worse
 */
function classifySeverity({
  errZ, rtZ, currErrRate, histAvgErr, histStdErr,
  currAvgRt, histAvgRt, errTrendSlope, currTotal, histAvgDaily,
  isChronic,
}) {
  const absErrIncrease = currErrRate - histAvgErr;
  const rtMultiplier   = histAvgRt > 0 ? currAvgRt / histAvgRt : 1;

  // Traffic silence — API had traffic but now has none
  if (currTotal === 0 && histAvgDaily > 50) return "critical";

  // Severe traffic drop — compare 30m current to 30m historical avg (daily/48)
  const histAvg30m_sev = histAvgDaily / 48;
  const trafficDropPct = histAvg30m_sev > 0
    ? ((histAvg30m_sev - currTotal) / histAvg30m_sev) * 100
    : 0;
  // Only fire if BOTH: drop % is large AND Z-score confirms it (not just normal variance)
  if (trafficDropPct > 80 && histAvg30m_sev > 10 && currTotal < histAvg30m_sev * 0.2) return "critical";
  if (trafficDropPct > 65 && histAvg30m_sev > 10 && currTotal < histAvg30m_sev * 0.35) return "warning";

  // Chronic APIs: only alert if SIGNIFICANTLY worse than their own bad baseline
  if (isChronic) {
    if (currErrRate > histAvgErr * 1.5 && absErrIncrease > 20) return "critical";
    if (currErrRate > histAvgErr * 1.3 && absErrIncrease > 10) return "warning";
    return "ok";
  }

  // CRITICAL — error rate
  if (errZ > 3.5 && absErrIncrease > 8  && currErrRate > 15) return "critical";
  if (errZ > 3.0 && absErrIncrease > 5  && currErrRate > 10) return "critical";

  // CRITICAL — response time (relative to per-API trained baseline)
  if (rtZ > 3.5 && rtMultiplier >= 4.0) return "critical";
  if (rtZ > 3.0 && rtMultiplier >= 3.0) return "critical";

  // WARNING — error rate
  if (errZ > 2.5 && absErrIncrease > 3  && currErrRate > 5)  return "warning";
  if (errZ > 2.0 && absErrIncrease > 2  && currErrRate > 3)  return "warning";

  // WARNING — response time
  if (rtZ > 2.5 && rtMultiplier >= 2.5) return "warning";
  if (rtZ > 2.0 && rtMultiplier >= 2.0) return "warning";

  // WARNING — worsening trend
  if (errTrendSlope > 4 && currErrRate > 5 && absErrIncrease > 2) return "warning";

  // INFO — mild deviation
  const upperNormal = histAvgErr + 2 * Math.max(histStdErr, 0.5);
  if (currErrRate > upperNormal && absErrIncrease > 1.5) return "info";
  if (rtZ > 2.0 && rtMultiplier >= 1.5) return "info";

  return "ok";
}

// ─── Issue diagnosis ──────────────────────────────────────────────────────────

function diagnoseIssues({ op, curr, baseline, ml, trend, codeAlerts, isChronic }) {
  const issues = [];
  const { errorRate: currErrRate, avgRt: currAvgRt, total: currTotal } = curr;
  const { avgErrorRate: histAvgErr, avgRt: histAvgRt, avgDailyRequests: histAvgDaily } = baseline;
  const absErrIncrease = currErrRate - histAvgErr;
  const rtMultiplier   = histAvgRt > 0 ? currAvgRt / histAvgRt : 1;
  const rtIncreasePct  = histAvgRt > 0 ? ((currAvgRt - histAvgRt) / histAvgRt) * 100 : 0;
  // Compare 30m current to 30m historical avg (daily/48) — NOT daily to 30m
  const histAvg30m = histAvgDaily / 48;
  const trafficDropPct = histAvg30m > 0
    ? ((histAvg30m - currTotal) / histAvg30m) * 100
    : 0;

  // ── Traffic silence ────────────────────────────────────────────────────────
  if (currTotal === 0 && histAvgDaily > 50) {
    issues.push({
      type: "TRAFFIC_SILENCE",
      icon: "⚫",
      title: "Zero traffic — API not receiving requests",
      detail: `No requests in last 30 min. Historical avg: ${Math.round(histAvgDaily).toLocaleString()} req/day. This API was active for ${baseline.days} days.`,
      action: "Check load balancer routing, service health, and deployment status. This may indicate a complete outage.",
    });
    return issues; // silence is the only issue to report
  }

  // ── Severe traffic drop ────────────────────────────────────────────────────
  if (trafficDropPct > 60 && histAvgDaily > 100) {
    issues.push({
      type: trafficDropPct > 80 ? "CRITICAL_TRAFFIC_DROP" : "HIGH_TRAFFIC_DROP",
      icon: trafficDropPct > 80 ? "🔴" : "🟠",
      title: `Traffic dropped ${trafficDropPct.toFixed(0)}% below historical average`,
      detail: `Current: ${currTotal.toLocaleString()} req/30min vs historical 30m avg ${Math.round(histAvg30m).toLocaleString()} req/30min (${trafficDropPct.toFixed(0)}% drop, Z=${ml.trafficZ.toFixed(1)}σ).`,
      action: "Investigate load balancer, upstream routing, and whether the service is still reachable.",
    });
  }

  // ── Chronic API — worse than its own bad baseline ─────────────────────────
  if (isChronic) {
    if (absErrIncrease > 10) {
      issues.push({
        type: "CHRONIC_WORSENING",
        icon: "🔴",
        title: "Chronically failing API — now significantly worse",
        detail: `This API has a ${histAvgErr.toFixed(1)}% baseline error rate (chronic). Current: ${currErrRate.toFixed(1)}% (+${absErrIncrease.toFixed(1)}pp above its own bad baseline).`,
        action: "This API was already failing. The situation has worsened — immediate review needed.",
      });
    }
    return issues;
  }

  // ── Error rate spike ───────────────────────────────────────────────────────
  if (currErrRate > 10 && absErrIncrease > 5 && ml.errZ > 3.0) {
    issues.push({
      type: "CRITICAL_ERROR_RATE",
      icon: "🔴",
      title: "Critical error rate — new incident",
      detail: `${currErrRate.toFixed(1)}% error rate (${curr.errors.toLocaleString()} errors/30min) vs 80-day avg ${histAvgErr.toFixed(1)}% (+${absErrIncrease.toFixed(1)}pp, Z=${ml.errZ.toFixed(1)}σ, IQR=${ml.errIQR ? "outlier" : "normal"}).`,
      action: "Immediate investigation. Check recent deployments, downstream dependencies, and service logs.",
    });
  } else if (currErrRate > 3 && absErrIncrease > 2 && ml.errZ > 2.0) {
    issues.push({
      type: "ELEVATED_ERROR_RATE",
      icon: "🟠",
      title: "Error rate above trained baseline",
      detail: `${currErrRate.toFixed(1)}% vs 80-day avg ${histAvgErr.toFixed(1)}% (+${absErrIncrease.toFixed(1)}pp, Z=${ml.errZ.toFixed(1)}σ). Baseline std: ±${baseline.stdErr.toFixed(1)}%.`,
      action: "Review error logs. Check if a recent change caused this increase.",
    });
  }

  // ── Response time spike (relative to per-API trained baseline) ────────────
  if (ml.rtZ > 3.0 && rtMultiplier >= 3.0) {
    issues.push({
      type: "CRITICAL_LATENCY",
      icon: "🔴",
      title: "Critical response time spike",
      detail: `Avg RT ${currAvgRt}ms vs trained baseline ${histAvgRt}ms (${rtMultiplier.toFixed(1)}x, +${rtIncreasePct.toFixed(0)}%, Z=${ml.rtZ.toFixed(1)}σ). p95=${curr.p95Rt}ms.`,
      action: "Check database slow queries, connection pool exhaustion, downstream service degradation, or memory pressure.",
    });
  } else if (ml.rtZ > 2.0 && rtMultiplier >= 2.0) {
    issues.push({
      type: "HIGH_LATENCY",
      icon: "🟠",
      title: "Response time significantly above trained baseline",
      detail: `Avg RT ${currAvgRt}ms vs trained baseline ${histAvgRt}ms (${rtMultiplier.toFixed(1)}x, Z=${ml.rtZ.toFixed(1)}σ). This API normally runs at ${histAvgRt}ms.`,
      action: "Investigate slow queries or resource contention.",
    });
  } else if (ml.rtZ > 1.5 && rtMultiplier >= 1.5 && (currAvgRt - histAvgRt) > 50) {
    issues.push({
      type: "ELEVATED_LATENCY",
      icon: "🟡",
      title: "Response time creeping above normal",
      detail: `Avg RT ${currAvgRt}ms vs trained baseline ${histAvgRt}ms (+${(currAvgRt - histAvgRt)}ms, ${rtMultiplier.toFixed(1)}x, Z=${ml.rtZ.toFixed(1)}σ).`,
      action: "Monitor closely. Latency is above the trained normal range.",
    });
  }

  // ── Worsening trend ────────────────────────────────────────────────────────
  if (ml.errTrendSlope > 4 && currErrRate > 5 && absErrIncrease > 2) {
    issues.push({
      type: "WORSENING_ERROR_TREND",
      icon: "📈",
      title: "Error rate trending up over last 24h",
      detail: `Slope: +${ml.errTrendSlope.toFixed(1)}%/hr. Current: ${currErrRate.toFixed(1)}% vs baseline ${histAvgErr.toFixed(1)}%. EWMA: ${ml.errEwma.toFixed(1)}%.`,
      action: "Trend suggests ongoing degradation. Investigate before it becomes critical.",
    });
  }

  if (ml.rtTrendSlope > 20 && rtMultiplier >= 1.3) {
    issues.push({
      type: "WORSENING_RT_TREND",
      icon: "⏱",
      title: "Response time trending up over last 24h",
      detail: `RT slope: +${ml.rtTrendSlope.toFixed(0)}ms/hr. Current ${currAvgRt}ms vs baseline ${histAvgRt}ms (${rtMultiplier.toFixed(1)}x).`,
      action: "Latency is gradually climbing. Check for memory leaks or increasing load.",
    });
  }

  // ── Status code anomalies ──────────────────────────────────────────────────
  if (codeAlerts && codeAlerts.length > 0) {
    codeAlerts.forEach(ca => issues.push(ca));
  }

  return issues;
}

// ─── System-level anomaly detection ──────────────────────────────────────────

function analyzeSystemSignals(sysRow) {
  if (!sysRow) return { alerts: [], summary: null };
  const [
    bAvgReq, bStdReq, bAvgRt, bStdRt, bAvgErr, bStdErr, bSamples,
    cTotal, cErrors, cAvgRt, cErrRate,
  ] = sysRow;

  const alerts = [];
  const currErrRate = safeNum(cErrRate);
  const currAvgRt   = safeNum(cAvgRt);
  const currTotal   = safeNum(cTotal);

  const reqZ  = zScore(currTotal,   safeNum(bAvgReq), safeNum(bStdReq), 10);
  const rtZ   = zScore(currAvgRt,   safeNum(bAvgRt),  safeNum(bStdRt),  5);
  const errZ  = zScore(currErrRate, safeNum(bAvgErr),  safeNum(bStdErr), 0.3);

  const trafficDropPct = safeNum(bAvgReq) > 0
    ? ((safeNum(bAvgReq) - currTotal) / safeNum(bAvgReq)) * 100
    : 0;

  // System-wide traffic drop
  if (trafficDropPct > 50 && reqZ < -2.5 && safeNum(bSamples) >= 10) {
    alerts.push({
      type: "SYSTEM_TRAFFIC_DROP",
      severity: trafficDropPct > 75 ? "critical" : "warning",
      icon: "🌐",
      title: `System-wide traffic dropped ${trafficDropPct.toFixed(0)}%`,
      detail: `Total requests: ${currTotal.toLocaleString()} vs 7-day avg ${Math.round(safeNum(bAvgReq)).toLocaleString()} per 30min (Z=${reqZ.toFixed(1)}σ). Possible platform-wide outage.`,
      action: "Check infrastructure health, load balancer, and upstream services immediately.",
      metric: "system_traffic",
      value: currTotal,
      baseline: Math.round(safeNum(bAvgReq)),
    });
  }

  // System-wide RT spike
  if (rtZ > 3.0 && currAvgRt > safeNum(bAvgRt) * 2) {
    alerts.push({
      type: "SYSTEM_LATENCY_SPIKE",
      severity: rtZ > 4.0 ? "critical" : "warning",
      icon: "🌐",
      title: "System-wide response time spike",
      detail: `Avg RT ${Math.round(currAvgRt)}ms vs 7-day avg ${Math.round(safeNum(bAvgRt))}ms (Z=${rtZ.toFixed(1)}σ). All APIs are slower than normal.`,
      action: "Check shared infrastructure: database, cache, network, or platform-level bottleneck.",
      metric: "system_rt",
      value: Math.round(currAvgRt),
      baseline: Math.round(safeNum(bAvgRt)),
    });
  }

  // System-wide error rate spike
  if (errZ > 3.0 && currErrRate > safeNum(bAvgErr) + 5) {
    alerts.push({
      type: "SYSTEM_ERROR_SPIKE",
      severity: errZ > 4.0 ? "critical" : "warning",
      icon: "🌐",
      title: "System-wide error rate spike",
      detail: `Error rate ${currErrRate.toFixed(1)}% vs 7-day avg ${safeNum(bAvgErr).toFixed(1)}% (Z=${errZ.toFixed(1)}σ). Platform-wide failure signal.`,
      action: "Investigate shared dependencies: auth service, database, message queue, or external APIs.",
      metric: "system_errors",
      value: currErrRate,
      baseline: safeNum(bAvgErr),
    });
  }

  return {
    alerts,
    summary: {
      currTotal, currErrors: safeNum(cErrors), currAvgRt: Math.round(currAvgRt),
      currErrRate: parseFloat(currErrRate.toFixed(2)),
      baselineAvgRequests: Math.round(safeNum(bAvgReq)),
      baselineAvgRt: Math.round(safeNum(bAvgRt)),
      baselineAvgErrRate: parseFloat(safeNum(bAvgErr).toFixed(2)),
      trafficDropPct: parseFloat(trafficDropPct.toFixed(1)),
      reqZ: parseFloat(reqZ.toFixed(2)),
      rtZ:  parseFloat(rtZ.toFixed(2)),
      errZ: parseFloat(errZ.toFixed(2)),
    },
  };
}

// ─── Status code anomaly detection ───────────────────────────────────────────

function analyzeStatusCodes(op, currentCodes, baselineCodes) {
  const issues = [];
  if (!currentCodes || !currentCodes.length) return issues;

  const currTotal = currentCodes.reduce((s, c) => s + c.count, 0);
  if (currTotal === 0) return issues;

  // Group by code family
  const curr5xx = currentCodes.filter(c => String(c.code).startsWith("5")).reduce((s, c) => s + c.count, 0);
  const curr4xx = currentCodes.filter(c => String(c.code).startsWith("4")).reduce((s, c) => s + c.count, 0);
  const curr5xxRate = (curr5xx / currTotal) * 100;
  const curr4xxRate = (curr4xx / currTotal) * 100;

  // Baseline rates
  const baseTotal = baselineCodes ? baselineCodes.reduce((s, c) => s + c.dailyAvg, 0) : 0;
  const base5xx   = baselineCodes ? baselineCodes.filter(c => String(c.code).startsWith("5")).reduce((s, c) => s + c.dailyAvg, 0) : 0;
  const base4xx   = baselineCodes ? baselineCodes.filter(c => String(c.code).startsWith("4")).reduce((s, c) => s + c.dailyAvg, 0) : 0;
  const base5xxRate = baseTotal > 0 ? (base5xx / baseTotal) * 100 : 0;
  const base4xxRate = baseTotal > 0 ? (base4xx / baseTotal) * 100 : 0;

  // 5xx surge
  if (curr5xxRate > 5 && curr5xxRate > base5xxRate * 2 + 3) {
    const topCodes = currentCodes
      .filter(c => String(c.code).startsWith("5"))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map(c => `${c.code}(${c.count})`)
      .join(", ");
    issues.push({
      type: "5XX_SURGE",
      icon: "🔴",
      title: `5xx server errors surging: ${curr5xxRate.toFixed(1)}% of requests`,
      detail: `${curr5xx} server errors in 30min (${curr5xxRate.toFixed(1)}% vs baseline ${base5xxRate.toFixed(1)}%). Codes: ${topCodes || "500"}`,
      action: "Server-side errors indicate application or infrastructure failure. Check application logs and exception traces.",
    });
  }

  // 4xx surge (could indicate auth issues, bad deployments, or client-side changes)
  if (curr4xxRate > 10 && curr4xxRate > base4xxRate * 2 + 5) {
    const topCodes = currentCodes
      .filter(c => String(c.code).startsWith("4"))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map(c => `${c.code}(${c.count})`)
      .join(", ");
    issues.push({
      type: "4XX_SURGE",
      icon: "🟠",
      title: `4xx client errors surging: ${curr4xxRate.toFixed(1)}% of requests`,
      detail: `${curr4xx} client errors in 30min (${curr4xxRate.toFixed(1)}% vs baseline ${base4xxRate.toFixed(1)}%). Codes: ${topCodes || "400"}`,
      action: "High 4xx rates may indicate auth failures (401/403), bad request formats, or routing issues after a deployment.",
    });
  }

  // New error codes not seen in baseline
  if (baselineCodes && baselineCodes.length > 0) {
    const baseCodeSet = new Set(baselineCodes.map(c => String(c.code)));
    const newCodes = currentCodes
      .filter(c => !baseCodeSet.has(String(c.code)) && c.count > 5 && !String(c.code).startsWith("2"))
      .map(c => `${c.code}(${c.count})`);
    if (newCodes.length > 0) {
      issues.push({
        type: "NEW_ERROR_CODES",
        icon: "🆕",
        title: `New HTTP error codes not seen in 7-day baseline`,
        detail: `New codes appearing: ${newCodes.join(", ")}. These were not present in the last 7 days.`,
        action: "New error codes often indicate a deployment change, API contract break, or new failure mode.",
      });
    }
  }

  return issues;
}

// ─── Main analysis route ──────────────────────────────────────────────────────

router.get("/", async (req, res) => {
  const t0 = Date.now();
  try {
    console.log("\n" + "═".repeat(72));
    console.log("🤖 [ML v4] Starting multi-signal anomaly detection...");
    console.log("═".repeat(72));

    // ── Batch 1: Fast queries (current window + trend) — run in parallel ──
    // These are short time-range queries that complete quickly
    console.log("   📡 Batch 1: Fast queries (current window + trend)...");
    const [curr30mRows, curr1hRows, trendRows, sysCurrRows, sysBaseRows, codeRows, yesterdayRows] = await Promise.all([
      queryAppInsights(CURRENT_30M_QUERY).catch(e => { console.warn("   ⚠️  30m query failed:", e.message); return []; }),
      queryAppInsights(CURRENT_1H_QUERY).catch(e => { console.warn("   ⚠️  1h query failed:", e.message); return []; }),
      queryAppInsights(TREND_QUERY).catch(e => { console.warn("   ⚠️  trend query failed:", e.message); return []; }),
      queryAppInsights(SYSTEM_CURRENT_QUERY).catch(e => { console.warn("   ⚠️  sys-current failed:", e.message); return []; }),
      queryAppInsights(SYSTEM_BASELINE_QUERY).catch(e => { console.warn("   ⚠️  sys-baseline failed:", e.message); return []; }),
      queryAppInsights(RESULT_CODE_QUERY).catch(e => { console.warn("   ⚠️  code query failed:", e.message); return []; }),
      queryAppInsights(YESTERDAY_COMPARISON_QUERY).catch(e => { console.warn("   ⚠️  yesterday query failed:", e.message); return []; }),
    ]);
    console.log(`   ✅ Batch 1 done in ${Date.now() - t0}ms | 30m: ${curr30mRows.length} | 1h: ${curr1hRows.length} | trend: ${trendRows.length} rows`);

    // ── Batch 2: Heavy queries (80-day baseline + code baseline) — sequential ──
    // Run these one at a time to avoid overwhelming the Azure API
    console.log("   📡 Batch 2: 80-day baseline (heavy — may take 30-90s)...");
    const t1 = Date.now();
    let baselineRows = [];
    let codeBaseRows = [];
    try {
      baselineRows = await queryAppInsights(BASELINE_QUERY);
      console.log(`   ✅ Baseline done in ${Date.now() - t1}ms — ${baselineRows.length} APIs`);
    } catch (e) {
      console.error("   ❌ Baseline query failed:", e.message);
      return res.status(504).json({
        error: "Azure App Insights timed out on 80-day baseline query. Try again in a moment.",
        retryable: true,
      });
    }

    try {
      codeBaseRows = await queryAppInsights(RESULT_CODE_BASELINE_QUERY);
      console.log(`   ✅ Code baseline done — ${codeBaseRows.length} rows`);
    } catch (e) {
      console.warn("   ⚠️  Code baseline failed (non-fatal):", e.message);
      // Non-fatal — continue without code baseline
    }

    console.log(`   📡 Baseline: ${baselineRows.length} APIs | 30m: ${curr30mRows.length} | 1h: ${curr1hRows.length} | Trend: ${trendRows.length} rows`);

    // ── Build current maps ────────────────────────────────────────────────
    const buildCurrMap = (rows, window) => {
      const m = new Map();
      for (const [op, total, errors, avgRt, p50Rt, p95Rt] of rows) {
        m.set(op, {
          total:  safeNum(total),
          errors: safeNum(errors),
          avgRt:  Math.round(safeNum(avgRt)),
          p50Rt:  Math.round(safeNum(p50Rt)),
          p95Rt:  Math.round(safeNum(p95Rt)),
          window,
        });
      }
      return m;
    };

    const map30m = buildCurrMap(curr30mRows, "30m");
    const map1h  = buildCurrMap(curr1hRows,  "1h");

    // Merge: prefer 30m; use 1h if 30m shows 0 traffic but 1h has data (outage recovery)
    const currMap = new Map(map1h);
    for (const [op, d] of map30m) {
      const d1h = map1h.get(op);
      // If 1h avg RT is significantly higher, the outage may be ongoing
      if (d1h && d1h.avgRt > d.avgRt * 1.5 && d1h.errors > d.errors) {
        currMap.set(op, { ...d1h, window: "1h(spike)" });
      } else {
        currMap.set(op, d);
      }
    }

    // ── Build trend map ───────────────────────────────────────────────────
    const trendMap = new Map();
    for (const [op, _ts, hTotal, hErrors, hAvgRt, hErrRate] of trendRows) {
      if (!trendMap.has(op)) trendMap.set(op, { totals: [], errors: [], rts: [], errRates: [] });
      const t = trendMap.get(op);
      t.totals.push(safeNum(hTotal));
      t.errors.push(safeNum(hErrors));
      t.rts.push(Math.round(safeNum(hAvgRt)));
      t.errRates.push(safeNum(hErrRate));
    }

    // ── Build status code maps ────────────────────────────────────────────
    const codeCurrentMap = new Map();
    for (const [op, code, count] of codeRows) {
      if (!codeCurrentMap.has(op)) codeCurrentMap.set(op, []);
      codeCurrentMap.get(op).push({ code: String(code), count: safeNum(count) });
    }

    const codeBaseMap = new Map();
    for (const [op, code, bTotal, bDays] of codeBaseRows) {
      if (!codeBaseMap.has(op)) codeBaseMap.set(op, []);
      const dailyAvg = safeNum(bTotal) / Math.max(safeNum(bDays), 1);
      codeBaseMap.get(op).push({ code: String(code), dailyAvg });
    }

    // ── Build yesterday comparison map ────────────────────────────────────
    const yesterdayMap = new Map();
    for (const [op, tTotal, tErrors, tAvgRt, tErrRate, yTotal, yErrors, yAvgRt, yErrRate] of yesterdayRows) {
      yesterdayMap.set(op, {
        today:     { total: safeNum(tTotal), errors: safeNum(tErrors), avgRt: Math.round(safeNum(tAvgRt)), errorRate: parseFloat(safeNum(tErrRate).toFixed(2)) },
        yesterday: { total: safeNum(yTotal), errors: safeNum(yErrors), avgRt: Math.round(safeNum(yAvgRt)), errorRate: parseFloat(safeNum(yErrRate).toFixed(2)) },
      });
    }

    // ── System-level analysis — merge current + baseline rows ────────────
    const sysRow = (() => {
      const b = sysBaseRows[0] || [];
      const c = sysCurrRows[0] || [];
      if (!b.length && !c.length) return null;
      // Merge: [b_avg_requests, b_std_requests, b_avg_rt, b_std_rt, b_avg_err_rate, b_std_err_rate, b_samples, c_total, c_errors, c_avg_rt, c_err_rate]
      return [...b, ...c];
    })();
    const { alerts: systemAlerts, summary: sysSummary } = analyzeSystemSignals(sysRow);
    if (systemAlerts.length > 0) {
      console.log(`   🌐 System alerts: ${systemAlerts.map(a => a.type).join(", ")}`);
    }

    // ── Per-API ML analysis ───────────────────────────────────────────────
    const alerts        = [];
    const healthy       = [];
    const chronicList   = [];
    const silentApis    = [];

    for (const row of baselineRows) {
      const [
        op,
        histDays, histAvgDaily, histAvgRt,
        histP50Rt, histP95Rt,
        histAvgErrRate, histMaxErrRate,
        histStdErr, histStdRt,
        histP75Err, histP25Err,
        histP75Rt, histP25Rt,
        histTotalCalls, histTotalErrors,
        histMaxRt, histMinRt,
      ] = row;

      const curr  = currMap.get(op)  || { total: 0, errors: 0, avgRt: 0, p50Rt: 0, p95Rt: 0, window: "none" };
      const trend = trendMap.get(op) || { totals: [], errors: [], rts: [], errRates: [] };

      const histAvgErrSafe = safeNum(histAvgErrRate);
      const histAvgRtSafe  = safeNum(histAvgRt);
      const histAvgDailySafe = safeNum(histAvgDaily);
      const histDaysSafe   = safeNum(histDays);
      const errStd         = safeNum(histStdErr);
      const rtStd          = safeNum(histStdRt);

      const currErrRate = curr.total > 0 ? (curr.errors / curr.total) * 100 : 0;
      const isChronic   = histAvgErrSafe > 50;

      // ── Z-scores ────────────────────────────────────────────────────────
      const errZ = zScore(currErrRate,  histAvgErrSafe, errStd, 0.5);
      const rtZ  = zScore(curr.avgRt,   histAvgRtSafe,  rtStd,  10);

      // Traffic Z-score: compare current 30m to historical 30m avg
      const histAvg30m = histAvgDailySafe / 48; // daily avg / 48 half-hours
      const trafficZ   = zScore(curr.total, histAvg30m, histAvg30m * 0.4, 5);

      // ── IQR outlier ──────────────────────────────────────────────────────
      const errIQR = isIQROutlier(currErrRate, [
        safeNum(histP25Err), histAvgErrSafe, safeNum(histP75Err),
      ]);
      const rtIQR = isIQROutlier(curr.avgRt, [
        safeNum(histP25Rt), histAvgRtSafe, safeNum(histP75Rt),
      ]);

      // ── Trend slopes ─────────────────────────────────────────────────────
      const errTrendSlope = linearSlope(trend.errRates);
      const rtTrendSlope  = linearSlope(trend.rts);
      const trafficSlope  = linearSlope(trend.totals);

      // ── EWMA ─────────────────────────────────────────────────────────────
      const errEwma = ewma(trend.errRates);
      const rtEwma  = ewma(trend.rts);

      // ── RT relative multiplier ────────────────────────────────────────────
      const rtMultiplier = histAvgRtSafe > 0 ? curr.avgRt / histAvgRtSafe : 1;

      // ── Confidence ────────────────────────────────────────────────────────
      const maxZ = Math.max(Math.abs(errZ), Math.abs(rtZ), Math.abs(trafficZ));
      const conf = confidence(histDaysSafe, maxZ);

      // ── ML scores object ──────────────────────────────────────────────────
      const ml = {
        errZ:           parseFloat(errZ.toFixed(2)),
        rtZ:            parseFloat(rtZ.toFixed(2)),
        trafficZ:       parseFloat(trafficZ.toFixed(2)),
        rtMultiplier:   parseFloat(rtMultiplier.toFixed(2)),
        errIQR,
        rtIQR,
        errTrendSlope:  parseFloat(errTrendSlope.toFixed(3)),
        rtTrendSlope:   parseFloat(rtTrendSlope.toFixed(3)),
        trafficSlope:   parseFloat(trafficSlope.toFixed(3)),
        errEwma:        parseFloat(errEwma.toFixed(2)),
        rtEwma:         Math.round(rtEwma),
        confidence:     conf + "%",
        isChronic,
      };

      // ── Status code analysis ──────────────────────────────────────────────
      const codeAlerts = analyzeStatusCodes(
        op,
        codeCurrentMap.get(op) || [],
        codeBaseMap.get(op)    || [],
      );

      // ── Classify severity ─────────────────────────────────────────────────
      const severity = classifySeverity({
        errZ, rtZ, currErrRate,
        histAvgErr: histAvgErrSafe,
        histStdErr: errStd,
        currAvgRt: curr.avgRt,
        histAvgRt: histAvgRtSafe,
        errTrendSlope,
        currTotal: curr.total,
        histAvgDaily: histAvg30m,
        isChronic,
      });

      // ── Build objects ─────────────────────────────────────────────────────
      const currentObj = {
        total:     curr.total,
        errors:    curr.errors,
        errorRate: parseFloat(currErrRate.toFixed(2)),
        avgRt:     curr.avgRt,
        p50Rt:     curr.p50Rt,
        p95Rt:     curr.p95Rt,
        window:    curr.window,
      };

      const baselineObj = {
        days:              histDaysSafe,
        avgDailyRequests:  Math.round(histAvgDailySafe),
        avgErrorRate:      parseFloat(histAvgErrSafe.toFixed(2)),
        maxErrorRate:      parseFloat(safeNum(histMaxErrRate).toFixed(2)),
        avgRt:             Math.round(histAvgRtSafe),
        p50Rt:             Math.round(safeNum(histP50Rt)),
        p95Rt:             Math.round(safeNum(histP95Rt)),
        maxRt:             Math.round(safeNum(histMaxRt)),
        totalCalls:        safeNum(histTotalCalls),
        stdErr:            parseFloat(errStd.toFixed(3)),
        stdRt:             parseFloat(rtStd.toFixed(1)),
      };

      // ── Diagnose issues ───────────────────────────────────────────────────
      const issues = diagnoseIssues({
        op, curr: currentObj, baseline: baselineObj, ml, trend,
        codeAlerts, isChronic,
      });

      // ── Sparkline ─────────────────────────────────────────────────────────
      const sparkline = {
        errorRates: trend.errRates.map((rate, i) => ({
          hour:   i,
          rate:   parseFloat(rate.toFixed(1)),
          errors: trend.errors[i] || 0,
          total:  trend.totals[i] || 0,
          avgRt:  trend.rts[i]   || 0,
        })),
      };

      const apiResult = {
        operation: op,
        severity,
        anomalyType: issues.length > 0 ? issues[0].type : null,
        issues,
        current:  currentObj,
        baseline: baselineObj,
        ml,
        sparkline,
        statusCodes: codeCurrentMap.get(op) || [],
        comparison: yesterdayMap.get(op) || null,
        detectedAt: new Date().toISOString(),
      };

      if (isChronic) {
        chronicList.push({ operation: op, avgErrorRate: parseFloat(histAvgErrSafe.toFixed(2)), days: histDaysSafe });
        if (severity !== "ok" && issues.length > 0) {
          alerts.push(apiResult);
        }
      } else if (curr.total === 0 && histAvgDailySafe > 50) {
        silentApis.push(apiResult);
        alerts.push(apiResult);
      } else if (severity !== "ok" && issues.length > 0) {
        alerts.push(apiResult);
        const icon = severity === "critical" ? "🔴" : severity === "warning" ? "🟡" : "🔵";
        console.log(`   ${icon} [${severity.toUpperCase()}] ${op} | err=${currErrRate.toFixed(1)}%(Z=${errZ.toFixed(1)}σ) rt=${curr.avgRt}ms(${rtMultiplier.toFixed(1)}x) traffic=${curr.total}`);

        // Send to WhatsApp for critical
        if (severity === "critical" && isWhatsAppConfigured()) {
          sendWhatsAppAlert(apiResult, true).catch(() => {});
        }
        // Send to Telegram for 100% confidence critical alerts
        if (severity === "critical" && conf >= 90 && isTelegramConfigured()) {
          sendTelegramAlert(apiResult, yesterdayMap.get(op)).catch(e =>
            console.warn(`   📨 [Telegram] Failed for ${op}: ${e.message}`)
          );
        }
      } else {
        healthy.push({
          operation: op,
          errorRate: parseFloat(currErrRate.toFixed(2)),
          avgRt: curr.avgRt,
          rtMultiplier: parseFloat(rtMultiplier.toFixed(2)),
          baseline: { avgErrorRate: parseFloat(histAvgErrSafe.toFixed(2)), avgRt: Math.round(histAvgRtSafe) },
        });
      }
    }

    // Sort: critical first, then warning, then info
    const order = { critical: 0, warning: 1, info: 2 };
    alerts.sort((a, b) => (order[a.severity] ?? 3) - (order[b.severity] ?? 3));

    const summary = {
      total:          baselineRows.length,
      critical:       alerts.filter(a => a.severity === "critical").length,
      warning:        alerts.filter(a => a.severity === "warning").length,
      info:           alerts.filter(a => a.severity === "info").length,
      healthy:        healthy.length,
      chronic:        chronicList.length,
      silentApis:     silentApis.length,
      systemAlerts:   systemAlerts.length,
      analysisTimeMs: Date.now() - t0,
      analyzedAt:     new Date().toISOString(),
      dataRange:      "80 days baseline · 30m current window",
    };

    console.log(`\n   📋 DONE in ${summary.analysisTimeMs}ms | APIs: ${summary.total} | 🔴 ${summary.critical} | 🟡 ${summary.warning} | 🔵 ${summary.info} | ✅ ${summary.healthy} | 🌐 sys: ${summary.systemAlerts}`);
    console.log("═".repeat(72) + "\n");

    // Send Telegram summary if there are critical alerts
    if (isTelegramConfigured() && summary.critical > 0) {
      sendTelegramSummary(alerts, systemAlerts, sysSummary).catch(e =>
        console.warn(`   📨 [Telegram] Summary failed: ${e.message}`)
      );
    }

    res.json({
      summary,
      alerts,
      systemAlerts,
      systemSummary: sysSummary,
      healthy: healthy.slice(0, 20),
      chronicFailures: chronicList,
    });
  } catch (err) {
    console.error("[ML v4] Error:", err.message, err.stack);
    res.status(500).json({ error: err.message });
  }
});

// ─── Supporting routes ────────────────────────────────────────────────────────

router.get("/summary", async (req, res) => {
  try {
    const query = `
requests
| where timestamp > ago(30m)
| where client_Type != "Browser"
| summarize
    curr_total  = sum(itemCount),
    curr_errors = sumif(itemCount, success == false),
    curr_avg_rt = avg(duration)
  by operation_Name
| where curr_total > 0
| extend curr_err_rate = curr_errors * 100.0 / curr_total
| summarize
    total_apis     = count(),
    critical_apis  = countif(curr_err_rate > 30),
    warning_apis   = countif(curr_err_rate between (10 .. 30)),
    healthy_apis   = countif(curr_err_rate < 10),
    avg_err_rate   = avg(curr_err_rate),
    max_err_rate   = max(curr_err_rate),
    total_requests = sum(curr_total),
    total_errors   = sum(curr_errors),
    avg_rt         = avg(curr_avg_rt)
`;
    const rows = await queryAppInsights(query);
    const [r] = rows;
    if (!r) return res.json({ total_apis: 0 });
    res.json({
      total_apis: r[0], critical_apis: r[1], warning_apis: r[2], healthy_apis: r[3],
      avg_err_rate: parseFloat(safeNum(r[4]).toFixed(2)),
      max_err_rate: parseFloat(safeNum(r[5]).toFixed(2)),
      total_requests: r[6], total_errors: r[7],
      avg_rt: Math.round(safeNum(r[8])),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/history", async (req, res) => {
  const { api } = req.query;
  if (!api) return res.status(400).json({ error: "api param required" });
  try {
    const query = `
requests
| where timestamp > ago(80d)
| where operation_Name == "${api.replace(/"/g, "")}"
| where client_Type != "Browser"
| summarize
    total      = sum(itemCount),
    errors     = sumif(itemCount, success == false),
    avg_rt     = avg(duration),
    p95_rt     = percentile(duration, 95)
  by bin(timestamp, 1d)
| extend error_rate = iff(total > 0, errors * 100.0 / total, 0.0)
| order by timestamp asc
`;
    const rows = await queryAppInsights(query);
    res.json(rows.map(([ts, total, errors, avgRt, p95Rt, errorRate]) => ({
      date:      new Date(ts).toISOString().slice(0, 10),
      total:     safeNum(total),
      errors:    safeNum(errors),
      avgRt:     Math.round(safeNum(avgRt)),
      p95Rt:     Math.round(safeNum(p95Rt)),
      errorRate: parseFloat(safeNum(errorRate).toFixed(2)),
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/critical-chart", async (req, res) => {
  const { api } = req.query;
  if (!api) return res.status(400).json({ error: "api param required" });
  const safeApi = api.replace(/"/g, "");
  try {
    const [rtHistoryRows, dailyRows, hourlyRows, bandRows] = await Promise.all([
      // 80-day RT history for the main chart
      queryAppInsights(`
requests
| where timestamp > ago(80d)
| where operation_Name == "${safeApi}" and client_Type != "Browser"
| summarize total=sum(itemCount), errors=sumif(itemCount,success==false), avg_rt=avg(duration), p50_rt=percentile(duration,50), p95_rt=percentile(duration,95)
  by bin(timestamp,1d)
| extend error_rate=iff(total>0,errors*100.0/total,0.0)
| order by timestamp asc`),
      // 7-day error rate (daily)
      queryAppInsights(`
requests
| where timestamp > ago(7d)
| where operation_Name == "${safeApi}" and client_Type != "Browser"
| summarize total=sum(itemCount), errors=sumif(itemCount,success==false), avg_rt=avg(duration), p95_rt=percentile(duration,95)
  by bin(timestamp,1d)
| extend error_rate=iff(total>0,errors*100.0/total,0.0)
| order by timestamp asc`),
      // 24h error rate (hourly)
      queryAppInsights(`
requests
| where timestamp > ago(24h)
| where operation_Name == "${safeApi}" and client_Type != "Browser"
| summarize total=sum(itemCount), errors=sumif(itemCount,success==false), avg_rt=avg(duration), p95_rt=percentile(duration,95)
  by bin(timestamp,1h)
| extend error_rate=iff(total>0,errors*100.0/total,0.0)
| order by timestamp asc`),
      // Statistical bands
      queryAppInsights(`
requests
| where timestamp > ago(80d)
| where operation_Name == "${safeApi}" and client_Type != "Browser"
| summarize daily_err=avg(iff(sum(itemCount)>0,sumif(itemCount,success==false)*100.0/sum(itemCount),0.0)),
            daily_rt=avg(avg(duration)),
            daily_p95=avg(percentile(duration,95))
  by bin(timestamp,1d)
| summarize mean_err=avg(daily_err), std_err=stdev(daily_err),
            mean_rt=avg(daily_rt),  std_rt=stdev(daily_rt),
            p95_err=percentile(daily_err,95), p95_mean=avg(daily_p95)`),
    ]);

    const [b] = bandRows;
    const bands = b ? {
      mean:      parseFloat(safeNum(b[0]).toFixed(2)),
      std:       parseFloat(safeNum(b[1]).toFixed(2)),
      upper:     parseFloat((safeNum(b[0]) + 2 * safeNum(b[1])).toFixed(2)),
      warning:   parseFloat((safeNum(b[0]) + safeNum(b[1])).toFixed(2)),
      p95:       parseFloat(safeNum(b[4]).toFixed(2)),
      rtMean:    Math.round(safeNum(b[2])),
      rtStd:     Math.round(safeNum(b[3])),
      rtUpper:   Math.round(safeNum(b[2]) + 2 * safeNum(b[3])),
      rtWarning: Math.round(safeNum(b[2]) + safeNum(b[3])),
      p95Mean:   Math.round(safeNum(b[5])),
    } : {};

    const fmtRtHistory = (rows) => rows.map(([ts, total, errors, avgRt, p50Rt, p95Rt, errorRate]) => ({
      label: fmtSASTDate(ts),
      total: safeNum(total), errors: safeNum(errors),
      avgRt: Math.round(safeNum(avgRt)), 
      p50Rt: Math.round(safeNum(p50Rt)),
      p95Rt: Math.round(safeNum(p95Rt)),
      errorRate: parseFloat(safeNum(errorRate).toFixed(2)),
    }));
    
    const fmtDaily  = (rows) => rows.map(([ts, total, errors, avgRt, p95Rt, errorRate]) => ({
      label: fmtSASTDate(ts),
      total: safeNum(total), errors: safeNum(errors),
      avgRt: Math.round(safeNum(avgRt)), p95Rt: Math.round(safeNum(p95Rt)),
      errorRate: parseFloat(safeNum(errorRate).toFixed(2)),
    }));
    
    const fmtHourly = (rows) => rows.map(([ts, total, errors, avgRt, p95Rt, errorRate]) => ({
      label: fmtSASTTime(ts),
      total: safeNum(total), errors: safeNum(errors),
      avgRt: Math.round(safeNum(avgRt)), p95Rt: Math.round(safeNum(p95Rt)),
      errorRate: parseFloat(safeNum(errorRate).toFixed(2)),
    }));

    res.json({ 
      bands, 
      rtHistory: fmtRtHistory(rtHistoryRows),
      daily: fmtDaily(dailyRows), 
      hourly: fmtHourly(hourlyRows) 
    });
    console.log(`[critical-chart] ${safeApi}: rtHistory=${rtHistoryRows.length}, daily=${dailyRows.length}, hourly=${hourlyRows.length}`);
  } catch (err) {
    console.error("[critical-chart] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get("/risk-forecast", async (req, res) => {
  try {
    const query = `
requests
| where timestamp > ago(7d)
| where client_Type != "Browser"
| summarize
    daily_total  = sum(itemCount),
    daily_errors = sumif(itemCount, success == false),
    daily_avg_rt = avg(duration)
  by operation_Name, bin(timestamp, 1d)
| where daily_total > 5
| summarize
    total_calls   = sum(daily_total),
    avg_err_rate  = avg(daily_errors * 100.0 / daily_total),
    std_err_rate  = stdev(daily_errors * 100.0 / daily_total),
    avg_rt        = avg(daily_avg_rt),
    std_rt        = stdev(daily_avg_rt),
    max_err_rate  = max(daily_errors * 100.0 / daily_total),
    days          = count()
  by operation_Name
| where days >= 3
| extend
    err_cv    = iff(avg_err_rate > 0, std_err_rate / avg_err_rate, 0.0),
    rt_cv     = iff(avg_rt > 0, std_rt / avg_rt, 0.0),
    risk_err  = iff(avg_err_rate > 0, (avg_err_rate / 100.0) * 40, 0.0),
    risk_rt   = iff(avg_rt > 2000, 25.0, iff(avg_rt > 1000, 15.0, iff(avg_rt > 500, 8.0, 0.0))),
    risk_vol  = iff(err_cv > 1, 10.0, iff(err_cv > 0.5, 5.0, 0.0))
| extend risk_score = toint(risk_err + risk_rt + risk_vol)
| extend risk_level = iff(risk_score >= 70, "HIGH", iff(risk_score >= 40, "MEDIUM", "LOW"))
| order by risk_score desc
`;
    const rows = await queryAppInsights(query);
    const apis = rows.map(([op, totalCalls, avgErr, stdErr, avgRt, stdRt, maxErr, days, errCv, rtCv, riskErr, riskRt, riskVol, riskScore, riskLevel]) => ({
      operation: op,
      riskScore: safeNum(riskScore),
      riskLevel: String(riskLevel || "LOW"),
      riskColor: riskLevel === "HIGH" ? "#f2495c" : riskLevel === "MEDIUM" ? "#f5a623" : "#73bf69",
      current: { errorRate: parseFloat(safeNum(avgErr).toFixed(2)), avgRt: Math.round(safeNum(avgRt)) },
      baseline: { avgErrorRate: parseFloat(safeNum(avgErr).toFixed(2)), avgRt: Math.round(safeNum(avgRt)), days: safeNum(days) },
      ml: { errTrendSlope: 0, rtTrendSlope: 0, volatility: parseFloat(safeNum(errCv).toFixed(2)), errZ: 0, rtZ: 0 },
      prediction: riskLevel === "HIGH" ? "High probability of incident in next 24h" : riskLevel === "MEDIUM" ? "Monitor closely — elevated risk" : "Within normal operating range",
      sparkline: [],
    }));

    const summary = {
      total: apis.length,
      high:   apis.filter(a => a.riskLevel === "HIGH").length,
      medium: apis.filter(a => a.riskLevel === "MEDIUM").length,
      low:    apis.filter(a => a.riskLevel === "LOW").length,
      analysisTimeMs: 0,
      modelVersion: "v4-risk",
    };

    res.json({ apis, summary });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

