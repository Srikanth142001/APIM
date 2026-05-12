/**
 * Environments CRUD + test/discover endpoints
 * GET    /api/environments          — list all (masks api keys)
 * POST   /api/environments          — create new
 * PUT    /api/environments/:id      — update
 * DELETE /api/environments/:id      — delete
 * POST   /api/environments/test     — test Azure connection
 * POST   /api/environments/discover — auto-discover AKS/MySQL/LogAnalytics
 */
const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");
const axios = require("axios");
const db = require("../db");
const azureTokenManager = require("../services/azureTokenManager");

// Mask API key — show only last 4 chars
function maskKey(key) {
  if (!key || key.length <= 4) return "****";
  return "****" + key.slice(-4);
}

function rowToEnv(row, mask = true) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    tenantId: row.tenant_id,
    subscriptionId: row.subscription_id,
    resourceGroup: row.resource_group,
    appInsightsAppId: row.app_insights_app_id,
    appInsightsApiKey: mask ? maskKey(row.app_insights_api_key) : row.app_insights_api_key,
    clientId: row.client_id,
    clientSecret: mask ? (row.client_secret ? "****" + row.client_secret.slice(-4) : "") : row.client_secret,
    aksClusterName: row.aks_cluster_name,
    mysqlServerName: row.mysql_server_name,
    logAnalyticsWorkspaceId: row.log_analytics_workspace_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// GET /api/environments
