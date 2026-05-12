/**
 * ML Background Scheduler
 *
 * Runs the full ML anomaly detection pipeline on a fixed interval (default: 10 min).
 * For every CRITICAL alert with confidence >= 90%, sends a rich Telegram message
 * with full root cause explanation.
 *
 * Deduplication: same API is not re-alerted within DEDUP_WINDOW_MS (default: 30 min)
 * to prevent alert storms.
 *
 * Schedule: configurable via ML_SCHEDULE_INTERVAL_MS env var (default: 10 minutes)
 */

const {
  safeNum, mean, stdDev, percentile,
  zScore, linearSlope, ewma, isIQROutlier, confidence,
} = require("./mlAnomalyEngine");
const { queryAppInsights }                          = require("./appInsightsService");
const { sendTelegramAlert, sendTelegramSummary, isConfigured } = require("./telegramService");

// ── Config ────────────────────────────────────────────────────────────────────
const INTERVAL_MS       = parseInt(process.env.ML_SCHEDULE_INTERVAL_MS) || 10 * 60 * 1000; // 10 min
const MIN_CONFIDENCE    = parseInt(process.env.ML_MIN_CONFIDENCE)        || 90;             // only alert >= 90%
const DEDUP_WINDOW_MS   = parseInt(process.env.ML_DEDUP_WINDOW_MS)       || 30 * 60 * 1000; // 30 min

// ── Deduplication store ───────────────────────────────────────────────────────
// key: `${operation}::${severity}` → timestamp last sent
const sentAlerts = new Map();

function isDuplicate(operation, severity) {
  const key  = `${operation}::${severity}`;
  const last = sentAlerts.get(key);
  if (!last) return false;
  return (Date.now() - last) < DEDUP_WINDOW_MS;
}

function markSent(operation, severity) {
  sentAlerts.set(`${operation}::${severity}`, Date.now());
}

// ── KQL Queries (same as mlApiAlerts.js) ─────────────────────────────────────
const BASELINE_QUERY = `
requests
| where timestamp > ago(80d)
| where client_Type != "Browser"
| summarize
    daily_total  = count(),
    daily_errors = countif(success == false),
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

const CURRENT_30M_QUERY = `
requests
| where timestamp > ago(30m)
| where client_Type != "Browser"
| summarize
    curr_total   = count(),
    curr_errors  = countif(success == false),
    curr_avg_rt  = avg(duration),
    curr_p50_rt  = percentile(duration, 50),
    curr_p95_rt  = percentile(duration, 95)
  by operation_Name
`;

const TREND_QUERY = `
requests
| where timestamp > ago(24h)
| where client_Type != "Browser"
| summarize
    h_total    = count(),
    h_errors   = countif(success == false),
    h_avg_rt   = avg(duration)
  by operation_Name, bin(timestamp, 1h)
| extend h_err_rate = iff(h_total > 0, h_errors * 100.0 / h_total, 0.0)
| order by operation_Name asc, timestamp asc
`;

const SYSTEM_CURRENT_QUERY = `
requests
| where timestamp > ago(30m)
| where client_Type != "Browser"
| summarize
    c_total    = count(),
    c_errors   = countif(success == false),
    c_avg_rt   = avg(duration)
| extend c_err_rate = iff(c_total > 0, c_errors * 100.0 / c_total, 0.0)
`;

const SYSTEM_BASELINE_QUERY = `
requests
| where timestamp > ago(7d) and timestamp < ago(30m)
| where client_Type != "Browser"
| summarize
    b_total    = count(),
    b_errors   = countif(success == false),
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

const RESULT_CODE_QUERY = `
requests
| where timestamp > ago(30m)
| where client_Type != "Browser"
| summarize code_count = count() by operation_Name, resultCode
| order by operation_Name asc, code_count desc
`;

