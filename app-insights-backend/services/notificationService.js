/**
 * Notification Service
 * Handles: Browser Push Notifications, Microsoft Teams Webhook, Email (nodemailer)
 */

const webpush = require("web-push");
const nodemailer = require("nodemailer");

// ── VAPID Keys (generated once) ───────────────────────────────────────────────
const VAPID_PUBLIC_KEY  = process.env.VAPID_PUBLIC_KEY  || "BLMM_Tv79lJlbRs9mWFZuRQnUwLIdVE4YU8tll_iDaQ2U-Zg7Yyl6qV1U0d8IbUz-2xSxzLhdhMAfjvaEOhuH3w";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "WXgFixRXu_GdoGRp-QbvkcQ9o8banVnxF8TV6trCsCA";
const VAPID_EMAIL       = process.env.VAPID_EMAIL       || "mailto:admin@nexgen-apim.com";

webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

// ── In-memory push subscription store ────────────────────────────────────────
const pushSubscriptions = new Set();

// ── Deduplication: don't re-send same alert within 10 minutes ─────────────────
const sentAlerts = new Map(); // alertType -> timestamp
const DEDUP_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

function isDuplicate(alertType) {
  const last = sentAlerts.get(alertType);
  if (!last) return false;
  return (Date.now() - last) < DEDUP_WINDOW_MS;
}

function markSent(alertType) {
  sentAlerts.set(alertType, Date.now());
}

// ── Browser Push Notification ─────────────────────────────────────────────────
async function sendBrowserPush(anomaly) {
  if (pushSubscriptions.size === 0) return { sent: 0, skipped: "no subscribers" };

  const payload = JSON.stringify({
    title: anomaly.title,
    body: anomaly.message,
    icon: "/logo192.png",
    badge: "/logo192.png",
    tag: anomaly.type,
    data: {
      url: "/dashboard?tab=alerts",
      severity: anomaly.severity,
      confidence: anomaly.confidence,
      timestamp: anomaly.timestamp,
    },
    actions: [
      { action: "view", title: "View Dashboard" },
      { action: "dismiss", title: "Dismiss" },
    ],
  });

  let sent = 0, failed = 0;
  const toRemove = [];

  for (const sub of pushSubscriptions) {
    try {
      await webpush.sendNotification(sub, payload);
      sent++;
    } catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        toRemove.push(sub); // subscription expired
      }
      failed++;
    }
  }

  toRemove.forEach(s => pushSubscriptions.delete(s));
  return { sent, failed, total: pushSubscriptions.size };
}

// ── Microsoft Teams Webhook ───────────────────────────────────────────────────
async function sendTeamsNotification(anomaly) {
  const webhookUrl = process.env.TEAMS_WEBHOOK_URL;
  if (!webhookUrl) return { skipped: "TEAMS_WEBHOOK_URL not configured" };

  const axios = require("axios");
  const https = require("https");
  const agent = new https.Agent({ rejectUnauthorized: false });

  const colorMap = { critical: "FF0000", warning: "FFA500", info: "0078D4" };
  const color = colorMap[anomaly.severity] || "808080";

  const card = {
    "@type": "MessageCard",
    "@context": "http://schema.org/extensions",
    themeColor: color,
    summary: anomaly.title,
    sections: [{
      activityTitle: `🤖 **${anomaly.title}**`,
      activitySubtitle: `NexGen APIM — ${new Date(anomaly.timestamp).toLocaleString("en-GB")}`,
      activityImage: "https://img.icons8.com/color/48/000000/error--v1.png",
      facts: [
        { name: "Severity",    value: anomaly.severity.toUpperCase() },
        { name: "Type",        value: anomaly.type },
        { name: "Metric",      value: String(anomaly.value) },
        { name: "Z-Score",     value: String(anomaly.zScore) },
        { name: "Baseline",    value: String(anomaly.baseline) },
        { name: "Confidence",  value: anomaly.confidence },
        { name: "Trend",       value: anomaly.trend },
        { name: "Description", value: anomaly.message },
      ],
      markdown: true,
    }],
    potentialAction: [{
      "@type": "OpenUri",
      name: "View Dashboard",
      targets: [{ os: "default", uri: `${process.env.DASHBOARD_URL || "http://localhost:3000"}/dashboard?tab=alerts` }],
    }],
  };

  try {
    await axios.post(webhookUrl, card, { httpsAgent: agent, timeout: 5000 });
    return { sent: true };
  } catch (err) {
    console.error("[Teams] Webhook failed:", err.message);
    return { error: err.message };
  }
}

