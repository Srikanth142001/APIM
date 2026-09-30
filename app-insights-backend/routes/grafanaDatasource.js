/**
 * Grafana JSON Datasource Backend
 * Implements the Grafana SimpleJSON / JSON API protocol so our backend
 * acts as a native Grafana datasource.
 *
 * Static API key: nexgen-grafana-ds-2024
 * Grafana sends this in the X-Grafana-Token header (configured in provisioning).
 * Override via GRAFANA_DS_API_KEY env var.
 *
 * Plugin used: marcusolsson-json-datasource (auto-installed in Dockerfile)
 * Grafana calls these endpoints:
 *   GET  /api/grafana/              → health check
 *   POST /api/grafana/metrics       → list available metrics/targets
 *   POST /api/grafana/query         → execute query, return time-series or table
 *   POST /api/grafana/variable      → variable/template query
 *   POST /api/grafana/tag-keys      → tag keys for ad-hoc filters
 *   POST /api/grafana/tag-values    → tag values for a key
 *
 * Supported targets (metric names):
 *   appinsights:requests_rate       — request rate over time
 *   appinsights:failure_rate        — failure rate over time
 *   appinsights:response_time_p95   — p95 response time over time
 *   appinsights:top_failing_ops     — table: top failing operations
 *   appinsights:exceptions          — exception count over time
 *   loganalytics:<KQL>              — run raw KQL against Log Analytics workspace
 */

const express = require("express");
const axios   = require("axios");
const https   = require("https");
const fs      = require("fs");
const router  = express.Router();

const agent = new https.Agent({ rejectUnauthorized: false });

// ── Static API key for Grafana datasource auth ────────────────────────────────
// Default: nexgen-grafana-ds-2024
// Override: set GRAFANA_DS_API_KEY env var
const GRAFANA_DS_KEY = process.env.GRAFANA_DS_API_KEY || "nexgen-grafana-ds-2024";

// ── Auth middleware ───────────────────────────────────────────────────────────
function requireDsKey(req, res, next) {
  // Health check bypass — Grafana tests GET / without a key first
  if (req.method === "GET" && req.path === "/") return next();

  const key = req.headers["x-grafana-token"]
           || req.headers["authorization"]?.replace("Bearer ", "")
           || req.query.apiKey;

  if (key !== GRAFANA_DS_KEY) {
    return res.status(401).json({ error: "Invalid datasource API key" });
  }
  next();
}

router.use(requireDsKey);

const agent = new https.Agent({ rejectUnauthorized: false });

// ── Helpers ───────────────────────────────────────────────────────────────────
function getAppInsightsHeaders() {
  return {
    "x-api-key": process.env.APP_INSIGHTS_API_KEY || "",
    "Content-Type": "application/json",
  };
}

function getLogAnalyticsToken() {
  try {
    const TOKEN_FILE = "/app/shared/tokens.json";
    if (fs.existsSync(TOKEN_FILE)) {
      const d = JSON.parse(fs.readFileSync(TOKEN_FILE, "utf8"));
      if (d.logAnalytics?.token && d.logAnalytics?.status === "ok") {
        return d.logAnalytics.token;
      }
    }
  } catch {}
  const t = process.env.LOG_ANALYTICS_AUTH_TOKEN;
  if (t) return t.startsWith("Bearer ") ? t : `Bearer ${t}`;
  return null;
}

// Convert ms timestamps to ISO for App Insights
function toIso(ms) { return new Date(ms).toISOString(); }

// Parse Grafana time range
function parseRange(range) {
  const from = range?.from ? new Date(range.from).getTime() : Date.now() - 3600000;
  const to   = range?.to   ? new Date(range.to).getTime()   : Date.now();
  return { from, to, fromIso: toIso(from), toIso: toIso(to) };
}

// App Insights KQL query
async function queryAppInsights(kql, fromIso, toIso) {
  const appId = process.env.APP_INSIGHTS_APP_ID;
  if (!appId) throw new Error("APP_INSIGHTS_APP_ID not configured");
  const url = `https://api.applicationinsights.io/v1/apps/${appId}/query`;
  const { data } = await axios.post(
    url,
    { query: kql, timespan: `${fromIso}/${toIso}` },
    { headers: getAppInsightsHeaders(), httpsAgent: agent, timeout: 60000 }
  );
  return data.tables?.[0] || { columns: [], rows: [] };
}

