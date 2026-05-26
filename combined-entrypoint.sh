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
echo "=========================================="

# ── Start both processes via supervisord ─────────────────────────────────────
exec supervisord -c /etc/supervisord.conf
