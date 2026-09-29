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

// ── POST /api/log-analytics/az-login ─────────────────────────────────────────
// Admin-only: initiate az login --use-device-code
// Returns the device code URL so the admin can authenticate in a browser
router.post("/az-login", (req, res) => {
  const role = req.user?.role;
  if (role !== "admin") {
    return res.status(403).json({ success: false, message: "Admin only" });
  }

  const { exec } = require("child_process");

  // Run az login with device code — capture the URL from output
  // az login outputs the device code message to stderr
  const proc = exec("az login --use-device-code --output json 2>&1", { timeout: 120000 });

  let output = "";
  let deviceInfo = null;

  proc.stdout?.on("data", (data) => {
    output += data;

    // Detect device code message: "To sign in, use a web browser to open the page..."
    if (!deviceInfo && output.includes("https://microsoft.com/devicelogin")) {
      const codeMatch  = output.match(/code\s+([A-Z0-9]{8,12})/i);
      const urlMatch   = output.match(/(https:\/\/microsoft\.com\/devicelogin)/);
      if (urlMatch) {
        deviceInfo = {
          url:  urlMatch[1],
          code: codeMatch ? codeMatch[1] : null,
        };
        // Send device info immediately so admin can authenticate
        res.json({
          success:    true,
          waiting:    true,
          deviceUrl:  deviceInfo.url,
          deviceCode: deviceInfo.code,
          message:    `Open ${deviceInfo.url} and enter code: ${deviceInfo.code}`,
        });
      }
    }
  });

  proc.on("close", (code) => {
    // If we already sent response (device code), ignore
    if (res.headersSent) return;

    if (code === 0) {
      res.json({ success: true, waiting: false, message: "Login successful" });
    } else {
      res.status(500).json({ success: false, message: `az login failed: ${output}` });
    }
  });
});

// ── GET /api/log-analytics/az-login-status ───────────────────────────────────
// Check if az is currently logged in
router.get("/az-login-status", (req, res) => {
  const { exec } = require("child_process");
  exec("az account show --query '{name:name, id:id, user:user.name}' -o json 2>/dev/null", (err, stdout) => {
    if (err || !stdout.trim()) {
      return res.json({ loggedIn: false });
    }
    try {
      const account = JSON.parse(stdout);
      res.json({ loggedIn: true, account });
    } catch {
      res.json({ loggedIn: false });
    }
  });
});

// ── POST /api/log-analytics/az-run ───────────────────────────────────────────
// Polling endpoint — runs an az command synchronously and returns JSON result.
// Replaces the SSE /az-stream endpoint for better reliability.
// Allowed commands whitelist for security
const ALLOWED_COMMANDS = {
  "login":             "az login --use-device-code 2>&1",
  "account-show":      "az account show -o json 2>&1",
  "account-list":      "az account list --query '[].{name:name,id:id,isDefault:isDefault}' -o table 2>&1",
  "refresh-tokens":    "/app/refresh-tokens.sh 2>&1",
  "logout":            "az logout 2>&1",
  "create-sp":         "/app/create-sp.sh 2>&1",
  "configure-grafana": "/app/configure-grafana.sh 2>&1",
  "show-sp-info":      "az ad sp list --display-name apim-monitor-sp --query '[0].{appId:appId,displayName:displayName}' -o json 2>&1 && az account show --query '{tenantId:tenantId,subscriptionId:id}' -o json 2>&1",
};

// Track login processes to prevent duplicate runs
let activeLoginProc = null;
let loginCooldownUntil = 0;

