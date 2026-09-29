#!/bin/sh
# ═══════════════════════════════════════════════════════════════════════════════
# Token Refresh Script — uses Azure CLI session (az login was done once)
# Runs every 50 min via supervisord.
# Writes tokens to /app/shared/tokens.json for the Node.js backend to read.
# ═══════════════════════════════════════════════════════════════════════════════

TOKEN_FILE="/app/shared/tokens.json"
LOG_FILE="/app/shared/token-refresh.log"
LOCK_FILE="/app/shared/token-refresh.lock"
AZ_STATE_FILE="/app/shared/az-login-state"

log() {
  echo "$(date -u '+%Y-%m-%dT%H:%M:%SZ') $1" | tee -a "$LOG_FILE"
}

# Prevent concurrent runs
if [ -f "$LOCK_FILE" ]; then
  log "SKIP: Another refresh is running"
  exit 0
fi
touch "$LOCK_FILE"

# ── Check if az is available ───────────────────────────────────────────────────
if ! command -v az > /dev/null 2>&1; then
  log "ERROR: Azure CLI (az) not found in container"
  rm -f "$LOCK_FILE"
  exit 1
fi

# ── Check if logged in ────────────────────────────────────────────────────────
AZ_ACCOUNT=$(az account show --query id -o tsv 2>/dev/null)
if [ -z "$AZ_ACCOUNT" ]; then
  log "NOT_LOGGED_IN: Run az login from the Config tab first"
  # Write status so frontend knows
  cat > "$TOKEN_FILE" <<EOF
{
  "refreshedAt": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')",
  "loginRequired": true,
  "logAnalytics": { "status": "not_logged_in" },
  "management":   { "status": "not_logged_in" }
}
EOF
  rm -f "$LOCK_FILE"
  exit 0
fi

log "INFO: Logged in as subscription: $AZ_ACCOUNT"

# ── Get Log Analytics token ────────────────────────────────────────────────────
LA_TOKEN=$(az account get-access-token --resource https://api.loganalytics.io --query accessToken -o tsv 2>/dev/null)
if [ -z "$LA_TOKEN" ]; then
  log "ERROR: Failed to get Log Analytics token"
  LA_STATUS="failed"
  LA_EXPIRES=0
else
  LA_STATUS="ok"
  LA_EXPIRES=3300
  log "OK: Log Analytics token acquired"
fi

# ── Get Management API token ───────────────────────────────────────────────────
MGMT_TOKEN=$(az account get-access-token --resource https://management.azure.com --query accessToken -o tsv 2>/dev/null)
if [ -z "$MGMT_TOKEN" ]; then
  log "ERROR: Failed to get Management token"
  MGMT_STATUS="failed"
  MGMT_EXPIRES=0
else
  MGMT_STATUS="ok"
  MGMT_EXPIRES=3300
  log "OK: Management token acquired"
fi

# ── Write to shared file ───────────────────────────────────────────────────────
cat > "$TOKEN_FILE" <<EOF
{
  "refreshedAt": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')",
  "loginRequired": false,
  "subscription": "$AZ_ACCOUNT",
  "logAnalytics": {
    "token": "Bearer $LA_TOKEN",
    "expiresIn": $LA_EXPIRES,
    "status": "$LA_STATUS"
  },
  "management": {
    "token": "Bearer $MGMT_TOKEN",
    "expiresIn": $MGMT_EXPIRES,
    "status": "$MGMT_STATUS"
  }
}
EOF

log "INFO: Tokens written to $TOKEN_FILE"
touch "$AZ_STATE_FILE"
rm -f "$LOCK_FILE"
exit 0
