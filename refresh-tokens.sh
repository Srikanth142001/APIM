#!/bin/sh
# ═══════════════════════════════════════════════════════════════════════════════
# Token Refresh Script
# Runs inside the container every 50 minutes via supervisord.
# Uses Service Principal (AZURE_CLIENT_ID + AZURE_CLIENT_SECRET + AZURE_TENANT_ID)
# to fetch fresh Bearer tokens for:
#   1. Azure Log Analytics API  (https://api.loganalytics.io)
#   2. Azure Management API     (https://management.azure.com)
# Tokens are written to /app/shared/tokens.json for the backend to read.
# ═══════════════════════════════════════════════════════════════════════════════

TOKEN_FILE="/app/shared/tokens.json"
LOG_FILE="/app/shared/token-refresh.log"
LOCK_FILE="/app/shared/token-refresh.lock"

log() {
  echo "$(date -u '+%Y-%m-%dT%H:%M:%SZ') $1" | tee -a "$LOG_FILE"
}

# Check required env vars
if [ -z "$AZURE_CLIENT_ID" ] || [ -z "$AZURE_CLIENT_SECRET" ] || [ -z "$AZURE_TENANT_ID" ]; then
  log "SKIP: AZURE_CLIENT_ID / AZURE_CLIENT_SECRET / AZURE_TENANT_ID not set — skipping token refresh"
  exit 0
fi

# Prevent concurrent runs
if [ -f "$LOCK_FILE" ]; then
  log "SKIP: Another refresh is running (lock file exists)"
  exit 0
fi
touch "$LOCK_FILE"

log "INFO: Starting token refresh for tenant $AZURE_TENANT_ID"

# ── Fetch Log Analytics token ─────────────────────────────────────────────────
LA_RESPONSE=$(curl -s -X POST \
  "https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials" \
  -d "client_id=${AZURE_CLIENT_ID}" \
  -d "client_secret=${AZURE_CLIENT_SECRET}" \
  -d "scope=https://api.loganalytics.io/.default")

LA_TOKEN=$(echo "$LA_RESPONSE" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)
LA_EXPIRES=$(echo "$LA_RESPONSE" | grep -o '"expires_in":[0-9]*' | cut -d':' -f2)

if [ -z "$LA_TOKEN" ]; then
  LA_ERROR=$(echo "$LA_RESPONSE" | grep -o '"error_description":"[^"]*"' | cut -d'"' -f4)
  log "ERROR: Failed to get Log Analytics token: $LA_ERROR"
  rm -f "$LOCK_FILE"
  exit 1
fi
log "OK: Log Analytics token acquired (expires_in: ${LA_EXPIRES}s)"

# ── Fetch Management API token ────────────────────────────────────────────────
MGMT_RESPONSE=$(curl -s -X POST \
  "https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials" \
  -d "client_id=${AZURE_CLIENT_ID}" \
  -d "client_secret=${AZURE_CLIENT_SECRET}" \
  -d "scope=https://management.azure.com/.default")

MGMT_TOKEN=$(echo "$MGMT_RESPONSE" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)
MGMT_EXPIRES=$(echo "$MGMT_RESPONSE" | grep -o '"expires_in":[0-9]*' | cut -d':' -f2)

if [ -z "$MGMT_TOKEN" ]; then
  MGMT_ERROR=$(echo "$MGMT_RESPONSE" | grep -o '"error_description":"[^"]*"' | cut -d'"' -f4)
  log "ERROR: Failed to get Management token: $MGMT_ERROR"
else
  log "OK: Management token acquired (expires_in: ${MGMT_EXPIRES}s)"
fi

# ── Write tokens to shared file ───────────────────────────────────────────────
NOW=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
cat > "$TOKEN_FILE" <<EOF
{
  "refreshedAt": "$NOW",
  "logAnalytics": {
    "token": "Bearer $LA_TOKEN",
    "expiresIn": $LA_EXPIRES,
    "status": "ok"
  },
  "management": {
    "token": "Bearer $MGMT_TOKEN",
    "expiresIn": $MGMT_EXPIRES,
    "status": "$([ -n "$MGMT_TOKEN" ] && echo 'ok' || echo 'failed')"
  }
}
EOF

log "INFO: Tokens written to $TOKEN_FILE"
rm -f "$LOCK_FILE"
exit 0
