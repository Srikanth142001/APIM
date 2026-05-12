/**
 * Telegram Alert Service
 * Sends rich formatted alerts to a Telegram chat via Bot API.
 * Config stored in .env: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
 * Can also be set at runtime via /api/telegram/config
 *
 * SSL: uses rejectUnauthorized:false to handle corporate proxy/firewall certs.
 */
const axios = require("axios");
const https = require("https");

// Bypass SSL verification — needed in corporate environments with proxy/firewall
const agent = new https.Agent({ rejectUnauthorized: false });

// Runtime config (overrides .env when set via UI)
let runtimeConfig = {
  botToken:    process.env.TELEGRAM_BOT_TOKEN || "",
  chatId:      process.env.TELEGRAM_CHAT_ID   || "",
  enabled:     true,
  minSeverity: "critical", // "critical" | "warning" | "info"
};

function getConfig()      { return { ...runtimeConfig }; }
function setConfig(cfg)   { runtimeConfig = { ...runtimeConfig, ...cfg }; }
function isConfigured()   { return !!(runtimeConfig.botToken && runtimeConfig.chatId && runtimeConfig.enabled); }

// ── Core send ─────────────────────────────────────────────────────────────────
async function sendTelegram(text) {
  const { botToken, chatId } = runtimeConfig;
  if (!botToken || !chatId) throw new Error("Telegram not configured — set botToken and chatId");

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const response = await axios.post(url, {
    chat_id:                  chatId,
    text,
    parse_mode:               "HTML",
    disable_web_page_preview: true,
  }, {
    timeout:    15000,
    httpsAgent: agent,   // ← fixes "unable to get local issuer certificate"
  });
  return response.data;
}

