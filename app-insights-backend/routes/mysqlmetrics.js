const express = require("express");
const axios = require("axios");
const fs = require("fs");

const router = express.Router();

const subscriptionId = process.env.AZURE_SUBSCRIPTION_ID;
const resourceGroup = process.env.AZURE_RESOURCE_GROUP;
const serverName = process.env.MYSQL_SERVER_NAME;

router.get("/", async (req, res) => {

try {

// Convert plain values like "24h","30m","1h" to ISO 8601 if needed
const rawTimespan = req.query.timespan || "PT1H";
const timespan = rawTimespan
  .replace(/^(\d+)h$/i, "PT$1H")
  .replace(/^(\d+)m$/i, "PT$1M")
  .replace(/^(\d+)d$/i, "P$1D");

let token;

if (fs.existsSync("/app/shared/log_token.txt")) {
token = "Bearer " + fs.readFileSync("/app/shared/mgmt_token.txt","utf8").trim();
}
else {
const raw = process.env.LOG_ANALYTICS_AUTH_TOKEN || "";
token = raw.startsWith("Bearer ") ? raw : "Bearer " + raw;
}

const resourceId =
`/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.DBforMySQL/flexibleServers/${serverName}`;

const url =
`https://management.azure.com${resourceId}/providers/microsoft.insights/metrics`;

const response = await axios.get(url, {
headers: {
Authorization: token
},
params: {
"api-version": "2018-01-01",
metricnames: "cpu_percent,memory_percent,network_bytes_ingress",
aggregation: "Maximum,Average,Total",
interval: "PT5M",
timespan: timespan
}
});

res.json(response.data);

}
catch(err){

console.error("Azure MySQL Metrics Error:", err.response?.data || err.message);

res.status(500).json({
error: err.response?.data || err.message
});

}

});

module.exports = router;