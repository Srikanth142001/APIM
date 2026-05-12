/**
 * Alert Engine Routes
 * - GET  /api/alerts/vapid-key       — get public VAPID key for browser push
 * - POST /api/alerts/subscribe        — register browser push subscription
 * - DELETE /api/alerts/unsubscribe    — remove subscription
 * - GET  /api/alerts/run              — manually trigger ML analysis
 * - GET  /api/alerts/status           — get current ML baseline stats
 * - POST /api/alerts/config           — update notification config (Teams URL, email)
 * - GET  /api/alerts/config           — get current config
 * - POST /api/alerts/test             — send a test notification
 */

const express = require("express");
const router = express.Router();
const cron = require("node-cron");
const { runMLAnalysis, getBaselineStats } = require("../services/mlAnomalyEngine");
const { pushSubscriptions, dispatchNotifications, VAPID_PUBLIC_KEY } = require("../services/notificationService");
const { sendWhatsAppAlert, sendWhatsAppTest, isWhatsAppConfigured, getRecipients } = require("../services/whatsappService");

// ── In-memory alert log (last 100 alerts) ────────────────────────────────────
const alertLog = [];
const MAX_LOG = 100;

// ── Notification config (runtime configurable) ───────────────────────────────
let notifConfig = {
  teamsWebhookUrl: process.env.TEAMS_WEBHOOK_URL || "",
  alertEmailTo:    process.env.ALERT_EMAIL_TO    || "",
  minSeverity:     "warning", // "warning" | "critical"
  enabled:         true,
};

// ── Scheduled ML analysis every 2 minutes ────────────────────────────────────
let lastAnalysis = null;
let isRunning = false;

async function runScheduledAnalysis() {
  if (isRunning) return;
  isRunning = true;
  try {
    console.log("[Alert Engine] Running ML analysis...");
    const result = await runMLAnalysis();
    lastAnalysis = result;

    if (!notifConfig.enabled) { isRunning = false; return; }

    // Dispatch notifications for each anomaly
    for (const anomaly of result.anomalies) {
      const severityOrder = { critical: 2, warning: 1, info: 0 };
      const minOrder = severityOrder[notifConfig.minSeverity] || 1;
      if ((severityOrder[anomaly.severity] || 0) < minOrder) continue;

      // Add to log
      alertLog.unshift({ ...anomaly, notified: true, loggedAt: new Date() });
      if (alertLog.length > MAX_LOG) alertLog.pop();

      // Send notifications
      const notifResult = await dispatchNotifications(anomaly);
      console.log(`[Alert Engine] 📤 Dispatched ${anomaly.type}:`, JSON.stringify(notifResult));

      // Send WhatsApp alert
      if (isWhatsAppConfigured()) {
        const waResult = await sendWhatsAppAlert(anomaly, false);
        console.log(`[Alert Engine] 📱 WhatsApp: ${JSON.stringify(waResult)}`);
      }
    }

    if (result.anomalies.length === 0) {
      console.log("[Alert Engine] ✅ No anomalies — system healthy");
    }
  } catch (err) {
    console.error("[Alert Engine] Scheduled run failed:", err.message);
  } finally {
    isRunning = false;
  }
}

// Start cron: every 2 minutes
cron.schedule("*/2 * * * *", runScheduledAnalysis);
// Run once immediately on startup (after 10s delay for baseline warmup)
setTimeout(runScheduledAnalysis, 10000);

// ── Routes ────────────────────────────────────────────────────────────────────

// Get VAPID public key for browser push registration
router.get("/vapid-key", (req, res) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

// Register browser push subscription
router.post("/subscribe", (req, res) => {
  const subscription = req.body;
  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: "Invalid subscription" });
  }
  pushSubscriptions.add(subscription);
  console.log(`[Push] New subscriber. Total: ${pushSubscriptions.size}`);
  res.json({ success: true, subscribers: pushSubscriptions.size });
});

// Remove subscription
router.delete("/unsubscribe", (req, res) => {
  const { endpoint } = req.body;
  for (const sub of pushSubscriptions) {
    if (sub.endpoint === endpoint) {
      pushSubscriptions.delete(sub);
      break;
    }
  }
  res.json({ success: true, subscribers: pushSubscriptions.size });
});

