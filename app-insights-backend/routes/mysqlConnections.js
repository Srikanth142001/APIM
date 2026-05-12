const express = require("express");
const axios = require("axios");
const fs = require("fs");

const router = express.Router();

const subscriptionId = process.env.AZURE_SUBSCRIPTION_ID;
const resourceGroup = process.env.AZURE_RESOURCE_GROUP;
const mysqlServer = process.env.MYSQL_SERVER_NAME;

// Converts shorthand like "2h", "30m", "1d" to ISO 8601 duration and a suitable interval
function parseTimespan(ts = "30m") {
  const match = ts.match(/^(\d+)(m|h|d)$/);
  if (!match) return { timespan: "PT30M", interval: "PT5M" };

  const value = parseInt(match[1]);
  const unit = match[2];

  let timespan, interval;
  if (unit === "m") {
    timespan = `PT${value}M`;
    interval = value <= 30 ? "PT1M" : "PT5M";
  } else if (unit === "h") {
    timespan = `PT${value}H`;
    interval = value <= 4 ? "PT5M" : value <= 24 ? "PT15M" : "PT1H";
  } else if (unit === "d") {
    timespan = `P${value}D`;
    interval = value <= 2 ? "PT1H" : "PT6H";
  }

  return { timespan, interval };
}

router.get("/", async (req, res) => {
  try {
    const token = "Bearer " + fs.readFileSync("/app/shared/mgmt_token.txt", "utf8").trim();

    const { timespan, interval } = parseTimespan(req.query.timespan);

    const batchUrl = "https://management.azure.com/batch?api-version=2020-06-01";


    const requestBody = {
      requests: [
        {
            httpMethod: "GET",
            name: "total_connections_summary",
            requestHeaderDetails: { commandName: "fx.MDMV2_SummaryResult" },
            url: `https://management.azure.com/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.DBforMySQL/flexibleServers/${mysqlServer}/providers/microsoft.Insights/metrics?timespan=${timespan}&interval=PT5M&metricnames=total_connections&aggregation=Maximum&metricNamespace=microsoft.dbformysql%2Fflexibleservers&validatedimensions=false&api-version=2019-07-01`
        },
        {
          httpMethod: "GET",
          name: "active_connections",
          requestHeaderDetails: { commandName: "fx.MDMV2_MetricResult" },
          url: `https://management.azure.com/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.DBforMySQL/flexibleServers/${mysqlServer}/providers/microsoft.Insights/metrics?timespan=${timespan}&interval=PT5M&metricnames=active_connections&aggregation=maximum&metricNamespace=microsoft.dbformysql%2Fflexibleservers&validatedimensions=false&api-version=2019-07-01`
        },
        {
          httpMethod: "GET",
          name: "active_transactions",
          requestHeaderDetails: { commandName: "fx.MDMV2_MetricResult" },
          url: `https://management.azure.com/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.DBforMySQL/flexibleServers/${mysqlServer}/providers/microsoft.Insights/metrics?timespan=${timespan}&interval=PT5M&metricnames=active_transactions&aggregation=maximum&metricNamespace=microsoft.dbformysql%2Fflexibleservers&validatedimensions=false&api-version=2019-07-01`
        }
      ]
    };

    const response = await axios.post(batchUrl, requestBody, {
      headers: { Authorization: token },
    });

    const results = response.data.responses.map((r) => ({
      name: r.name,
      status: r.httpStatusCode,
      metricData: r.content?.value?.[0]?.timeseries?.[0]?.data || [],
    }));

    res.json({ mysqlServer, results });
  } catch (err) {
    console.error("Error fetching metrics:", err.message);
    res.status(500).json({ error: "Failed to fetch MySQL metrics" });
  }
});

module.exports = router;
