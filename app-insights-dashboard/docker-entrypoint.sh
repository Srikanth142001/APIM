#!/bin/sh
set -e

# Set default values if not provided
PORT=${PORT:-80}
REACT_APP_API_PROTOCOL=${REACT_APP_API_PROTOCOL:-http}
REACT_APP_API_HOSTNAME=${REACT_APP_API_HOSTNAME:-172.30.38.193}
REACT_APP_API_PORT=${REACT_APP_API_PORT:-5005}
REACT_APP_REGION_NAME=${REACT_APP_REGION_NAME:-SAN Region}

echo "=========================================="
echo "Starting App Insights Dashboard"
echo "=========================================="
echo "Container Port: $PORT"
echo "API Endpoint: $REACT_APP_API_PROTOCOL://$REACT_APP_API_HOSTNAME:$REACT_APP_API_PORT"
echo "Region: $REACT_APP_REGION_NAME"
echo "=========================================="

# Generate nginx config from template with environment variables
echo "Generating nginx configuration..."
envsubst '${PORT}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf

# Replace runtime config in config.js
echo "Configuring runtime environment variables..."
envsubst '${REACT_APP_API_PROTOCOL},${REACT_APP_API_HOSTNAME},${REACT_APP_API_PORT},${REACT_APP_REGION_NAME}' \
  < /usr/share/nginx/html/config.js > /usr/share/nginx/html/config.js.tmp
mv /usr/share/nginx/html/config.js.tmp /usr/share/nginx/html/config.js

# Verify the generated config
echo "Generated Nginx configuration:"
echo "------------------------------------------"
cat /etc/nginx/conf.d/default.conf
echo "------------------------------------------"

# Test nginx configuration
echo "Testing nginx configuration..."
nginx -t

echo "Starting nginx..."
echo "=========================================="

# Execute the CMD
exec "$@"
