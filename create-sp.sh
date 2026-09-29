#!/bin/sh
# ═══════════════════════════════════════════════════════════════════════════════
# Create Service Principal for Azure Monitor / Log Analytics / App Insights
# Saves credentials to /app/shared/sp-credentials.json
# ═══════════════════════════════════════════════════════════════════════════════

SP_FILE="/app/shared/sp-credentials.json"
SP_NAME="apim-monitor-sp"

echo "═══════════════════════════════════════════════════"
echo " Creating Service Principal: $SP_NAME"
echo "═══════════════════════════════════════════════════"

# Get current subscription
SUB_ID=$(az account show --query id -o tsv 2>/dev/null)
TENANT_ID=$(az account show --query tenantId -o tsv 2>/dev/null)

if [ -z "$SUB_ID" ]; then
  echo "ERROR: Not logged in. Please run 'az login' first."
  exit 1
fi

echo "Subscription: $SUB_ID"
echo "Tenant:       $TENANT_ID"
echo ""

# Check if SP already exists
EXISTING=$(az ad sp list --display-name "$SP_NAME" --query '[0].appId' -o tsv 2>/dev/null)
if [ -n "$EXISTING" ]; then
  echo "INFO: Service Principal '$SP_NAME' already exists (appId: $EXISTING)"
  echo "INFO: Creating new password for existing SP..."
  
  # Reset credentials
  SP_JSON=$(az ad sp credential reset --id "$EXISTING" -o json 2>&1)
else
  echo "INFO: Creating new Service Principal..."
  SP_JSON=$(az ad sp create-for-rbac \
    --name "$SP_NAME" \
    --role "Reader" \
    --scopes "/subscriptions/${SUB_ID}" \
    -o json 2>&1)
fi

if echo "$SP_JSON" | grep -q '"appId"'; then
  APP_ID=$(echo "$SP_JSON" | grep -o '"appId": *"[^"]*"' | head -1 | cut -d'"' -f4)
  PASSWORD=$(echo "$SP_JSON" | grep -o '"password": *"[^"]*"' | head -1 | cut -d'"' -f4)

  echo ""
  echo "✓ Service Principal created successfully!"
  echo ""
  echo "┌─────────────────────────────────────────────────┐"
  echo "│  Tenant ID:     $TENANT_ID"
  echo "│  Client ID:     $APP_ID"
  echo "│  Client Secret: $PASSWORD"
  echo "│  Subscription:  $SUB_ID"
  echo "└─────────────────────────────────────────────────┘"
  echo ""

  # Assign Log Analytics Reader role
  echo "Assigning Log Analytics Reader role..."
  az role assignment create \
    --assignee "$APP_ID" \
    --role "Log Analytics Reader" \
    --scope "/subscriptions/${SUB_ID}" \
    -o none 2>/dev/null && echo "✓ Log Analytics Reader assigned" || echo "⚠ Could not assign Log Analytics Reader (may already exist)"

  # Assign Monitoring Reader role (for App Insights)
  az role assignment create \
    --assignee "$APP_ID" \
    --role "Monitoring Reader" \
    --scope "/subscriptions/${SUB_ID}" \
    -o none 2>/dev/null && echo "✓ Monitoring Reader assigned" || echo "⚠ Could not assign Monitoring Reader (may already exist)"

  # Save to shared file
  cat > "$SP_FILE" <<EOF
{
  "tenantId":      "$TENANT_ID",
  "clientId":      "$APP_ID",
  "clientSecret":  "$PASSWORD",
  "subscriptionId": "$SUB_ID",
  "spName":        "$SP_NAME",
  "createdAt":     "$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
}
EOF
  echo ""
  echo "✓ Credentials saved to $SP_FILE"
  echo "  Use the 'Configure Grafana' button to auto-provision the data source."

else
  echo "ERROR: Failed to create Service Principal"
  echo "$SP_JSON"
  exit 1
fi