router.get("/", (req, res) => {
  try {
    const rows = db.prepare("SELECT * FROM environments ORDER BY created_at DESC").all();
    res.json(rows.map(r => rowToEnv(r, true)));
  } catch (err) {
    console.error("[environments] GET error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/environments
router.post("/", (req, res) => {
  try {
    const {
      name, type = "production",
      tenantId, subscriptionId, resourceGroup,
      appInsightsAppId, appInsightsApiKey,
      clientId, clientSecret,
      aksClusterName, mysqlServerName, logAnalyticsWorkspaceId
    } = req.body;

    if (!name || !subscriptionId || !resourceGroup || !appInsightsAppId || !appInsightsApiKey) {
      return res.status(400).json({ error: "name, subscriptionId, resourceGroup, appInsightsAppId, appInsightsApiKey are required" });
    }

    const id = uuidv4();
    db.prepare(`
      INSERT INTO environments (
        id, name, type, tenant_id, subscription_id, resource_group,
        app_insights_app_id, app_insights_api_key,
        client_id, client_secret,
        aks_cluster_name, mysql_server_name, log_analytics_workspace_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, name, type, tenantId || null, subscriptionId, resourceGroup,
      appInsightsAppId, appInsightsApiKey,
      clientId || null, clientSecret || null,
      aksClusterName || null, mysqlServerName || null, logAnalyticsWorkspaceId || null
    );

    const row = db.prepare("SELECT * FROM environments WHERE id = ?").get(id);
    res.status(201).json(rowToEnv(row, true));
  } catch (err) {
    console.error("[environments] POST error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/environments/:id
router.put("/:id", (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare("SELECT * FROM environments WHERE id = ?").get(id);
    if (!existing) return res.status(404).json({ error: "Environment not found" });

    const {
      name, type,
      tenantId, subscriptionId, resourceGroup,
      appInsightsAppId, appInsightsApiKey,
      clientId, clientSecret,
      aksClusterName, mysqlServerName, logAnalyticsWorkspaceId
    } = req.body;

    // For masked fields, keep existing value if placeholder sent
    const resolvedApiKey = (appInsightsApiKey && !appInsightsApiKey.startsWith("****"))
      ? appInsightsApiKey
      : existing.app_insights_api_key;
    const resolvedClientSecret = (clientSecret && !clientSecret.startsWith("****"))
      ? clientSecret
      : existing.client_secret;

    db.prepare(`
      UPDATE environments SET
        name = ?, type = ?, tenant_id = ?, subscription_id = ?, resource_group = ?,
        app_insights_app_id = ?, app_insights_api_key = ?,
        client_id = ?, client_secret = ?,
        aks_cluster_name = ?, mysql_server_name = ?, log_analytics_workspace_id = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      name || existing.name,
      type || existing.type,
      tenantId !== undefined ? tenantId : existing.tenant_id,
      subscriptionId || existing.subscription_id,
      resourceGroup || existing.resource_group,
      appInsightsAppId || existing.app_insights_app_id,
      resolvedApiKey,
      clientId !== undefined ? clientId : existing.client_id,
      resolvedClientSecret,
      aksClusterName !== undefined ? aksClusterName : existing.aks_cluster_name,
      mysqlServerName !== undefined ? mysqlServerName : existing.mysql_server_name,
      logAnalyticsWorkspaceId !== undefined ? logAnalyticsWorkspaceId : existing.log_analytics_workspace_id,
      id
    );

    const row = db.prepare("SELECT * FROM environments WHERE id = ?").get(id);
    res.json(rowToEnv(row, true));
  } catch (err) {
    console.error("[environments] PUT error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/environments/:id
router.delete("/:id", (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare("SELECT * FROM environments WHERE id = ?").get(id);
    if (!existing) return res.status(404).json({ error: "Environment not found" });
    db.prepare("DELETE FROM environments WHERE id = ?").run(id);
    res.json({ ok: true });
  } catch (err) {
    console.error("[environments] DELETE error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/environments/test — test connection to Azure services
router.post("/test", async (req, res) => {
  const {
    appInsightsAppId, appInsightsApiKey,
    tenantId, subscriptionId, resourceGroup,
    clientId, clientSecret
  } = req.body;

  const results = {
    appInsights: "untested",
    azureMonitor: "untested",
    logAnalytics: "untested",
    errors: {}
  };

  // Test App Insights
  if (appInsightsAppId && appInsightsApiKey) {
    try {
      await axios.post(
        `https://api.applicationinsights.azure.com/v1/apps/${appInsightsAppId}/query`,
        { query: "requests | take 1" },
        { headers: { "x-api-key": appInsightsApiKey }, timeout: 10000 }
      );
      results.appInsights = "ok";
    } catch (err) {
      results.appInsights = "error";
      results.errors.appInsights = err.response?.data?.error?.message || err.message;
    }
  }

  // Test Azure Monitor (ARM)
  if (tenantId && subscriptionId && clientId && clientSecret) {
    try {
      const token = await azureTokenManager.getToken(
        tenantId, clientId, clientSecret,
        "https://management.azure.com/.default"
      );
      await axios.get(
        `https://management.azure.com/subscriptions/${subscriptionId}?api-version=2020-01-01`,
        { headers: { Authorization: `Bearer ${token}` }, timeout: 10000 }
      );
      results.azureMonitor = "ok";
    } catch (err) {
      results.azureMonitor = "error";
      results.errors.azureMonitor = err.response?.data?.error?.message || err.message;
    }

    // Test Log Analytics
    try {
      const token = await azureTokenManager.getToken(
        tenantId, clientId, clientSecret,
        "https://api.loganalytics.io/.default"
      );
      // Just verify we can get a token — actual workspace query needs workspace ID
      if (token) results.logAnalytics = "ok";
    } catch (err) {
      results.logAnalytics = "error";
      results.errors.logAnalytics = err.response?.data?.error?.message || err.message;
    }
  } else if (clientId || clientSecret) {
    results.azureMonitor = "error";
    results.logAnalytics = "error";
    results.errors.azureMonitor = "Tenant ID, Client ID, and Client Secret are all required for Service Principal auth";
  }

  res.json(results);
});

// POST /api/environments/discover — auto-discover AKS/MySQL/LogAnalytics
router.post("/discover", async (req, res) => {
  const { tenantId, subscriptionId, resourceGroup, clientId, clientSecret } = req.body;

  if (!tenantId || !subscriptionId || !resourceGroup || !clientId || !clientSecret) {
    return res.status(400).json({ error: "tenantId, subscriptionId, resourceGroup, clientId, clientSecret are required for discovery" });
  }

  try {
    const token = await azureTokenManager.getToken(
      tenantId, clientId, clientSecret,
      "https://management.azure.com/.default"
    );

    const response = await axios.get(
      `https://management.azure.com/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/resources?api-version=2021-04-01`,
      { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 }
    );

    const resources = response.data.value || [];
    const discovered = {};

    for (const resource of resources) {
      const type = resource.type?.toLowerCase();
      const name = resource.name;

      if (type === "microsoft.containerservice/managedclusters") {
        discovered.aksClusterName = name;
      } else if (type === "microsoft.dbformysql/flexibleservers" || type === "microsoft.dbformysql/servers") {
        discovered.mysqlServerName = name;
      } else if (type === "microsoft.operationalinsights/workspaces") {
        // Get workspace ID (GUID) from properties
        try {
          const wsResponse = await axios.get(
            `https://management.azure.com${resource.id}?api-version=2021-12-01-preview`,
            { headers: { Authorization: `Bearer ${token}` }, timeout: 10000 }
          );
          discovered.logAnalyticsWorkspaceId = wsResponse.data.properties?.customerId || name;
        } catch {
          discovered.logAnalyticsWorkspaceId = name;
        }
      }
    }

    res.json({ discovered, resourceCount: resources.length });
  } catch (err) {
    console.error("[environments/discover] error:", err.message);
    res.status(500).json({ error: err.response?.data?.error?.message || err.message });
  }
});

module.exports = router;
