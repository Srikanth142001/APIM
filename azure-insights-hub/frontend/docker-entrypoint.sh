#!/bin/sh
# Replaces placeholder values in config.js with actual runtime env vars.
# This runs AFTER the image is built, so the backend URL can be set at deploy time.

CONFIG_FILE="/usr/share/nginx/html/config.js"

# Defaults
API_PROTOCOL="${API_PROTOCOL:-http}"
API_HOSTNAME="${API_HOSTNAME:-localhost}"
API_PORT="${API_PORT:-5001}"

cat > "$CONFIG_FILE" <<EOF
window.ENV_CONFIG = {
  API_PROTOCOL: '${API_PROTOCOL}',
  API_HOSTNAME: '${API_HOSTNAME}',
  API_PORT:     '${API_PORT}'
};
EOF

echo "✅ Runtime config written:"
cat "$CONFIG_FILE"

# Start nginx
exec nginx -g "daemon off;"
