const express = require("express");
const { queryAppInsights } = require("../services/appInsightsService");
const { buildTimeFilter } = require("./dateHelper");
const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const timeFilter = buildTimeFilter(req);
    const table = await queryAppInsights(`
      requests
      | where ${timeFilter}
      | summarize
          totalCount = count(),
          avgDuration = avg(duration),
          errorCount = countif(success == false)
        by name
      | top 5 by totalCount desc
    `);

    const data = table.map(([name, totalCount, avgDuration, errorCount]) => ({
      name,
      count: totalCount,
      avg: parseFloat((avgDuration / 1000).toFixed(2)),
      errors: errorCount,
      success: (((totalCount - errorCount) / totalCount) * 100).toFixed(2),
    }));

    res.json(data);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch top APIs" });
  }
});

module.exports = router;