// Log Analytics KQL query
async function queryLogAnalytics(kql, fromIso, toIso) {
  const workspaceId = process.env.LOG_ANALYTICS_WORKSPACE_ID;
  if (!workspaceId) throw new Error("LOG_ANALYTICS_WORKSPACE_ID not configured");
  const token = getLogAnalyticsToken();
  if (!token) throw new Error("No Log Analytics token available. Run az login from the Config tab.");
  const url = `https://api.loganalytics.io/v1/workspaces/${workspaceId}/query`;
  const { data } = await axios.post(
    url,
    { query: kql, timespan: `${fromIso}/${toIso}` },
    { headers: { Authorization: token, "Content-Type": "application/json" }, httpsAgent: agent, timeout: 60000 }
  );
  return data.tables?.[0] || { columns: [], rows: [] };
}

// Convert a table with timestamp + value columns to Grafana time-series format
function tableToTimeSeries(table, tsCol, valCol, name) {
  const ci = (n) => table.columns.findIndex(c => c.name === n);
  const ti = ci(tsCol), vi = ci(valCol);
  if (ti < 0 || vi < 0) return [];
  const datapoints = table.rows.map(r => [
    parseFloat(r[vi]) || 0,
    new Date(r[ti]).getTime(),
  ]);
  return [{ target: name, datapoints }];
}

// Convert a table result to Grafana table format
function tableToGrafanaTable(table, name) {
  return [{
    type:    "table",
    name,
    columns: table.columns.map(c => ({ text: c.name, type: c.type === "real" || c.type === "long" ? "number" : "string" })),
    rows:    table.rows,
  }];
}

// ── Available metrics ─────────────────────────────────────────────────────────
const METRICS = [
  { value: "appinsights:requests_rate",     label: "App Insights — Request Rate",       type: "timeseries" },
  { value: "appinsights:failure_rate",      label: "App Insights — Failure Rate",        type: "timeseries" },
  { value: "appinsights:response_time_p95", label: "App Insights — Response Time P95",   type: "timeseries" },
  { value: "appinsights:exceptions",        label: "App Insights — Exception Count",      type: "timeseries" },
  { value: "appinsights:dependency_failures",label: "App Insights — Dependency Failures", type: "timeseries" },
  { value: "appinsights:top_failing_ops",   label: "App Insights — Top Failing Ops (table)", type: "table" },
  { value: "appinsights:top_slow_ops",      label: "App Insights — Top Slow Operations (table)", type: "table" },
  { value: "appinsights:custom_kql",        label: "App Insights — Custom KQL",          type: "timeseries" },
  { value: "loganalytics:custom_kql",       label: "Log Analytics — Custom KQL",          type: "timeseries" },
];