// ── HTML escape ───────────────────────────────────────────────────────────────
function esc(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ── Build rich alert message ──────────────────────────────────────────────────
/**
 * Builds a detailed Telegram HTML message for a single API alert.
 * Includes: severity, current metrics, ML scores, issues with explanations,
 * status codes, yesterday comparison, and 80-day baseline.
 */
function buildAlertMessage(alert, comparison) {
  const sev      = alert.severity;
  const icon     = sev === "critical" ? "🔴" : sev === "warning" ? "🟡" : "🔵";
  const sevLabel = sev.toUpperCase();

  const op   = esc(alert.operation);
  const curr = alert.current  || {};
  const base = alert.baseline || {};
  const ml   = alert.ml       || {};

  // ── Confidence bar ────────────────────────────────────────────────────────
  const confNum  = parseInt(ml.confidence) || 0;
  const confBar  = "█".repeat(Math.round(confNum / 10)) + "░".repeat(10 - Math.round(confNum / 10));
  const confColor = confNum >= 90 ? "🟢" : confNum >= 70 ? "🟡" : "🔴";

  // ── Status codes ──────────────────────────────────────────────────────────
  const codes = (alert.statusCodes || [])
    .slice(0, 5)
    .map(c => {
      const codeStr  = String(c.code);
      const codeIcon = codeStr.startsWith("5") ? "🔴" : codeStr.startsWith("4") ? "🟠" : "✅";
      return `${codeIcon} <code>${codeStr}</code> ×${(c.count || 0).toLocaleString()}`;
    })
    .join("  ");

  // ── Issues with full explanation ──────────────────────────────────────────
  const issueLines = (alert.issues || []).slice(0, 4).map((iss, i) =>
    `  <b>${i + 1}. ${esc(iss.title)}</b>\n` +
    `     ${esc(iss.detail)}\n` +
    `     💡 <i>${esc(iss.action)}</i>`
  ).join("\n\n");

  // ── Yesterday vs today ────────────────────────────────────────────────────
  let comparisonBlock = "";
  if (comparison) {
    const yest     = comparison.yesterday || {};
    const tod      = comparison.today     || {};
    const errDelta = ((tod.errorRate || 0) - (yest.errorRate || 0)).toFixed(1);
    const rtDelta  = ((tod.avgRt    || 0) - (yest.avgRt    || 0));
    const errArrow = parseFloat(errDelta) > 0 ? "📈 WORSE" : "📉 BETTER";
    const rtArrow  = rtDelta > 0 ? "📈" : "📉";
    comparisonBlock = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
<b>📅 Yesterday vs Today (same 30-min window)</b>
  Requests:   ${(yest.total || 0).toLocaleString()} → <b>${(tod.total || 0).toLocaleString()}</b>
  Error Rate: ${(yest.errorRate || 0).toFixed(2)}% → <b>${(tod.errorRate || 0).toFixed(2)}%</b>  ${errArrow} (${parseFloat(errDelta) > 0 ? "+" : ""}${errDelta}pp)
  Avg RT:     ${yest.avgRt || 0}ms → <b>${tod.avgRt || 0}ms</b>  ${rtArrow} (${rtDelta > 0 ? "+" : ""}${rtDelta}ms)`;
  }

  // ── Anomaly type label ────────────────────────────────────────────────────
  const anomalyLabel = alert.anomalyType
    ? `\n<b>⚡ Anomaly Type:</b> <code>${esc(alert.anomalyType.replace(/_/g, " "))}</code>`
    : "";

  const msg =
`${icon} <b>[${sevLabel}] ${op}</b>${anomalyLabel}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
<b>📊 Current Window (last 30 min)</b>
  Requests:   <code>${(curr.total || 0).toLocaleString()}</code>
  Errors:     <code>${(curr.errors || 0).toLocaleString()}</code>
  Error Rate: <b>${(curr.errorRate || 0).toFixed(2)}%</b>  <i>(baseline: ${(base.avgErrorRate || 0).toFixed(2)}%)</i>
  Avg RT:     <b>${curr.avgRt || 0}ms</b>  <i>(baseline: ${base.avgRt || 0}ms · ${(ml.rtMultiplier || 1).toFixed(1)}x slower)</i>
  p95 RT:     ${curr.p95Rt || 0}ms

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
<b>🤖 ML Detection Scores</b>
  Error Z-score:   <b>${(ml.errZ || 0).toFixed(2)}σ</b>  <i>(${Math.abs(ml.errZ || 0) > 3.5 ? "EXTREME" : Math.abs(ml.errZ || 0) > 2.5 ? "HIGH" : "ELEVATED"})</i>
  RT Z-score:      <b>${(ml.rtZ || 0).toFixed(2)}σ</b>
  Traffic Z-score: <b>${(ml.trafficZ || 0).toFixed(2)}σ</b>
  RT Multiplier:   <b>${(ml.rtMultiplier || 1).toFixed(2)}x</b> vs trained baseline
  IQR Outlier:     ${ml.errIQR ? "✅ YES — confirmed outlier" : "no"}
  Error Trend:     ${(ml.errTrendSlope || 0) > 0 ? "📈 RISING" : "📉 stable"} (${(ml.errTrendSlope || 0).toFixed(2)}/hr)
  ${confColor} Confidence: <b>${ml.confidence || "—"}</b>  [${confBar}]
${comparisonBlock}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
<b>🔢 HTTP Status Codes (30 min)</b>
  ${codes || "No code data available"}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
<b>🔍 Root Cause Analysis</b>
${issueLines || "  No specific issues diagnosed"}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
<b>📈 80-Day Trained Baseline</b>
  Avg daily requests: ${(base.avgDailyRequests || 0).toLocaleString()}
  Avg error rate:     ${(base.avgErrorRate || 0).toFixed(2)}%  (max ever: ${(base.maxErrorRate || 0).toFixed(2)}%)
  Avg RT:             ${base.avgRt || 0}ms  (std: ±${(base.stdRt || 0).toFixed(0)}ms)
  Training data:      ${base.days || 0} days

⏰ <i>Detected: ${new Date().toLocaleString("en-GB", { timeZone: "UTC", hour12: false })} UTC</i>`;

  return msg;
}

// ── Send single alert ─────────────────────────────────────────────────────────
async function sendTelegramAlert(alert, comparison) {
  if (!isConfigured()) return { skipped: "Telegram not configured" };

  const sevOrder = { critical: 0, warning: 1, info: 2 };
  const minOrder = sevOrder[runtimeConfig.minSeverity] ?? 0;
  if ((sevOrder[alert.severity] ?? 3) > minOrder) {
    return { skipped: `Severity ${alert.severity} below minimum ${runtimeConfig.minSeverity}` };
  }

  const text = buildAlertMessage(alert, comparison);
  await sendTelegram(text);
  return { sent: true, operation: alert.operation };
}

// ── Send batch summary ────────────────────────────────────────────────────────
async function sendTelegramSummary(alerts, systemAlerts, sysSummary) {
  if (!isConfigured()) return { skipped: "Telegram not configured" };

  const critical = alerts.filter(a => a.severity === "critical");
  const warning  = alerts.filter(a => a.severity === "warning");

  if (critical.length === 0 && (!systemAlerts || systemAlerts.length === 0)) {
    return { skipped: "No critical alerts to send" };
  }

  const sysBlock = (systemAlerts || []).length > 0
    ? "\n🌐 <b>SYSTEM-WIDE ALERTS</b>\n" + systemAlerts.map(s =>
        `  ${s.icon || "⚠"} ${esc(s.title)}`
      ).join("\n")
    : "";

  const topCritical = critical.slice(0, 10).map((a, i) => {
    const conf = parseInt(a.ml?.confidence) || 0;
    const confIcon = conf >= 90 ? "🟢" : conf >= 70 ? "🟡" : "🔴";
    return (
      `  ${i + 1}. <code>${esc(a.operation)}</code>\n` +
      `     err=<b>${a.current.errorRate}%</b> | rt=<b>${a.current.avgRt}ms</b> (${(a.ml?.rtMultiplier || 1).toFixed(1)}x) | ${confIcon} conf=${a.ml?.confidence}`
    );
  }).join("\n");

  const msg =
`🚨 <b>ML ANOMALY DETECTION REPORT</b>
${sysSummary ? `\n<b>📊 System Health (30 min)</b>\n  Requests: ${sysSummary.currTotal.toLocaleString()} | Errors: ${sysSummary.currErrRate}% | Avg RT: ${sysSummary.currAvgRt}ms` : ""}
${sysBlock}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔴 Critical: <b>${critical.length}</b>   🟡 Warning: <b>${warning.length}</b>   ✅ Healthy: <b>${alerts.filter(a => a.severity === "ok").length}</b>

<b>🔴 Critical APIs:</b>
${topCritical || "  None"}

⏰ <i>${new Date().toLocaleString("en-GB", { timeZone: "UTC", hour12: false })} UTC</i>`;

  await sendTelegram(msg);
  return { sent: true, criticalCount: critical.length };
}

module.exports = {
  getConfig, setConfig, isConfigured,
  sendTelegram, sendTelegramAlert, sendTelegramSummary, buildAlertMessage,
};