// ── Email Notification ────────────────────────────────────────────────────────
async function sendEmailNotification(anomaly) {
  const emailTo   = process.env.ALERT_EMAIL_TO;
  const emailFrom = process.env.ALERT_EMAIL_FROM;
  const smtpHost  = process.env.SMTP_HOST;
  const smtpPort  = parseInt(process.env.SMTP_PORT || "587");
  const smtpUser  = process.env.SMTP_USER;
  const smtpPass  = process.env.SMTP_PASS;

  if (!emailTo || !smtpHost) return { skipped: "Email not configured (SMTP_HOST, ALERT_EMAIL_TO required)" };

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: smtpUser ? { user: smtpUser, pass: smtpPass } : undefined,
    tls: { rejectUnauthorized: false },
  });

  const severityEmoji = { critical: "🚨", warning: "⚠️", info: "ℹ️" }[anomaly.severity] || "🔔";
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #111217; color: #c9d1d9; padding: 24px; border-radius: 8px;">
      <div style="background: ${anomaly.severity === "critical" ? "#f2495c" : "#f5a623"}; padding: 12px 20px; border-radius: 6px; margin-bottom: 20px;">
        <h2 style="margin: 0; color: white; font-size: 18px;">${severityEmoji} ${anomaly.title}</h2>
      </div>
      <table style="width: 100%; border-collapse: collapse;">
        ${[
          ["Severity",    anomaly.severity.toUpperCase()],
          ["Type",        anomaly.type],
          ["Value",       String(anomaly.value)],
          ["Z-Score",     String(anomaly.zScore)],
          ["Baseline",    String(anomaly.baseline)],
          ["Confidence",  anomaly.confidence],
          ["Trend",       anomaly.trend],
          ["Time",        new Date(anomaly.timestamp).toLocaleString("en-GB")],
        ].map(([k, v]) => `
          <tr style="border-bottom: 1px solid #22263a;">
            <td style="padding: 8px 12px; color: #6b7280; font-size: 13px; width: 120px;">${k}</td>
            <td style="padding: 8px 12px; color: #c9d1d9; font-size: 13px; font-weight: 600;">${v}</td>
          </tr>
        `).join("")}
      </table>
      <div style="margin-top: 16px; padding: 12px 16px; background: #1a1d27; border-radius: 6px; border-left: 3px solid #5794f2;">
        <p style="margin: 0; font-size: 13px; color: #c9d1d9;">${anomaly.message}</p>
      </div>
      <div style="margin-top: 20px; text-align: center;">
        <a href="${process.env.DASHBOARD_URL || "http://localhost:3000"}/dashboard?tab=alerts"
           style="background: #1f60c4; color: white; padding: 10px 24px; border-radius: 4px; text-decoration: none; font-size: 13px; font-weight: 600;">
          View Dashboard
        </a>
      </div>
      <p style="margin-top: 20px; font-size: 11px; color: #4b5563; text-align: center;">
        NexGen APIM Monitoring — AI Anomaly Detection Engine
      </p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: emailFrom || `"NexGen APIM Alerts" <${smtpUser}>`,
      to: emailTo,
      subject: `${severityEmoji} [${anomaly.severity.toUpperCase()}] ${anomaly.title}`,
      html,
    });
    return { sent: true, to: emailTo };
  } catch (err) {
    console.error("[Email] Send failed:", err.message);
    return { error: err.message };
  }
}

// ── Main dispatch: send all configured channels ───────────────────────────────
async function dispatchNotifications(anomaly) {
  if (isDuplicate(anomaly.type)) {
    return { skipped: true, reason: "duplicate within 10 min window" };
  }

  markSent(anomaly.type);

  const [pushResult, teamsResult, emailResult] = await Promise.allSettled([
    sendBrowserPush(anomaly),
    sendTeamsNotification(anomaly),
    sendEmailNotification(anomaly),
  ]);

  return {
    push:  pushResult.status  === "fulfilled" ? pushResult.value  : { error: pushResult.reason?.message },
    teams: teamsResult.status === "fulfilled" ? teamsResult.value : { error: teamsResult.reason?.message },
    email: emailResult.status === "fulfilled" ? emailResult.value : { error: emailResult.reason?.message },
  };
}

module.exports = {
  pushSubscriptions,
  sendBrowserPush,
  sendTeamsNotification,
  sendEmailNotification,
  dispatchNotifications,
  VAPID_PUBLIC_KEY,
};
