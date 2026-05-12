const express = require("express");
const router = express.Router();
const { queryAppInsights } = require("../services/appInsightsService");

router.get("/", async (req, res) => {
  const { startDate, endDate } = req.query;

  let endTime, startCurrent, startPrevious;

  if (startDate && endDate) {
    endTime   = `datetime("${endDate}")`;
    const mid = new Date((new Date(startDate).getTime() + new Date(endDate).getTime()) / 2).toISOString();
    startCurrent  = `datetime("${startDate}")`;
    startPrevious = `datetime("${new Date(new Date(startDate).getTime() - (new Date(endDate) - new Date(startDate))).toISOString()}")`;
    endTime = `datetime("${endDate}")`;
  } else {
    endTime       = "now()";
    startCurrent  = "endTime - 30m";
    startPrevious = "endTime - 60m";
  }

  const query = `
let endTime = ${endTime};
let startCurrent = ${startCurrent};
let startPrevious = ${startPrevious};

let operationNames = dynamic([
    "ecw-api;rev=1 - getbalance",
    "ecw-api;rev=1 - verify-otp",
    "ecw-api;rev=1 - approals-list",
    "ecw-api;rev=1 - transactionhistory",
    "ecw-api;rev=1 - account-verify",
    "ecw-api;rev=1 - scan-paymerchant",
    "ecw-api;rev=1 - payment",
    "cms-v2-2-0;rev=1 - send-money",
    "ecw-api;rev=1 - login",
    "ecw-api;rev=1 - bio-metric-login",
    "mad-v2-1-0;rev=1 - customer-balance"
]);

let current = requests
| where operation_Name in (operationNames)
| where timestamp between (startCurrent .. endTime)
| summarize currentAvg = avg(duration), currentCount = count() by operationName = operation_Name;

let previous = requests
| where operation_Name in (operationNames)
| where timestamp between (startPrevious .. startCurrent)
| summarize pastAvg = avg(duration) by operationName = operation_Name;

current
| join kind=leftouter previous on operationName
| project operationName, currentAvg, pastAvg, currentCount
| order by currentAvg desc
`;

  try {
    const data = await queryAppInsights(query);
    const result = data.map(row => {
      const operationName = row[0];
      const currentAvgResponseTime = Math.round(row[1]);
      const previousAvgResponseTime = Math.round(row[2] || 0);
      const currentCount = row[3];
      const diffPercent = previousAvgResponseTime > 0
        ? +(((currentAvgResponseTime - previousAvgResponseTime) / previousAvgResponseTime) * 100).toFixed(2)
        : 0;
      return { operationName, previousAvgResponseTime, currentAvgResponseTime, currentCount, diffPercent };
    });
    res.json(result);
  } catch (err) {
    console.error("Error fetching response stats:", err.message);
    res.status(500).json({ error: "Failed to fetch response stats" });
  }
});

module.exports = router;