router.post("/az-run", (req, res) => {
  const role = req.user?.role;
  if (role !== "admin") {
    return res.status(403).json({ success: false, message: "Admin only" });
  }

  const cmdKey = req.body?.cmd;
  const command = ALLOWED_COMMANDS[cmdKey];
  if (!command) {
    return res.status(400).json({ success: false, message: `Unknown command: ${cmdKey}` });
  }

  const { exec, execSync } = require("child_process");

  // Check if az is available first
  let azAvailable = false;
  try { execSync("which az", { stdio: "ignore" }); azAvailable = true; } catch {}

  if (!azAvailable && !["refresh-tokens", "create-sp", "configure-grafana"].includes(cmdKey)) {
    return res.json({
      success: false,
      output: [
        "ERROR: Azure CLI (az) is not installed in this container.",
        "Please rebuild the container image to include Azure CLI.",
        "The Dockerfile installs it via: pip3 install azure-cli",
      ].join("\n"),
      exitCode: 1,
    });
  }

  // ── Special handling for az login — interactive command ──────────────────
  // az login --use-device-code outputs the URL immediately then waits.
  // We capture the URL and return it right away, then continue in background.
  if (cmdKey === "login") {
    // Prevent duplicate login processes
    if (activeLoginProc) {
      return res.json({
        success: false,
        output: "A login process is already running. Please wait or check your browser for the device code.",
        exitCode: 1,
      });
    }
    // Cooldown: prevent rapid re-runs (MSAL "Attempted too soon" error)
    const now = Date.now();
    if (now < loginCooldownUntil) {
      const waitSec = Math.ceil((loginCooldownUntil - now) / 1000);
      return res.json({
        success: false,
        output: `Please wait ${waitSec} more seconds before trying to log in again.`,
        exitCode: 1,
      });
    }
    // Set 15s cooldown before allowing another login attempt
    loginCooldownUntil = now + 15000;

    let output = "";
    let responded = false;
    const startTime = Date.now();

    const proc = exec(command, { timeout: 300000 }); // 5 min max
    activeLoginProc = proc;

    proc.stdout?.on("data", (chunk) => { output += chunk; });
    proc.stderr?.on("data", (chunk) => { output += chunk; });

    // Check every 500ms if we have the device code URL
    // az login writes to stderr, so check combined output
    const checkInterval = setInterval(() => {
      const urlMatch  = output.match(/https:\/\/microsoft\.com\/devicelogin/i);
      const codeMatch = output.match(/[Cc]ode[:\s]+([A-Z0-9]{8,12})/);

      if (urlMatch && !responded) {
        responded = true;
        clearInterval(checkInterval);
        res.json({
          success:    true,
          exitCode:   0,
          output:     output,
          deviceUrl:  "https://microsoft.com/devicelogin",
          deviceCode: codeMatch ? codeMatch[1] : null,
          pending:    true, // tells frontend to poll az-login-status
          message:    `Open https://microsoft.com/devicelogin and enter code: ${codeMatch ? codeMatch[1] : "shown above"}`,
        });
      }

      // Fallback: if we have any output after 30s but no URL, return what we have
      if (!responded && output.length > 0 && Date.now() - startTime > 30000) {
        responded = true;
        clearInterval(checkInterval);
        res.json({ success: false, output, exitCode: 1 });
      }
    }, 500);

    proc.on("close", (code) => {
      activeLoginProc = null;
      clearInterval(checkInterval);
      if (!responded) {
        responded = true;
        res.json({ success: code === 0, output, exitCode: code ?? 0 });
      }
    });

    proc.on("error", (err) => {
      activeLoginProc = null;
      clearInterval(checkInterval);
      if (!responded) {
        responded = true;
        res.json({ success: false, output: err.message, exitCode: 1 });
      }
    });

    return; // handled above
  }

  // ── All other commands run synchronously ──────────────────────────────────
  exec(command, { timeout: 120000, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
    const output = (stdout || "") + (stderr || "");
    const exitCode = err?.code ?? 0;
    res.json({ success: exitCode === 0, output, exitCode });
  });
});

// ── POST /api/log-analytics/az-set-subscription ──────────────────────────────
router.post("/az-set-subscription", (req, res) => {
  const role = req.user?.role;
  if (role !== "admin") return res.status(403).json({ success: false, message: "Admin only" });

  const { subscriptionId } = req.body;
  if (!subscriptionId) return res.status(400).json({ success: false, message: "subscriptionId required" });

  // Validate UUID format
  if (!/^[0-9a-f-]{36}$/i.test(subscriptionId)) {
    return res.status(400).json({ success: false, message: "Invalid subscription ID format" });
  }

  const { exec } = require("child_process");
  exec(`az account set --subscription "${subscriptionId}" 2>&1`, (err, stdout, stderr) => {
    if (err) return res.status(500).json({ success: false, message: stderr || err.message });
    res.json({ success: true, message: `Subscription set to ${subscriptionId}` });
  });
});