const YESTERDAY_COMPARISON_QUERY = `
let now = ago(0m);
let window_start = ago(30m);
let yest_start = ago(1d) - 30m;
let yest_end   = ago(1d);
let today = requests
| where timestamp between (window_start .. now)
| where client_Type != "Browser"
| summarize t_total=count(), t_errors=countif(success==false), t_avg_rt=avg(duration) by operation_Name
| extend t_err_rate = iff(t_total > 0, t_errors * 100.0 / t_total, 0.0);
let yesterday = requests
| where timestamp between (yest_start .. yest_end)
| where client_Type != "Browser"
| summarize y_total=count(), y_errors=countif(success==false), y_avg_rt=avg(duration) by operation_Name
| extend y_err_rate = iff(y_total > 0, y_errors * 100.0 / y_total, 0.0);
today | join kind=leftouter yesterday on operation_Name
| project operation_Name, t_total, t_errors, t_avg_rt, t_err_rate, y_total, y_errors, y_avg_rt, y_err_rate
`;

// ── Severity classifier (mirrors mlApiAlerts.js) ──────────────────────────────
function classifySeverity({ errZ, rtZ, currErrRate, histAvgErr, histStdErr, currAvgRt, histAvgRt, errTrendSlope, currTotal, histAvgDaily, isChronic }) {
  const absErrIncrease = currErrRate - histAvgErr;
  const rtMultiplier   = histAvgRt > 0 ? currAvgRt / histAvgRt : 1;

  if (currTotal === 0 && histAvgDaily > 50) return "critical";

  const histAvg30m_sev = histAvgDaily / 48;
  const trafficDropPct = histAvg30m_sev > 0 ? ((histAvg30m_sev - currTotal) / histAvg30m_sev) * 100 : 0;
  if (trafficDropPct > 80 && histAvg30m_sev > 10 && currTotal < histAvg30m_sev * 0.2) return "critical";
  if (trafficDropPct > 65 && histAvg30m_sev > 10 && currTotal < histAvg30m_sev * 0.35) return "warning";

  if (isChronic) {
    if (currErrRate > histAvgErr * 1.5 && absErrIncrease > 20) return "critical";
    if (currErrRate > histAvgErr * 1.3 && absErrIncrease > 10) return "warning";
    return "ok";
  }

  if (errZ > 3.5 && absErrIncrease > 8  && currErrRate > 15) return "critical";
  if (errZ > 3.0 && absErrIncrease > 5  && currErrRate > 10) return "critical";
  if (rtZ  > 3.5 && rtMultiplier >= 4.0) return "critical";
  if (rtZ  > 3.0 && rtMultiplier >= 3.0) return "critical";
  if (errZ > 2.5 && absErrIncrease > 3  && currErrRate > 5)  return "warning";
  if (errZ > 2.0 && absErrIncrease > 2  && currErrRate > 3)  return "warning";
  if (rtZ  > 2.5 && rtMultiplier >= 2.5) return "warning";
  if (rtZ  > 2.0 && rtMultiplier >= 2.0) return "warning";
  if (errTrendSlope > 4 && currErrRate > 5 && absErrIncrease > 2) return "warning";

  const upperNormal = histAvgErr + 2 * Math.max(histStdErr, 0.5);
  if (currErrRate > upperNormal && absErrIncrease > 1.5) return "info";
  if (rtZ > 2.0 && rtMultiplier >= 1.5) return "info";
  return "ok";
}

