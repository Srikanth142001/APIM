#!/bin/sh
# Entrypoint for the combined single-container image.
# 1. Writes runtime config.js so the frontend knows the API is at /api (same origin)
# 2. Exports backend env vars for supervisord
# 3. Starts supervisord (which starts both nginx and node)

set -e

echo "🚀 Azure Insights Hub starting..."

# ── Write frontend config.js ──────────────────────────────────────────────────
# Since nginx proxies /api → backend, the frontend always calls /api on the same
# host/port the user opened. No need to configure a separate backend hostname.
cat > /usr/share/nginx/html/config.js << EOF
window.ENV_CONFIG = {
  API_PROTOCOL: '${API_PROTOCOL:-http}',
  API_HOSTNAME: '${API_HOSTNAME:-}',
  API_PORT:     '${API_PORT:-}'
};
EOF

echo "✅ config.js written (using same-origin /api proxy)"

# ── Pass env vars to supervisord for the backend process ─────────────────────
export JWT_SECRET="${JWT_SECRET:-change-me-in-production}"
export ADMIN_USERNAME="${ADMIN_USERNAME:-admin}"
export ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin}"
export DEFAULT_ENV_NAME="${DEFAULT_ENV_NAME:-}"
export DEFAULT_APP_INSIGHTS_APP_ID="${DEFAULT_APP_INSIGHTS_APP_ID:-}"
export DEFAULT_APP_INSIGHTS_API_KEY="${DEFAULT_APP_INSIGHTS_API_KEY:-}"
export DEFAULT_SUBSCRIPTION_ID="${DEFAULT_SUBSCRIPTION_ID:-}"
export DEFAULT_RESOURCE_GROUP="${DEFAULT_RESOURCE_GROUP:-}"

echo "✅ Environment configured"
echo "   Admin user: ${ADMIN_USERNAME}"
echo "   Default env: ${DEFAULT_ENV_NAME:-not set (add via UI)}"

# ── Start both processes via supervisord ─────────────────────────────────────
exec supervisord -c /etc/supervisord.conf