// ── GET /api/log-analytics/subscriptions ─────────────────────────────────────
router.get("/subscriptions", (req, res) => {
  const role = req.user?.role;
  if (role !== "admin") return res.status(403).json({ success: false, message: "Admin only" });

  const { exec } = require("child_process");
  exec("az account list --query '[].{name:name,id:id,isDefault:isDefault,state:state}' -o json 2>/dev/null", (err, stdout) => {
    if (err || !stdout.trim()) return res.json({ success: false, subscriptions: [] });
    try {
      const subs = JSON.parse(stdout);
      res.json({ success: true, subscriptions: subs });
    } catch {
      res.json({ success: false, subscriptions: [] });
    }
  });
});

// ── POST /api/log-analytics/grafana-provision ─────────────────────────────────
// Admin-only: write Grafana Azure Monitor datasource provisioning file.
// Called after az login + subscription selection so Grafana picks up the datasource.
router.post("/grafana-provision", (req, res) => {
  const role = req.user?.role;
  if (role !== "admin") return res.status(403).json({ success: false, message: "Admin only" });

  const { exec } = require("child_process");

  // Get current subscription and tenant from az
  exec(
    "az account show --query '{subscriptionId:id,tenantId:tenantId}' -o json 2>/dev/null",
    (err, stdout) => {
      let subscriptionId = process.env.AZURE_SUBSCRIPTION_ID || "";
      let tenantId       = process.env.AZURE_TENANT_ID || "";

      if (!err && stdout?.trim()) {
        try {
          const account = JSON.parse(stdout);
          subscriptionId = account.subscriptionId || subscriptionId;
          tenantId       = account.tenantId || tenantId;
        } catch {}
      }

      if (!subscriptionId || !tenantId) {
        return res.status(400).json({
          success: false,
          message: "Could not determine subscription/tenant. Please ensure az login is complete and a subscription is selected.",
        });
      }

      // Build provisioning YAML for Grafana Azure Monitor datasource
      // Uses az CLI managed identity / logged-in user via "currentuser" auth
      const appInsightsId  = process.env.APP_INSIGHTS_APP_ID || "";
      const workspaceId    = process.env.LOG_ANALYTICS_WORKSPACE_ID || req.body?.workspaceId || "";
      const resourceGroup  = process.env.AZURE_RESOURCE_GROUP || "";

      const yaml = `apiVersion: 1
datasources:
  - name: Azure Monitor
    type: grafana-azure-monitor-datasource
    access: proxy
    jsonData:
      cloudName: azuremonitor
      azureAuthType: currentuser
      subscriptionId: "${subscriptionId}"
      tenantId: "${tenantId}"
      ${appInsightsId ? `appInsightsAppId: "${appInsightsId}"` : ""}
      ${workspaceId   ? `logAnalyticsDefaultWorkspace: "${workspaceId}"` : ""}
    version: 1
    editable: true
`;

      const provPath = "/etc/grafana/provisioning/datasources/azure-monitor.yaml";
      fs.writeFile(provPath, yaml, (werr) => {
        if (werr) {
          return res.status(500).json({ success: false, message: `Failed to write provisioning file: ${werr.message}` });
        }

        // Signal Grafana to reload provisioning (SIGHUP)
        exec("kill -HUP $(pgrep -f 'grafana server') 2>/dev/null || true", () => {
          res.json({
            success: true,
            message: "Azure Monitor datasource provisioned in Grafana. Grafana will reload in ~5 seconds.",
            subscriptionId,
            tenantId,
            appInsightsId: appInsightsId || "(not set)",
            workspaceId:   workspaceId   || "(not set)",
          });
        });
      });
    }
  );
});

module.exports = router;
