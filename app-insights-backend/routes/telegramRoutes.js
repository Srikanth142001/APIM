/**
 * Telegram Alert Routes
 * GET  /api/telegram/config   — get current config (token masked)
 * POST /api/telegram/config   — save bot token + chat ID
 * POST /api/telegram/test     — send a test message
 * POST /api/telegram/send     — send a specific alert
 * GET  /api/telegram/status   — connection status
 */
const express = require("express");
const router  = express.Router();
const {
  getConfig, setConfig, isConfigured,
  sendTelegram, sendTelegramAlert, sendTelegramSummary,
} = require("../services/telegramService");

// GET /api/telegram/config
router.get("/config", (req, res) => {
  const cfg = getConfig();
  res.json({
    configured: isConfigured(),
    enabled:     cfg.enabled,
    chatId:      cfg.chatId,
    minSeverity: cfg.minSeverity,
    // Mask token — only show last 6 chars
    botToken: cfg.botToken
      ? `${"*".repeat(Math.max(0, cfg.botToken.length - 6))}${cfg.botToken.slice(-6)}`
      : "",
  });
});

// POST /api/telegram/config
router.post("/config", (req, res) => {
  const { botToken, chatId, enabled, minSeverity } = req.body || {};
  const update = {};
  if (botToken !== undefined) update.botToken = botToken;
  if (chatId   !== undefined) update.chatId   = String(chatId);
  if (enabled  !== undefined) update.enabled  = Boolean(enabled);
  if (minSeverity !== undefined) update.minSeverity = minSeverity;
  setConfig(update);
  res.json({ ok: true, configured: isConfigured() });
});

// POST /api/telegram/test
router.post("/test", async (req, res) => {
  if (!isConfigured()) {
    return res.status(400).json({ error: "Telegram not configured. Set botToken and chatId first." });
  }
  try {
    await sendTelegram(
      `✅ <b>MoMo Insights — Telegram Connected</b>\n\nYour alert channel is working correctly.\n⏰ ${new Date().toLocaleString("en-GB", { timeZone: "UTC", hour12: false })} UTC`
    );
    res.json({ ok: true, message: "Test message sent successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/telegram/send  — send a specific alert object
router.post("/send", async (req, res) => {
  const { alert, comparison } = req.body || {};
  if (!alert) return res.status(400).json({ error: "alert object required" });
  try {
    const result = await sendTelegramAlert(alert, comparison);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/telegram/status
router.get("/status", async (req, res) => {
  if (!isConfigured()) {
    return res.json({ connected: false, reason: "Not configured" });
  }
  try {
    const cfg = getConfig();
    const r = await require("axios").get(
      `https://api.telegram.org/bot${cfg.botToken}/getMe`,
      { timeout: 8000 }
    );
    res.json({
      connected: true,
      botName:   r.data?.result?.username,
      chatId:    cfg.chatId,
    });
  } catch (err) {
    res.json({ connected: false, reason: err.message });
  }
});

module.exports = router;
