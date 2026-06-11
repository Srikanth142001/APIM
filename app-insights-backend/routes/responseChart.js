const express = require("express");
const { queryAppInsights } = require("../services/appInsightsService");
const { buildTimeFilter, getBinSize, fmtSASTTime } = require("./dateHelper");
const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const timeFilter = buildTimeFilter(req);
    const bin = getBinSize(req);
    const rows = await queryAppInsights(`
      requests
      | where ${timeFilter}
      | where client_Type != "Browser"
      | summarize value = avg(duration) by bin(timestamp, ${bin})
      | order by timestamp asc
    `);

    const chartData = rows.map(([timestamp, value]) => ({
      time: fmtSASTTime(timestamp),
      value: parseFloat((value / 1000).toFixed(2))
    }));

    res.json(chartData);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch chart data" });
  }
});

module.exports = router;
