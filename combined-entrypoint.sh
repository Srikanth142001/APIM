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

# ── Auto-provision Grafana datasources ────────────────────────────────────────
# Datasource 1: App Insights (via direct API key — no az login needed)
# Datasource 2: Log Analytics Workspace (via Service Principal OR az login token)
#
# These are written as Grafana provisioning YAMLs so Grafana loads them at startup.
# Grafana uses the grafana-azure-monitor-datasource plugin (built-in since Grafana 7+).

mkdir -p /etc/grafana/provisioning/datasources

# ── Datasource 1: App Insights via API Key ─────────────────────────────────
if [ -n "$APP_INSIGHTS_APP_ID" ] && [ -n "$APP_INSIGHTS_API_KEY" ]; then
  cat > /etc/grafana/provisioning/datasources/appinsights.yaml <<EOF
apiVersion: 1
datasources:
  - name: Application Insights
    type: grafana-azure-monitor-datasource
    access: proxy
    uid: appinsights-ds
    jsonData:
      cloudName: azuremonitor
      azureAuthType: clientsecret
      tenantId: "${AZURE_TENANT_ID:-placeholder-tenant}"
      clientId: "${AZURE_CLIENT_ID:-placeholder-client}"
      subscriptionId: "${AZURE_SUBSCRIPTION_ID:-placeholder-sub}"
      appInsightsAppId: "${APP_INSIGHTS_APP_ID}"
    secureJsonData:
      clientSecret: "${AZURE_CLIENT_SECRET:-placeholder-secret}"
      appInsightsApiKey: "${APP_INSIGHTS_API_KEY}"
    version: 1
    editable: true
EOF
  echo "✅ Grafana datasource provisioned: Application Insights (App ID: ${APP_INSIGHTS_APP_ID})"
fi

# ── Datasource 2: Log Analytics via Service Principal ─────────────────────
if [ -n "$AZURE_TENANT_ID" ] && [ -n "$AZURE_CLIENT_ID" ] && [ -n "$AZURE_CLIENT_SECRET" ]; then
  cat > /etc/grafana/provisioning/datasources/loganalytics.yaml <<EOF
apiVersion: 1
datasources:
  - name: Log Analytics
    type: grafana-azure-monitor-datasource
    access: proxy
    uid: loganalytics-ds
    jsonData:
      cloudName: azuremonitor
      azureAuthType: clientsecret
      tenantId: "${AZURE_TENANT_ID}"
      clientId: "${AZURE_CLIENT_ID}"
      subscriptionId: "${AZURE_SUBSCRIPTION_ID:-}"
      logAnalyticsDefaultWorkspace: "${LOG_ANALYTICS_WORKSPACE_ID:-}"
    secureJsonData:
      clientSecret: "${AZURE_CLIENT_SECRET}"
    version: 1
    editable: true
EOF
  echo "✅ Grafana datasource provisioned: Log Analytics (tenant: ${AZURE_TENANT_ID})"
elif [ -n "$AZURE_SUBSCRIPTION_ID" ] && [ -n "$AZURE_TENANT_ID" ]; then
  # Fallback: currentuser auth (requires az login inside container)
  cat > /etc/grafana/provisioning/datasources/loganalytics.yaml <<EOF
apiVersion: 1
datasources:
  - name: Log Analytics
    type: grafana-azure-monitor-datasource
    access: proxy
    uid: loganalytics-ds
    jsonData:
      cloudName: azuremonitor
      azureAuthType: currentuser
      subscriptionId: "${AZURE_SUBSCRIPTION_ID}"
      tenantId: "${AZURE_TENANT_ID}"
      logAnalyticsDefaultWorkspace: "${LOG_ANALYTICS_WORKSPACE_ID:-}"
    version: 1
    editable: true
EOF
  echo "✅ Grafana datasource provisioned: Log Analytics (currentuser auth — requires az login)"
else
  echo "ℹ️  Log Analytics datasource not provisioned — set AZURE_TENANT_ID + AZURE_CLIENT_ID + AZURE_CLIENT_SECRET"
  echo "   OR set AZURE_TENANT_ID + AZURE_SUBSCRIPTION_ID and run az login inside the container"
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