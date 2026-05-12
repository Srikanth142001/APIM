const axios = require("axios");
const https = require("https");
const crypto = require("crypto");

const agent = new https.Agent({ rejectUnauthorized: false });

// Dedicated axios instance with 3-minute timeout for heavy KQL queries
const proxy = axios.create({
  httpsAgent: agent,
  timeout: 180_000, // 3 minutes — Azure App Insights can be slow on 80-day scans
});

/**
 * Query App Insights with automatic retry on 504/503/429.
 * Retries up to 2 times with 4-second back-off.
 */
async function queryAppInsights(query, retries = 2) {
  const APP_ID  = process.env.APP_INSIGHTS_APP_ID;
  const API_KEY = process.env.APP_INSIGHTS_API_KEY;
  const URL     = `https://api.applicationinsights.azure.com/v1/apps/${APP_ID}/query`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await proxy.post(URL, { query }, {
        headers: { "x-api-key": API_KEY },
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

async function queryLogAnalytics(query, workspaceId, sharedKey) {
    console.log(sharedKey)
  const date = new Date().toUTCString();
  const jsonQuery = JSON.stringify({ query });
  const contentLength = Buffer.byteLength(jsonQuery, "utf8");

  const stringToSign =
    "POST\n" +
    contentLength + "\n" +
    "application/json\n" +
    "x-ms-date:" + date + "\n" +
    "/api/logs";

  const decodedKey = Buffer.from(sharedKey, "base64");
  const encodedHash = crypto
    .createHmac("sha256", decodedKey)
    .update(stringToSign, "utf8")
    .digest("base64");

  const authorization = `SharedKey ${workspaceId}:${encodedHash}`;

  const response = await proxy.post(
    LOG_ANALYTICS_URL,
    jsonQuery,
    {
      headers: {
        "Content-Type": "application/json",
        "Authorization": process.env.LOG_ANALYTICS_AUTH_TOKEN,
        "Log-Type": "CustomLogs",
        "x-ms-date": date,
        "time-generated-field": "",
      }
    }
  );
  console.log(response)
  return response.data;

  
}
module.exports = { queryAppInsights, queryLogAnalytics };
