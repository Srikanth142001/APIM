#!/bin/sh
# ═══════════════════════════════════════════════════════════════════════════════
# Configure Grafana Azure Monitor data source automatically
# Reads SP credentials from /app/shared/sp-credentials.json
# Uses Grafana API to provision the data source
# ═══════════════════════════════════════════════════════════════════════════════

SP_FILE="/app/shared/sp-credentials.json"
GRAFANA_URL="http://localhost:3000"
GRAFANA_USER="admin"
GRAFANA_PASS="admin"

echo "═══════════════════════════════════════════════════"
echo " Configuring Grafana Azure Monitor Data Source"
echo "═══════════════════════════════════════════════════"

# Check SP credentials file exists
if [ ! -f "$SP_FILE" ]; then
  echo "ERROR: SP credentials not found at $SP_FILE"
  echo "Please run 'Create Service Principal' first."
  exit 1
fi

# Read credentials
TENANT_ID=$(grep -o '"tenantId": *"[^"]*"' "$SP_FILE" | cut -d'"' -f4)
CLIENT_ID=$(grep -o '"clientId": *"[^"]*"' "$SP_FILE" | cut -d'"' -f4)
CLIENT_SECRET=$(grep -o '"clientSecret": *"[^"]*"' "$SP_FILE" | cut -d'"' -f4)
SUB_ID=$(grep -o '"subscriptionId": *"[^"]*"' "$SP_FILE" | cut -d'"' -f4)

if [ -z "$TENANT_ID" ] || [ -z "$CLIENT_ID" ]; then
  echo "ERROR: Invalid SP credentials in $SP_FILE"
  exit 1
fi

echo "Tenant:       $TENANT_ID"
echo "Client ID:    $CLIENT_ID"
echo "Subscription: $SUB_ID"
echo ""

# Wait for Grafana to be ready
echo "Waiting for Grafana to be ready..."
MAX_WAIT=30
i=0
while [ $i -lt $MAX_WAIT ]; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$GRAFANA_URL/api/health")
  if [ "$STATUS" = "200" ]; then
    echo "✓ Grafana is ready"
    break
  fi
  sleep 2
  i=$((i + 2))
done

if [ "$STATUS" != "200" ]; then
  echo "ERROR: Grafana is not responding at $GRAFANA_URL"
  exit 1
fi

# Check if Azure Monitor data source already exists
EXISTING=$(curl -s -u "${GRAFANA_USER}:${GRAFANA_PASS}" \
  "$GRAFANA_URL/api/datasources/name/Azure%20Monitor" 2>/dev/null)

if echo "$EXISTING" | grep -q '"id"'; then
  DS_ID=$(echo "$EXISTING" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
  echo "INFO: Azure Monitor data source already exists (id: $DS_ID)"
  echo "INFO: Updating credentials..."
  METHOD="PUT"
  DS_URL="$GRAFANA_URL/api/datasources/$DS_ID"
else
  echo "INFO: Creating new Azure Monitor data source..."
  METHOD="POST"
  DS_URL="$GRAFANA_URL/api/datasources"
fi

# Create/update the data source via Grafana API
RESPONSE=$(curl -s -X "$METHOD" \
  -H "Content-Type: application/json" \
  -u "${GRAFANA_USER}:${GRAFANA_PASS}" \
  "$DS_URL" \
  -d "{
    \"name\": \"Azure Monitor\",
    \"type\": \"grafana-azure-monitor-datasource\",
    \"access\": \"proxy\",
    \"jsonData\": {
      \"azureAuthType\": \"clientsecret\",
      \"tenantId\": \"$TENANT_ID\",
      \"clientId\": \"$CLIENT_ID\",
      \"subscriptionId\": \"$SUB_ID\",
      \"cloudName\": \"azuremonitor\"
    },
    \"secureJsonData\": {
      \"clientSecret\": \"$CLIENT_SECRET\"
    },
    \"isDefault\": true
  }")

if echo "$RESPONSE" | grep -q '"id"'; then
  echo ""
  echo "✓ Azure Monitor data source configured in Grafana!"
  echo ""
  echo "You can now:"
  echo "  1. Go to Data Visualization tab"
  echo "  2. Click 'New Dashboard'"
  echo "  3. Add a panel and select 'Azure Monitor' as data source"
  echo "  4. Query Application Insights and Log Analytics"
else
  echo "ERROR: Failed to configure Grafana data source"
  echo "$RESPONSE"
  exit 1
fi