// Manually trigger ML analysis
router.get("/run", async (req, res) => {
  try {
    const result = await runMLAnalysis();
    lastAnalysis = result;
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get ML baseline stats + last analysis
router.get("/status", (req, res) => {
  res.json({
    baseline: getBaselineStats(),
    lastAnalysis: lastAnalysis ? {
      metrics: lastAnalysis.metrics,
      anomalyCount: lastAnalysis.anomalies?.length || 0,
      anomalies: lastAnalysis.anomalies || [],
      baselineSize: lastAnalysis.baselineSize,
      timestamp: lastAnalysis.timestamp,
    } : null,
    subscribers: pushSubscriptions.size,
    config: { ...notifConfig, teamsWebhookUrl: notifConfig.teamsWebhookUrl ? "configured" : "not set", alertEmailTo: notifConfig.alertEmailTo || "not set" },
    isRunning,
  });
});

// Get alert log
router.get("/log", (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  res.json(alertLog.slice(0, limit));
});

// Update notification config
router.post("/config", (req, res) => {
  const { teamsWebhookUrl, alertEmailTo, minSeverity, enabled } = req.body;
  if (teamsWebhookUrl !== undefined) {
    notifConfig.teamsWebhookUrl = teamsWebhookUrl;
    process.env.TEAMS_WEBHOOK_URL = teamsWebhookUrl;
  }
  if (alertEmailTo !== undefined) {
    notifConfig.alertEmailTo = alertEmailTo;
    process.env.ALERT_EMAIL_TO = alertEmailTo;
  }
  if (minSeverity !== undefined) notifConfig.minSeverity = minSeverity;
  if (enabled !== undefined) notifConfig.enabled = enabled;
  res.json({ success: true, config: notifConfig });
});

// Get config
router.get("/config", (req, res) => {
  res.json({
    ...notifConfig,
    teamsWebhookUrl: notifConfig.teamsWebhookUrl ? "configured" : "",
    alertEmailTo: notifConfig.alertEmailTo,
  });
});

// Send test notification
router.post("/test", async (req, res) => {
  const testAnomaly = {
    id: `test-${Date.now()}`,
    type: "TEST_NOTIFICATION",
    severity: req.body.severity || "warning",
    title: "🧪 Test Alert — NexGen APIM",
    message: "This is a test notification from the AI Anomaly Detection Engine. If you received this, notifications are working correctly.",
    metric: "test",
    value: 42,
    zScore: "3.14",
    baseline: 10,
    trend: "stable",
    timestamp: new Date(),
    confidence: "100%",
  };

  // Force send (bypass dedup)
  const { sendBrowserPush, sendTeamsNotification, sendEmailNotification } = require("../services/notificationService");
  const [push, teams, email] = await Promise.allSettled([
    sendBrowserPush(testAnomaly),
    sendTeamsNotification(testAnomaly),
    sendEmailNotification(testAnomaly),
  ]);

  res.json({
    push:  push.status  === "fulfilled" ? push.value  : { error: push.reason?.message },
    teams: teams.status === "fulfilled" ? teams.value : { error: teams.reason?.message },
    email: email.status === "fulfilled" ? email.value : { error: email.reason?.message },
  });
});

// ── WhatsApp Status ───────────────────────────────────────────────────────────
router.get("/whatsapp-status", (req, res) => {
  res.json({
    configured: isWhatsAppConfigured(),
    recipients: getRecipients().map(n => n.replace(/(\+\d{2})\d+(\d{4})/, "$1****$2")), // mask middle digits
    phoneId: process.env.WHATSAPP_PHONE_ID ? "configured" : "not set",
  });
});

// ── WhatsApp Config (save to .env file for persistence) ──────────────────────
router.post("/whatsapp-config", async (req, res) => {
  const { token, phoneId, recipients } = req.body;

  // Update runtime env immediately
  if (token)      process.env.WHATSAPP_TOKEN      = token;
  if (phoneId)    process.env.WHATSAPP_PHONE_ID   = phoneId;
  if (recipients) process.env.WHATSAPP_RECIPIENTS = recipients;

  // Persist to .env file so it survives restarts
  try {
    const fs   = require("fs");
    const path = require("path");
    const envPath = path.join(__dirname, "../.env");

    let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";

    const updates = {};
    if (token)      updates["WHATSAPP_TOKEN"]      = token;
    if (phoneId)    updates["WHATSAPP_PHONE_ID"]   = phoneId;
    if (recipients) updates["WHATSAPP_RECIPIENTS"] = recipients;

    // Update or append each key
    for (const [key, value] of Object.entries(updates)) {
      const regex = new RegExp(`^${key}=.*$`, "m");
      if (regex.test(envContent)) {
        envContent = envContent.replace(regex, `${key}=${value}`);
      } else {
        envContent += `\n${key}=${value}`;
      }
    }

    fs.writeFileSync(envPath, envContent, "utf8");
    console.log(`[WhatsApp Config] ✅ Saved to .env: ${Object.keys(updates).join(", ")}`);
  } catch (err) {
    console.error("[WhatsApp Config] ⚠ Could not write .env:", err.message);
    // Still works in-memory even if file write fails
  }

  res.json({
    success: true,
    configured: isWhatsAppConfigured(),
    recipients: getRecipients().length,
    persisted: true,
    message: `Configuration saved. WhatsApp alerts will now be sent automatically for CRITICAL ML alerts.`,
  });
});

// ── WhatsApp Test ─────────────────────────────────────────────────────────────
router.post("/whatsapp-test", async (req, res) => {
  const { number } = req.body;
  if (!number) return res.status(400).json({ error: "number required (e.g. +1234567890)" });
  if (!isWhatsAppConfigured()) {
    return res.status(400).json({ error: "WhatsApp not configured. Set WHATSAPP_TOKEN, WHATSAPP_PHONE_ID, WHATSAPP_RECIPIENTS in .env" });
  }
  try {
    const result = await sendWhatsAppTest(number);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.error?.message || err.message });
  }
});

// ── WhatsApp Send ML Alert manually ──────────────────────────────────────────
router.post("/whatsapp-send-alert", async (req, res) => {
  const alert = req.body;
  if (!alert) return res.status(400).json({ error: "Alert data required" });
  if (!isWhatsAppConfigured()) {
    return res.status(400).json({ error: "WhatsApp not configured" });
  }
  try {
    const result = await sendWhatsAppAlert(alert, true);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── AI status ─────────────────────────────────────────────────────────────────
router.get("/ai-status", (req, res) => {
  res.json({ configured: false, message: "AI feature is disabled. Using ML-only mode." });
});

module.exports = router;
