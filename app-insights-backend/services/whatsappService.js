/**
 * WhatsApp Business API Integration
 * Uses Meta's WhatsApp Cloud API (official, free tier available)
 *
 * Setup:
 *  1. Go to https://developers.facebook.com → Create App → Business
 *  2. Add WhatsApp product → Get Phone Number ID + Access Token
 *  3. Add recipient numbers to test contacts (sandbox) or verify business
 *
 * .env variables needed:
 *   WHATSAPP_TOKEN=your_permanent_access_token
 *   WHATSAPP_PHONE_ID=your_phone_number_id (e.g. 123456789012345)
 *   WHATSAPP_RECIPIENTS=+1234567890,+0987654321  (comma-separated)
 */

const axios = require("axios");
const https = require("https");
const agent = new https.Agent({ rejectUnauthorized: false });

const WA_API_URL = "https://graph.facebook.com/v19.0";

// ── Check if WhatsApp is configured ──────────────────────────────────────────
function isWhatsAppConfigured() {
  return !!(
    process.env.WHATSAPP_TOKEN &&
    process.env.WHATSAPP_PHONE_ID &&
    process.env.WHATSAPP_RECIPIENTS
  );
}

// ── Get recipient list ────────────────────────────────────────────────────────
function getRecipients() {
  const raw = process.env.WHATSAPP_RECIPIENTS || "";
  return raw.split(",").map(n => n.trim()).filter(Boolean);
}

// ── Send a text message to one number ────────────────────────────────────────
async function sendWhatsAppMessage(toNumber, message) {
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  const token   = process.env.WHATSAPP_TOKEN;

  const response = await axios.post(
    `${WA_API_URL}/${phoneId}/messages`,
    {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: toNumber,
      type: "text",
      text: { preview_url: false, body: message },
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      httpsAgent: agent,
      timeout: 10000,
    }
  );
  return response.data;
}

