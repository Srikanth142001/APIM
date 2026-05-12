const express = require("express");
const { queryAppInsights } = require("../services/appInsightsService");
const { buildTimeFilter } = require("./dateHelper");
const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const timeFilter = buildTimeFilter(req);
    const rows = await queryAppInsights(`
  let currentRange = requests | where ${timeFilter};
  let failures = currentRange | where success == false | summarize failureCount = count() | extend key = 1;
  let totalCurrent = currentRange | summarize totalCount = count() | extend key = 1;
  let avgTime = currentRange | summarize avgDuration = avg(duration) | extend key = 1;
  failures
  | join kind=inner (totalCurrent) on key
  | join kind=inner (avgTime) on key
  | project
      totalRequests = totalCount,
      errorRate = (failureCount * 100.0 / totalCount),
      avgResponseTime = avgDuration,
      totalFailures = failureCount
`);
    const [data] = rows;
    if (!data) return res.status(404).json({ error: "No data found" });
    res.json({
      totalRequests: data[0],
      errorRate: parseFloat(data[1].toFixed(2)),
      avgResponseTime: parseFloat(data[2].toFixed(2)),
      totalFailures: data[3],
      totalRequestsYesterday: data[0],
      total_diff_percentage: 100
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch overview" });
  }
});

module.exports = router;