// ── Issue diagnoser (mirrors mlApiAlerts.js) ──────────────────────────────────
function diagnoseIssues({ curr, baseline, ml, isChronic }) {
  const issues = [];
  const { errorRate: currErrRate, avgRt: currAvgRt, total: currTotal } = curr;
  const { avgErrorRate: histAvgErr, avgRt: histAvgRt, avgDailyRequests: histAvgDaily } = baseline;
  const absErrIncrease = currErrRate - histAvgErr;
  const rtMultiplier   = histAvgRt > 0 ? currAvgRt / histAvgRt : 1;
  const rtIncreasePct  = histAvgRt > 0 ? ((currAvgRt - histAvgRt) / histAvgRt) * 100 : 0;
  const histAvg30m     = histAvgDaily / 48;
  const trafficDropPct = histAvg30m > 0 ? ((histAvg30m - currTotal) / histAvg30m) * 100 : 0;

  if (currTotal === 0 && histAvgDaily > 50) {
    issues.push({ type: "TRAFFIC_SILENCE", icon: "⚫", title: "Zero traffic — API not receiving requests", detail: `No requests in last 30 min. Historical avg: ${Math.round(histAvgDaily).toLocaleString()} req/day.`, action: "Check load balancer routing, service health, and deployment status." });
    return issues;
  }
  if (trafficDropPct > 60 && histAvgDaily > 100) {
    issues.push({ type: trafficDropPct > 80 ? "CRITICAL_TRAFFIC_DROP" : "HIGH_TRAFFIC_DROP", icon: trafficDropPct > 80 ? "🔴" : "🟠", title: `Traffic dropped ${trafficDropPct.toFixed(0)}% below historical average`, detail: `Current: ${currTotal.toLocaleString()} req/30min vs historical avg ${Math.round(histAvg30m).toLocaleString()} req/30min.`, action: "Investigate load balancer, upstream routing, and service reachability." });
  }
  if (isChronic && absErrIncrease > 10) {
    issues.push({ type: "CHRONIC_WORSENING", icon: "🔴", title: "Chronically failing API — now significantly worse", detail: `Baseline error rate ${histAvgErr.toFixed(1)}% (chronic). Current: ${currErrRate.toFixed(1)}% (+${absErrIncrease.toFixed(1)}pp).`, action: "Immediate review needed — situation has worsened beyond its own bad baseline." });
    return issues;
  }
  if (currErrRate > 10 && absErrIncrease > 5 && ml.errZ > 3.0) {
    issues.push({ type: "CRITICAL_ERROR_RATE", icon: "🔴", title: "Critical error rate spike", detail: `${currErrRate.toFixed(1)}% error rate (${curr.errors.toLocaleString()} errors/30min) vs 80-day avg ${histAvgErr.toFixed(1)}% (+${absErrIncrease.toFixed(1)}pp, Z=${ml.errZ.toFixed(1)}σ).`, action: "Immediate investigation. Check recent deployments, downstream dependencies, and service logs." });
  } else if (currErrRate > 3 && absErrIncrease > 2 && ml.errZ > 2.0) {
    issues.push({ type: "ELEVATED_ERROR_RATE", icon: "🟠", title: "Error rate above trained baseline", detail: `${currErrRate.toFixed(1)}% vs 80-day avg ${histAvgErr.toFixed(1)}% (+${absErrIncrease.toFixed(1)}pp, Z=${ml.errZ.toFixed(1)}σ).`, action: "Review error logs. Check if a recent change caused this increase." });
  }
  if (ml.rtZ > 3.0 && rtMultiplier >= 3.0) {
    issues.push({ type: "CRITICAL_LATENCY", icon: "🔴", title: "Critical response time spike", detail: `Avg RT ${currAvgRt}ms vs baseline ${histAvgRt}ms (${rtMultiplier.toFixed(1)}x, +${rtIncreasePct.toFixed(0)}%, Z=${ml.rtZ.toFixed(1)}σ). p95=${curr.p95Rt}ms.`, action: "Check database slow queries, connection pool exhaustion, or downstream service degradation." });
  } else if (ml.rtZ > 2.0 && rtMultiplier >= 2.0) {
    issues.push({ type: "HIGH_LATENCY", icon: "🟠", title: "Response time significantly above trained baseline", detail: `Avg RT ${currAvgRt}ms vs baseline ${histAvgRt}ms (${rtMultiplier.toFixed(1)}x, Z=${ml.rtZ.toFixed(1)}σ).`, action: "Investigate slow queries or resource contention." });
  }
  if (ml.errTrendSlope > 4 && currErrRate > 5 && absErrIncrease > 2) {
    issues.push({ type: "WORSENING_ERROR_TREND", icon: "📈", title: "Error rate trending up over last 24h", detail: `Slope: +${ml.errTrendSlope.toFixed(1)}%/hr. Current: ${currErrRate.toFixed(1)}% vs baseline ${histAvgErr.toFixed(1)}%.`, action: "Trend suggests ongoing degradation. Investigate before it becomes critical." });
  }
  return issues;
}

