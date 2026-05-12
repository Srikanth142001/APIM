/**
 * Azure Token Manager — auto-refreshing OAuth2 tokens for Azure APIs
 * Uses client_credentials grant with Service Principal
 * Scopes:
 *   - management: https://management.azure.com/.default
 *   - loganalytics: https://api.loganalytics.io/.default
 * Caches tokens, refreshes 5 min before expiry
 */
const axios = require("axios");

class AzureTokenManager {
  constructor() {
    this.tokens = {};
  }

  async getToken(tenantId, clientId, clientSecret, scope) {
    const key = `${tenantId}:${scope}`;
    const cached = this.tokens[key];
    
    // Return cached token if still valid (with 5min buffer)
    if (cached && cached.expiresAt > Date.now() + 300000) {
      return cached.token;
    }

    // Fetch new token
    try {
      const response = await axios.post(
        `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
        new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: clientId,
          client_secret: clientSecret,
          scope
        }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );

      this.tokens[key] = {
        token: response.data.access_token,
        expiresAt: Date.now() + (response.data.expires_in * 1000)
      };

      return this.tokens[key].token;
    } catch (error) {
      console.error(`[AzureTokenManager] Failed to get token for ${scope}:`, error.message);
      throw error;
    }
  }
}

module.exports = new AzureTokenManager();
