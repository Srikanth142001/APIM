/**
 * Log Analytics Routes
 * Queries Azure Log Analytics workspace.
 * Tokens are auto-refreshed every 50 min by /app/refresh-tokens.sh via supervisord.
 * Token file: /app/shared/tokens.json
 */

const express = require("express");
const axios   = require("axios");
const https   = require("https");
const fs      = require("fs");
const path    = require("path");
const router  = express.Router();

const agent     = new https.Agent({ rejectUnauthorized: false });
const TOKEN_FILE = "/app/shared/tokens.json";
const LOG_FILE   = "/app/shared/token-refresh.log";

// ── Helper: get token from shared file or env var ─────────────────────────────
function getToken(type) {
  // Try shared token file first (set by refresh-tokens.sh)
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      const data = JSON.parse(fs.readFileSync(TOKEN_FILE, "utf8"));
      const t = type === "management" ? data.management : data.logAnalytics;
      if (t && t.token && t.status === "ok") return t.token;
    }
  } catch {}

  // Fallback to env var (manually set)
  const envToken = process.env.LOG_ANALYTICS_AUTH_TOKEN;
  if (envToken) return envToken.startsWith("Bearer ") ? envToken : `Bearer ${envToken}`;
  return null;
}

function getTokenStatus() {
  const spConfigured = !!(
    process.env.AZURE_CLIENT_ID &&
    process.env.AZURE_CLIENT_SECRET &&
    process.env.AZURE_TENANT_ID
  );

  let fileData = null;
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      fileData = JSON.parse(fs.readFileSync(TOKEN_FILE, "utf8"));
    }
  } catch {}

  // Last 20 lines of refresh log
  let recentLogs = [];
  try {
    if (fs.existsSync(LOG_FILE)) {
      const lines = fs.readFileSync(LOG_FILE, "utf8").split("\n").filter(Boolean);
      recentLogs = lines.slice(-20);
    }
  } catch {}

  return {
    workspaceConfigured:    !!process.env.LOG_ANALYTICS_WORKSPACE_ID,
    spConfigured,
    workspaceId:            process.env.LOG_ANALYTICS_WORKSPACE_ID || null,
    tenantId:               process.env.AZURE_TENANT_ID || null,
    clientId:               process.env.AZURE_CLIENT_ID || null,
    // Don't expose secret
    tokens: fileData ? {
      refreshedAt:  fileData.refreshedAt,
      logAnalytics: { status: fileData.logAnalytics?.status, expiresIn: fileData.logAnalytics?.expiresIn },
      management:   { status: fileData.management?.status,  expiresIn: fileData.management?.expiresIn  },
    } : null,
    recentLogs,
    envTokenConfigured: !!process.env.LOG_ANALYTICS_AUTH_TOKEN,
  };
}

// ── POST /api/log-analytics/query ─────────────────────────────────────────────
router.post("/query", async (req, res) => {
  const { query, timespan } = req.body;

  if (!query?.trim()) {
    return res.status(400).json({ success: false, message: "query is required" });
  }

  const workspaceId = process.env.LOG_ANALYTICS_WORKSPACE_ID;
  if (!workspaceId) {
    return res.status(503).json({
      success: false,
      message: "LOG_ANALYTICS_WORKSPACE_ID is not configured.",
    });
  }

  const token = getToken("logAnalytics");
  if (!token) {
    return res.status(503).json({
      success: false,
      message: "No Log Analytics token available. Configure AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_TENANT_ID for auto-refresh, or set LOG_ANALYTICS_AUTH_TOKEN manually.",
    });
  }

  const url = `https://api.loganalytics.io/v1/workspaces/${workspaceId}/query`;
  const startTime = Date.now();

  try {
    const response = await axios.post(
      url,
      { query, timespan: timespan || "PT1H" },
      {
        headers: { Authorization: token, "Content-Type": "application/json" },
        httpsAgent: agent,
        timeout: 120_000,
      }
    );

    const executionTime = Date.now() - startTime;
    const data = response.data;

    if (!data.tables?.length) {
      return res.json({ success: true, tables: [], rowCount: 0, executionTime });
    }

    const tables = data.tables.map(t => ({
      name:     t.name,
      columns:  t.columns.map(c => ({ name: c.name, type: c.type })),
      rows:     t.rows,
      rowCount: t.rows.length,
    }));

    res.json({
      success: true,
      tables,
      rowCount: tables.reduce((s, t) => s + t.rowCount, 0),
      executionTime,
    });

  } catch (err) {
    const status   = err.response?.status;
    const azureMsg = err.response?.data?.error?.message || err.response?.data?.message || err.message;

    if (status === 401 || status === 403) {
      return res.status(503).json({
        success: false,
        message: `Authentication failed (${status}). Token may have expired — the container refreshes automatically every 50 minutes if Service Principal is configured.`,
      });
    }
    res.status(500).json({ success: false, message: azureMsg });
  }
});

// ── GET /api/log-analytics/status ─────────────────────────────────────────────
router.get("/status", (req, res) => {
  res.json(getTokenStatus());
});

// ── POST /api/log-analytics/refresh-now ──────────────────────────────────────
// Admin-only: trigger an immediate token refresh
router.post("/refresh-now", (req, res) => {
  const role = req.user?.role;
  if (role !== "admin") {
    return res.status(403).json({ success: false, message: "Admin only" });
  }

  const { execFile } = require("child_process");
  execFile("/app/refresh-tokens.sh", (err, stdout, stderr) => {
    if (err) {
      return res.status(500).json({ success: false, message: stderr || err.message });
    }
    res.json({ success: true, message: "Token refresh triggered", output: stdout });
  });
});

module.exports = router;
