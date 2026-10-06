#!/bin/sh
# ═══════════════════════════════════════════════════════════════════════════════
# NexGen APIM — Combined Container Entrypoint
# Writes runtime config.js then starts both nginx and Node.js via supervisord
# ═══════════════════════════════════════════════════════════════════════════════
set -e

echo "=========================================="
echo "  NexGen APIM — Starting"
echo "=========================================="

# ── Runtime config for frontend ───────────────────────────────────────────────
# Since nginx proxies /api → backend on localhost:5000,
# the frontend uses relative /api calls — no hostname needed.
REGION=${REACT_APP_REGION_NAME:-SAN Region}
PROJECT_NAME=${PROJECT_NAME:-CCMP}
PROJECT_LOGO=${PROJECT_LOGO:-https://upload.wikimedia.org/wikipedia/commons/2/28/Cricket_Wireless_%282014%29.svg}
TOP_APIS_LIMIT=${TOP_APIS_LIMIT:-10}

# Write config.js with proper escaping for special characters
cat > /usr/share/nginx/html/config.js <<EOF
// Runtime configuration — generated at container startup
window.ENV_CONFIG = {
  API_PROTOCOL: 'http',
  API_HOSTNAME: '',
  API_PORT:     '',
  REGION_NAME:  '${REGION}',
  PROJECT_NAME: '${PROJECT_NAME}',
  PROJECT_LOGO: '${PROJECT_LOGO}',
  TOP_APIS_LIMIT: '${TOP_APIS_LIMIT}'
};
EOF

echo "✅ Frontend config.js written"
echo "   Region: ${REGION}"
echo "   Project: ${PROJECT_NAME}"
echo "   Logo: ${PROJECT_LOGO}"
echo "   Top APIs Limit: ${TOP_APIS_LIMIT}"

# ── Override Grafana admin password if GRAFANA_ADMIN_PASSWORD is set ─────────
if [ -n "$GRAFANA_ADMIN_PASSWORD" ]; then
  sed -i "s/^admin_password = .*/admin_password = ${GRAFANA_ADMIN_PASSWORD}/" /etc/grafana/grafana.ini
  echo "✅ Grafana admin password overridden from GRAFANA_ADMIN_PASSWORD"
fi

# ── Provision Grafana datasources with real env vars ──────────────────────────
# Rewrites the placeholder YAML with actual values from env vars.
# App Insights uses Azure Monitor built-in plugin (needs SP credentials).
# MySQL uses built-in mysql plugin.
GRAFANA_DS_FILE="/etc/grafana/provisioning/datasources/nexgen-backend.yaml"

# Start fresh datasource file
cat > "$GRAFANA_DS_FILE" <<'YAML_START'
apiVersion: 1
datasources:
YAML_START

# ── App Insights / Azure Monitor datasource ──────────────────────────────────
# Requires: AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_SUBSCRIPTION_ID
# Plus: APP_INSIGHTS_APP_ID, APP_INSIGHTS_API_KEY
if [ -n "$AZURE_TENANT_ID" ] && [ -n "$AZURE_CLIENT_ID" ] && [ -n "$AZURE_CLIENT_SECRET" ]; then
  cat >> "$GRAFANA_DS_FILE" <<EOF
  - name: App Insights (Azure Monitor)
    type: grafana-azure-monitor-datasource
    uid: nexgen-azure-monitor
    access: proxy
    isDefault: true
    jsonData:
      cloudName: azuremonitor
      azureAuthType: clientsecret
      tenantId: "${AZURE_TENANT_ID}"
      clientId: "${AZURE_CLIENT_ID}"
      subscriptionId: "${AZURE_SUBSCRIPTION_ID:-}"
      appInsightsAppId: "${APP_INSIGHTS_APP_ID:-}"
      logAnalyticsDefaultWorkspace: "${LOG_ANALYTICS_WORKSPACE_ID:-}"
    secureJsonData:
      clientSecret: "${AZURE_CLIENT_SECRET}"
      appInsightsApiKey: "${APP_INSIGHTS_API_KEY:-}"
    version: 1
    editable: true
EOF
  echo "✅ Grafana datasource: Azure Monitor (App Insights + Log Analytics)"
else
  echo "ℹ️  Azure Monitor datasource not provisioned — set AZURE_TENANT_ID + AZURE_CLIENT_ID + AZURE_CLIENT_SECRET"
fi

# ── MySQL datasource ──────────────────────────────────────────────────────────
# Requires: MYSQL_SERVER_NAME, MYSQL_DATABASE, MYSQL_USER, MYSQL_PASSWORD
if [ -n "$MYSQL_SERVER_NAME" ] && [ -n "$MYSQL_USER" ] && [ -n "$MYSQL_PASSWORD" ]; then
  MYSQL_PORT="${MYSQL_PORT:-3306}"
  cat >> "$GRAFANA_DS_FILE" <<EOF
  - name: MySQL
    type: mysql
    uid: nexgen-mysql
    access: proxy
    url: "${MYSQL_SERVER_NAME}:${MYSQL_PORT}"
    database: "${MYSQL_DATABASE:-}"
    user: "${MYSQL_USER}"
    secureJsonData:
      password: "${MYSQL_PASSWORD}"
    jsonData:
      maxOpenConns: 10
      maxIdleConns: 10
      connMaxLifetime: 14400
    version: 1
    editable: true
EOF
  echo "✅ Grafana datasource: MySQL (${MYSQL_SERVER_NAME})"
else
  echo "ℹ️  MySQL datasource not provisioned — set MYSQL_SERVER_NAME + MYSQL_USER + MYSQL_PASSWORD"
fi

# ── Validate required backend env vars ────────────────────────────────────────
if [ -z "$APP_INSIGHTS_APP_ID" ] || [ -z "$APP_INSIGHTS_API_KEY" ]; then
  echo "⚠️  WARNING: APP_INSIGHTS_APP_ID or APP_INSIGHTS_API_KEY not set"
  echo "   The dashboard will load but API data will not be available."
  echo "   Set these env vars when running the container."
fi

# ── Print configuration summary ───────────────────────────────────────────────
echo ""
echo "Configuration:"
echo "  Region:           ${REACT_APP_REGION_NAME:-SAN Region}"
echo "  App Insights ID:  ${APP_INSIGHTS_APP_ID:-(not set)}"
echo "  Subscription ID:  ${AZURE_SUBSCRIPTION_ID:-(not set)}"
echo "  Resource Group:   ${AZURE_RESOURCE_GROUP:-(not set)}"
echo "  AKS Cluster:      ${AKS_CLUSTER_NAME:-(not set — Infrastructure tab hidden)}"
echo "  MySQL Server:     ${MYSQL_SERVER_NAME:-(not set — MySQL tab hidden)}"
echo "  Log Analytics:    ${LOG_ANALYTICS_AUTH_TOKEN:+configured}${LOG_ANALYTICS_AUTH_TOKEN:-not set}"
echo ""
echo "  Frontend:         http://localhost:80"
echo "  Backend API:      http://localhost:5000 (internal)"
echo "  Grafana:          http://localhost:80/grafana  (viewers: auto-login | admins: use Data Sources/Alerts tabs → sign in as admin / ${GRAFANA_ADMIN_PASSWORD:-admin})"
echo "==========================================="

# ── Start all processes via supervisord ──────────────────────────────────────
exec supervisord -c /etc/supervisord.conf