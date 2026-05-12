const axios = require("axios");
const https = require("https");

const agent = new https.Agent({ rejectUnauthorized: false });

// Dedicated axios instance with 3-minute timeout for heavy KQL queries
const proxy = axios.create({
  httpsAgent: agent,
  timeout: 180_000, // 3 minutes
});

/**
 * Query App Insights with automatic retry on 504/503/429.
 * Retries up to 2 times with 4-second back-off.
 * @param {string} query - KQL query
 * @param {string} appId - App Insights Application ID
 * @param {string} apiKey - App Insights API Key
 * @param {number} retries - Number of retries (default 2)
 */
async function queryAppInsights(query, appId, apiKey, retries = 2) {
  const URL = `https://api.applicationinsights.azure.com/v1/apps/${appId}/query`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await proxy.post(URL, { query }, {
        headers: { "x-api-key": apiKey },
      });
      return response.data.tables[0]?.rows || [];
    } catch (err) {
      const status = err.response?.status;
      const isRetryable = status === 504 || status === 503 || status === 429 || !status;
      if (isRetryable && attempt < retries) {
        const wait = (attempt + 1) * 4000; // 4s, 8s
        console.warn(`   ⚠️  [AppInsights] ${status || "timeout"} on attempt ${attempt + 1}/${retries + 1} — retrying in ${wait / 1000}s...`);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      throw err;
    }
  }
}

module.exports = { queryAppInsights };