// ── Main ML run ───────────────────────────────────────────────────────────────
async function runMLCycle() {
  const t0 = Date.now();
  console.log("\n" + "─".repeat(60));
  console.log(`🤖 [ML Scheduler] Starting cycle at ${new Date().toLocaleTimeString("en-GB")}`);

  try {
    // Fast queries in parallel
    const [curr30mRows, trendRows, sysCurrRows, sysBaseRows, codeRows, yesterdayRows] = await Promise.all([
      queryAppInsights(CURRENT_30M_QUERY).catch(e => { console.warn("  ⚠ 30m query:", e.message); return []; }),
      queryAppInsights(TREND_QUERY).catch(e => { console.warn("  ⚠ trend query:", e.message); return []; }),
      queryAppInsights(SYSTEM_CURRENT_QUERY).catch(e => { console.warn("  ⚠ sys-current:", e.message); return []; }),
      queryAppInsights(SYSTEM_BASELINE_QUERY).catch(e => { console.warn("  ⚠ sys-baseline:", e.message); return []; }),
      queryAppInsights(RESULT_CODE_QUERY).catch(e => { console.warn("  ⚠ code query:", e.message); return []; }),
      queryAppInsights(YESTERDAY_COMPARISON_QUERY).catch(e => { console.warn("  ⚠ yesterday:", e.message); return []; }),
    ]);

    // Heavy 80-day baseline
    let baselineRows = [];
    try {
      baselineRows = await queryAppInsights(BASELINE_QUERY);
      console.log(`  ✅ Baseline: ${baselineRows.length} APIs`);
    } catch (e) {
      console.error("  ❌ Baseline query failed:", e.message);
      return; // can't proceed without baseline
    }

    // Build current map
    const currMap = new Map();
    for (const [op, total, errors, avgRt, p50Rt, p95Rt] of curr30mRows) {
      currMap.set(op, {
        total:  safeNum(total),
        errors: safeNum(errors),
        avgRt:  Math.round(safeNum(avgRt)),
        p50Rt:  Math.round(safeNum(p50Rt)),
        p95Rt:  Math.round(safeNum(p95Rt)),
      });
    }

    // Build trend map
    const trendMap = new Map();
    for (const [op, _ts, hTotal, hErrors, hAvgRt, hErrRate] of trendRows) {
      if (!trendMap.has(op)) trendMap.set(op, { totals: [], errors: [], rts: [], errRates: [] });
      const t = trendMap.get(op);
      t.totals.push(safeNum(hTotal));
      t.errors.push(safeNum(hErrors));
      t.rts.push(Math.round(safeNum(hAvgRt)));
      t.errRates.push(safeNum(hErrRate));
    }

    // Build status code map
    const codeCurrentMap = new Map();
    for (const [op, code, count] of codeRows) {
      if (!codeCurrentMap.has(op)) codeCurrentMap.set(op, []);
      codeCurrentMap.get(op).push({ code: String(code), count: safeNum(count) });
    }

    // Build yesterday map
    const yesterdayMap = new Map();
    for (const [op, tTotal, tErrors, tAvgRt, tErrRate, yTotal, yErrors, yAvgRt, yErrRate] of yesterdayRows) {
      yesterdayMap.set(op, {
        today:     { total: safeNum(tTotal), errors: safeNum(tErrors), avgRt: Math.round(safeNum(tAvgRt)), errorRate: parseFloat(safeNum(tErrRate).toFixed(2)) },
        yesterday: { total: safeNum(yTotal), errors: safeNum(yErrors), avgRt: Math.round(safeNum(yAvgRt)), errorRate: parseFloat(safeNum(yErrRate).toFixed(2)) },
      });
    }

    // System summary
    const b = sysBaseRows[0] || [];
    const c = sysCurrRows[0] || [];
    const sysSummary = (b.length && c.length) ? {
      currTotal:          safeNum(c[0]),
      currErrors:         safeNum(c[1]),
      currAvgRt:          Math.round(safeNum(c[2])),
      currErrRate:        parseFloat(safeNum(c[3]).toFixed(2)),
      baselineAvgRequests: Math.round(safeNum(b[0])),
      baselineAvgRt:      Math.round(safeNum(b[2])),
      baselineAvgErrRate: parseFloat(safeNum(b[4]).toFixed(2)),
    } : null;

    // ── Per-API analysis ──────────────────────────────────────────────────
    const criticalAlerts = [];
    let totalAnalyzed = 0;

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

      totalAnalyzed++;
      const curr  = currMap.get(op)  || { total: 0, errors: 0, avgRt: 0, p50Rt: 0, p95Rt: 0 };
      const trend = trendMap.get(op) || { totals: [], errors: [], rts: [], errRates: [] };

      const histAvgErrSafe   = safeNum(histAvgErrRate);
      const histAvgRtSafe    = safeNum(histAvgRt);
      const histAvgDailySafe = safeNum(histAvgDaily);
      const histDaysSafe     = safeNum(histDays);
      const errStd           = safeNum(histStdErr);
      const rtStd            = safeNum(histStdRt);

      const currErrRate = curr.total > 0 ? (curr.errors / curr.total) * 100 : 0;
      const isChronic   = histAvgErrSafe > 50;

      const errZ       = zScore(currErrRate, histAvgErrSafe, errStd, 0.5);
      const rtZ        = zScore(curr.avgRt,  histAvgRtSafe,  rtStd,  10);
      const histAvg30m = histAvgDailySafe / 48;
      const trafficZ   = zScore(curr.total, histAvg30m, histAvg30m * 0.4, 5);

      const errIQR       = isIQROutlier(currErrRate, [safeNum(histP25Err), histAvgErrSafe, safeNum(histP75Err)]);
      const errTrendSlope = linearSlope(trend.errRates);
      const rtTrendSlope  = linearSlope(trend.rts);
      const errEwma       = ewma(trend.errRates);
      const rtMultiplier  = histAvgRtSafe > 0 ? curr.avgRt / histAvgRtSafe : 1;
      const maxZ          = Math.max(Math.abs(errZ), Math.abs(rtZ), Math.abs(trafficZ));
      const conf          = confidence(histDaysSafe, maxZ);

      const ml = {
        errZ:          parseFloat(errZ.toFixed(2)),
        rtZ:           parseFloat(rtZ.toFixed(2)),
        trafficZ:      parseFloat(trafficZ.toFixed(2)),
        rtMultiplier:  parseFloat(rtMultiplier.toFixed(2)),
        errIQR,
        errTrendSlope: parseFloat(errTrendSlope.toFixed(3)),
        rtTrendSlope:  parseFloat(rtTrendSlope.toFixed(3)),
        errEwma:       parseFloat(errEwma.toFixed(2)),
        confidence:    conf + "%",
        isChronic,
      };

      const severity = classifySeverity({
        errZ, rtZ, currErrRate,
        histAvgErr:   histAvgErrSafe,
        histStdErr:   errStd,
        currAvgRt:    curr.avgRt,
        histAvgRt:    histAvgRtSafe,
        errTrendSlope,
        currTotal:    curr.total,
        histAvgDaily: histAvg30m,
        isChronic,
      });

      // Only process critical alerts with high confidence
      if (severity !== "critical") continue;
      if (conf < MIN_CONFIDENCE)   continue;

      const currentObj = {
        total:     curr.total,
        errors:    curr.errors,
        errorRate: parseFloat(currErrRate.toFixed(2)),
        avgRt:     curr.avgRt,
        p50Rt:     curr.p50Rt,
        p95Rt:     curr.p95Rt,
      };

      const baselineObj = {
        days:             histDaysSafe,
        avgDailyRequests: Math.round(histAvgDailySafe),
        avgErrorRate:     parseFloat(histAvgErrSafe.toFixed(2)),
        maxErrorRate:     parseFloat(safeNum(histMaxErrRate).toFixed(2)),
        avgRt:            Math.round(histAvgRtSafe),
        p50Rt:            Math.round(safeNum(histP50Rt)),
        p95Rt:            Math.round(safeNum(histP95Rt)),
        maxRt:            Math.round(safeNum(histMaxRt)),
        stdErr:           parseFloat(errStd.toFixed(3)),
        stdRt:            parseFloat(rtStd.toFixed(1)),
      };

      const issues = diagnoseIssues({ curr: currentObj, baseline: baselineObj, ml, isChronic });
      if (!issues.length) continue;

      const alert = {
        operation:   op,
        severity:    "critical",
        anomalyType: issues[0].type,
        issues,
        current:     currentObj,
        baseline:    baselineObj,
        ml,
        statusCodes: codeCurrentMap.get(op) || [],
        comparison:  yesterdayMap.get(op)   || null,
        detectedAt:  new Date().toISOString(),
      };

      criticalAlerts.push(alert);
    }

    console.log(`  📋 Analyzed: ${totalAnalyzed} APIs | 🔴 Critical (≥${MIN_CONFIDENCE}% conf): ${criticalAlerts.length} | ⏱ ${Date.now() - t0}ms`);

    // ── Send Telegram alerts ──────────────────────────────────────────────
    if (!isConfigured()) {
      console.log("  📵 Telegram not configured — skipping notifications");
      return;
    }

    let sent = 0, deduped = 0;

    for (const alert of criticalAlerts) {
      if (isDuplicate(alert.operation, "critical")) {
        deduped++;
        continue;
      }
      try {
        await sendTelegramAlert(alert, alert.comparison);
        markSent(alert.operation, "critical");
        sent++;
        console.log(`  📨 Sent: ${alert.operation} (conf=${alert.ml.confidence})`);
        // Small delay between messages to avoid Telegram rate limits
        await new Promise(r => setTimeout(r, 500));
      } catch (e) {
        console.error(`  ❌ Telegram send failed for ${alert.operation}:`, e.message);
      }
    }

    // Send summary if there are new critical alerts
    if (sent > 0) {
      try {
        await sendTelegramSummary(criticalAlerts, [], sysSummary);
        console.log(`  📊 Summary sent — ${sent} new alerts, ${deduped} deduplicated`);
      } catch (e) {
        console.error("  ❌ Summary send failed:", e.message);
      }
    } else {
      console.log(`  ✅ No new alerts to send (${deduped} deduplicated)`);
    }

  } catch (err) {
    console.error("  ❌ [ML Scheduler] Cycle failed:", err.message);
  }

  console.log(`─`.repeat(60) + "\n");
}

// ── Scheduler ─────────────────────────────────────────────────────────────────
let schedulerTimer = null;

function startScheduler() {
  if (schedulerTimer) return; // already running

  console.log(`\n🚀 [ML Scheduler] Started — interval: ${INTERVAL_MS / 60000} min | min confidence: ${MIN_CONFIDENCE}% | dedup window: ${DEDUP_WINDOW_MS / 60000} min`);

  // Run immediately on start, then on interval
  runMLCycle();
  schedulerTimer = setInterval(runMLCycle, INTERVAL_MS);
}

function stopScheduler() {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
    console.log("🛑 [ML Scheduler] Stopped");
  }
}

function getStatus() {
  return {
    running:         !!schedulerTimer,
    intervalMinutes: INTERVAL_MS / 60000,
    minConfidence:   MIN_CONFIDENCE,
    dedupWindowMin:  DEDUP_WINDOW_MS / 60000,
    activeDedup:     sentAlerts.size,
  };
}

module.exports = { startScheduler, stopScheduler, getStatus, runMLCycle };