// ── Format alert message for WhatsApp ────────────────────────────────────────
function formatAlertMessage(anomaly) {
  const severityEmoji = {
    critical: "🚨",
    warning:  "⚠️",
    info:     "ℹ️",
  }[anomaly.severity] || "🔔";

  const typeEmoji = {
    CRITICAL_FAILURE_RATE: "💥",
    HIGH_FAILURE_RATE:     "🔴",
    HIGH_LATENCY:          "🐢",
    CRITICAL_LATENCY:      "🔴",
    WORSENING_TREND:       "📈",
    ZERO_TRAFFIC:          "⚫",
    ERROR_RATE_ANOMALY:    "🚨",
    LATENCY_ANOMALY:       "⏱",
    TRAFFIC_DROP_ANOMALY:  "📉",
    FAILURE_SPIKE_ANOMALY: "💥",
    COMPOUND_ANOMALY:      "🚨",
  }[anomaly.type] || "🔔";

  const time = new Date(anomaly.timestamp || Date.now())
    .toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

  // Build the message
  let msg = `${severityEmoji} *NexGen APIM Alert*\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `${typeEmoji} *${(anomaly.severity || "").toUpperCase()}* — ${anomaly.type?.replace(/_/g, " ") || ""}\n\n`;

  // API name (truncate if too long)
  const apiName = anomaly.operation || anomaly.metric || "System";
  msg += `📌 *API:* ${apiName.length > 50 ? apiName.substring(0, 47) + "..." : apiName}\n\n`;

  // Key metrics
  if (anomaly.current) {
    msg += `📊 *Current Metrics:*\n`;
    if (anomaly.current.errorRate !== undefined) msg += `  • Error Rate: ${anomaly.current.errorRate}%\n`;
    if (anomaly.current.avgRt !== undefined)     msg += `  • Avg RT: ${anomaly.current.avgRt}ms\n`;
    if (anomaly.current.total !== undefined)     msg += `  • Requests: ${anomaly.current.total.toLocaleString()}\n`;
  }

  if (anomaly.baseline) {
    msg += `\n📈 *80-day Baseline:*\n`;
    if (anomaly.baseline.avgErrorRate !== undefined) msg += `  • Avg Error Rate: ${anomaly.baseline.avgErrorRate}%\n`;
    if (anomaly.baseline.avgRt !== undefined)        msg += `  • Avg RT: ${anomaly.baseline.avgRt}ms\n`;
  }

  if (anomaly.ml?.confidence) {
    msg += `\n🤖 *ML Confidence:* ${anomaly.ml.confidence}\n`;
  }

  // Main message
  if (anomaly.message) {
    msg += `\n💬 ${anomaly.message}\n`;
  }

  // Issues
  if (anomaly.issues?.length > 0) {
    msg += `\n🔍 *What's Wrong:*\n`;
    anomaly.issues.slice(0, 2).forEach(issue => {
      msg += `  ${issue.icon} ${issue.title}\n`;
    });
  }

  msg += `\n⏰ ${time}\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `🔗 View Dashboard: ${process.env.DASHBOARD_URL || "http://localhost:3000"}/dashboard?tab=ml-alerts`;

  return msg;
}

// ── Format ML API alert for WhatsApp ─────────────────────────────────────────
function formatMLAlertMessage(alert) {
  const severityEmoji = { critical: "🚨", warning: "⚠️", info: "ℹ️" }[alert.severity] || "🔔";
  const time = new Date().toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

  let msg = `${severityEmoji} *NexGen APIM — ML Alert*\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `*${alert.severity?.toUpperCase()}* | ${alert.anomalyType?.replace(/_/g, " ") || "ANOMALY"}\n\n`;

  const apiName = alert.operation || "";
  msg += `📌 *API:* ${apiName.length > 50 ? apiName.substring(0, 47) + "..." : apiName}\n\n`;

  if (alert.current) {
    msg += `📊 *Now:* ${alert.current.errorRate}% errors | ${alert.current.avgRt}ms RT | ${(alert.current.total || 0).toLocaleString()} req\n`;
  }
  if (alert.baseline) {
    msg += `📈 *Baseline:* ${alert.baseline.avgErrorRate}% errors | ${alert.baseline.avgRt}ms RT\n`;
  }
  if (alert.ml) {
    msg += `🤖 *Z-score:* ${alert.ml.errorRateZScore}σ err | ${alert.ml.rtZScore}σ RT | ${alert.ml.confidence} confidence\n`;
  }

  if (alert.issues?.length > 0) {
    msg += `\n🔍 *Issue:* ${alert.issues[0].title}\n`;
    msg += `   ${alert.issues[0].detail?.substring(0, 100)}${(alert.issues[0].detail?.length || 0) > 100 ? "..." : ""}\n`;
    msg += `\n💡 ${alert.issues[0].action?.substring(0, 120)}${(alert.issues[0].action?.length || 0) > 120 ? "..." : ""}\n`;
  }

  msg += `\n⏰ ${time}\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `🔗 ${process.env.DASHBOARD_URL || "http://localhost:3000"}/dashboard?tab=ml-alerts`;

  return msg;
}

// ── Send alert to all configured recipients ───────────────────────────────────
async function sendWhatsAppAlert(anomaly, isMLAlert = false) {
  if (!isWhatsAppConfigured()) {
    return { skipped: "WhatsApp not configured (WHATSAPP_TOKEN, WHATSAPP_PHONE_ID, WHATSAPP_RECIPIENTS)" };
  }

  const recipients = getRecipients();
  if (!recipients.length) {
    return { skipped: "No recipients configured in WHATSAPP_RECIPIENTS" };
  }

  const message = isMLAlert
    ? formatMLAlertMessage(anomaly)
    : formatAlertMessage(anomaly);

  const results = [];
  for (const number of recipients) {
    try {
      const result = await sendWhatsAppMessage(number, message);
      results.push({ number, success: true, messageId: result.messages?.[0]?.id });
      console.log(`[WhatsApp] ✅ Sent to ${number}: ${result.messages?.[0]?.id}`);
    } catch (err) {
      const errMsg = err.response?.data?.error?.message || err.message;
      results.push({ number, success: false, error: errMsg });
      console.error(`[WhatsApp] ❌ Failed to send to ${number}: ${errMsg}`);
    }
  }

  return { sent: results.filter(r => r.success).length, failed: results.filter(r => !r.success).length, results };
}

// ── Send test message ─────────────────────────────────────────────────────────
async function sendWhatsAppTest(toNumber) {
  const message = `✅ *NexGen APIM — Test Message*\n\nWhatsApp alerts are configured and working!\n\n🤖 ML Anomaly Detection is active\n⏰ ${new Date().toLocaleString("en-GB")}\n\n🔗 ${process.env.DASHBOARD_URL || "http://localhost:3000"}/dashboard?tab=alerts`;
  return sendWhatsAppMessage(toNumber, message);
}

module.exports = {
  sendWhatsAppAlert,
  sendWhatsAppTest,
  isWhatsAppConfigured,
  getRecipients,
  formatAlertMessage,
  formatMLAlertMessage,
};