// ── KQL templates per metric ──────────────────────────────────────────────────
async function executeMetric(target, range) {
  const { fromIso, toIso: toI } = range;
  const { metric, kql: customKql } = target;

  switch (metric) {
    case "appinsights:requests_rate": {
      const t = await queryAppInsights(
        `requests | summarize count() by bin(timestamp, 5m) | order by timestamp asc`, fromIso, toI
      );
      return tableToTimeSeries(t, "timestamp", "count_", "Request Rate");
    }
    case "appinsights:failure_rate": {
      const t = await queryAppInsights(
        `requests | where success == false | summarize count() by bin(timestamp, 5m) | order by timestamp asc`, fromIso, toI
      );
      return tableToTimeSeries(t, "timestamp", "count_", "Failure Rate");
    }
    case "appinsights:response_time_p95": {
      const t = await queryAppInsights(
        `requests | summarize p95=percentile(duration,95) by bin(timestamp, 5m) | order by timestamp asc`, fromIso, toI
      );
      return tableToTimeSeries(t, "timestamp", "p95", "P95 Response Time (ms)");
    }
    case "appinsights:exceptions": {
      const t = await queryAppInsights(
        `exceptions | summarize count() by bin(timestamp, 5m) | order by timestamp asc`, fromIso, toI
      );
      return tableToTimeSeries(t, "timestamp", "count_", "Exceptions");
    }
    case "appinsights:dependency_failures": {
      const t = await queryAppInsights(
        `dependencies | where success == false | summarize count() by bin(timestamp, 5m) | order by timestamp asc`, fromIso, toI
      );
      return tableToTimeSeries(t, "timestamp", "count_", "Dependency Failures");
    }
    case "appinsights:top_failing_ops": {
      const t = await queryAppInsights(
        `requests | where success == false | summarize failures=count() by operation_Name, resultCode | order by failures desc | take 20`, fromIso, toI
      );
      return tableToGrafanaTable(t, "Top Failing Operations");
    }
    case "appinsights:top_slow_ops": {
      const t = await queryAppInsights(
        `requests | summarize p95=round(percentile(duration,95),1), count=count() by operation_Name | order by p95 desc | take 20`, fromIso, toI
      );
      return tableToGrafanaTable(t, "Top Slow Operations");
    }
    case "appinsights:custom_kql": {
      if (!customKql) return [];
      const t = await queryAppInsights(customKql, fromIso, toI);
      // Auto-detect: if has timestamp column → time-series, else → table
      const hasTs = t.columns?.some(c => c.name === "timestamp");
      const hasCount = t.columns?.some(c => c.name === "count_" || c.name.startsWith("count"));
      if (hasTs && hasCount) {
        const valCol = t.columns.find(c => c.name !== "timestamp")?.name || "count_";
        return tableToTimeSeries(t, "timestamp", valCol, "Custom KQL");
      }
      return tableToGrafanaTable(t, "Custom KQL");
    }
    case "loganalytics:custom_kql": {
      if (!customKql) return [];
      const t = await queryLogAnalytics(customKql, fromIso, toI);
      const hasTs = t.columns?.some(c => c.name === "TimeGenerated");
      const valCol = t.columns?.find(c => c.name !== "TimeGenerated" && (c.type === "real" || c.type === "long" || c.type === "int"))?.name;
      if (hasTs && valCol) {
        return tableToTimeSeries(t, "TimeGenerated", valCol, "Log Analytics");
      }
      return tableToGrafanaTable(t, "Log Analytics");
    }
    default:
      return [];
  }
}

// ── Routes ────────────────────────────────────────────────────────────────────

// Health check — Grafana tests this on datasource save
router.get("/", (req, res) => res.status(200).send("OK"));

// Metric finder — populates the metric dropdown in Grafana panel editor
router.post("/metrics", (req, res) => {
  res.json(METRICS.map(m => ({ value: m.value, label: m.label })));
});

// Metric payload options — used for metric-specific options like "kql" field
router.post("/metric-payload-options", (req, res) => {
  res.json([]);
});

// Main query endpoint — Grafana sends targets here
router.post("/query", async (req, res) => {
  try {
    const { targets, range } = req.body;
    if (!targets?.length) return res.json([]);

    const parsedRange = parseRange(range);
    const results = [];

    for (const t of targets) {
      if (t.hide) continue;
      // target.metric comes from the JSON datasource "metric" field
      // target.payload.kql comes from the "payload" JSON field
      const metric = t.metric || t.target || "";
      const kql    = t.payload?.kql || t.data?.kql || "";
      try {
        const data = await executeMetric({ metric, kql }, parsedRange);
        results.push(...data);
      } catch (e) {
        // Return error series so Grafana shows it inline
        results.push({ target: `ERROR: ${e.message}`, datapoints: [] });
      }
    }

    res.json(results);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Variable query — for Grafana template variables
router.post("/variable", async (req, res) => {
  try {
    const kql = req.body?.payload?.kql || req.body?.target || "";
    if (!kql) return res.json([]);
    const { fromIso, toIso: toI } = parseRange(req.body.range);
    const t = await queryAppInsights(kql, fromIso, toI);
    const values = t.rows.map(r => ({ __text: String(r[0]), __value: String(r[0]) }));
    res.json(values);
  } catch (e) {
    res.json([]);
  }
});

// Tag keys — for ad-hoc filters
router.post("/tag-keys", (req, res) => {
  res.json([
    { type: "string", text: "operation_Name" },
    { type: "string", text: "resultCode" },
    { type: "string", text: "success" },
  ]);
});

// Tag values — for ad-hoc filter values
router.post("/tag-values", async (req, res) => {
  const key = req.body?.key;
  if (!key) return res.json([]);
  const now = Date.now();
  const fromIso = new Date(now - 3600000).toISOString();
  const toIso   = new Date(now).toISOString();
  try {
    const t = await queryAppInsights(
      `requests | summarize count() by ${key} | project ${key} | take 50`,
      fromIso, toIso
    );
    res.json(t.rows.map(r => ({ text: String(r[0]) })));
  } catch {
    res.json([]);
  }
});

module.exports = router;
