/**
 * Log Analytics Routes
 * Queries Azure Log Analytics workspace via the REST API.
 * Uses LOG_ANALYTICS_WORKSPACE_ID + LOG_ANALYTICS_AUTH_TOKEN (Bearer token).
 *
 * Tables available: KubePodInventory, ContainerLog, Perf, AzureDiagnostics,
 *   KubeEvents, KubeNodeInventory, ContainerInventory, InsightsMetrics, etc.
 */

const express = require("express");
const axios   = require("axios");
const https   = require("https");
const router  = express.Router();

const agent = new https.Agent({ rejectUnauthorized: false });

// POST /api/log-analytics/query
// Body: { query: string, timespan?: string }
router.post("/query", async (req, res) => {
  const { query, timespan } = req.body;

  if (!query || !query.trim()) {
    return res.status(400).json({ success: false, message: "query is required" });
  }

  const workspaceId = process.env.LOG_ANALYTICS_WORKSPACE_ID;
  const authToken   = process.env.LOG_ANALYTICS_AUTH_TOKEN;

  if (!workspaceId) {
    return res.status(503).json({
      success: false,
      message: "LOG_ANALYTICS_WORKSPACE_ID is not configured. Set this env var to enable Log Analytics queries.",
    });
  }
  if (!authToken) {
    return res.status(503).json({
      success: false,
      message: "LOG_ANALYTICS_AUTH_TOKEN is not configured. Provide a Bearer token for the Log Analytics API.",
    });
  }

  const url = `https://api.loganalytics.io/v1/workspaces/${workspaceId}/query`;

  const startTime = Date.now();
  try {
    const response = await axios.post(
      url,
      { query, timespan: timespan || "PT1H" },
      {
        headers: {
          Authorization: authToken.startsWith("Bearer ")
            ? authToken
            : `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        httpsAgent: agent,
        timeout: 120_000,
      }
    );

    const executionTime = Date.now() - startTime;
    const data = response.data;

    if (!data.tables || data.tables.length === 0) {
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
    const status  = err.response?.status;
    const azureMsg = err.response?.data?.error?.message
                  || err.response?.data?.message
                  || err.message;

    if (status === 401 || status === 403) {
      return res.status(503).json({
        success: false,
        message: `Authentication failed (${status}). Your LOG_ANALYTICS_AUTH_TOKEN may have expired. Refresh it with: az account get-access-token --resource https://api.loganalytics.io --query accessToken -o tsv`,
      });
    }

    res.status(500).json({ success: false, message: azureMsg });
  }
});

// GET /api/log-analytics/status
// Returns whether the workspace is configured
router.get("/status", (req, res) => {
  res.json({
    workspaceConfigured: !!process.env.LOG_ANALYTICS_WORKSPACE_ID,
    tokenConfigured:     !!process.env.LOG_ANALYTICS_AUTH_TOKEN,
  });
});

module.exports = router;
