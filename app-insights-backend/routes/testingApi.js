const express = require("express");
const { queryAppInsights } = require("../services/appInsightsService");
const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const range = req.query.range || "1h";

    const table = await queryAppInsights(`
requests
| where timestamp > ago(14h)
| extend properties = parse_json(customDimensions)
| extend operationName = tostring(properties["Operation Name"])
| summarize count() by operationName
| sort by count_ desc

    `);



    res.json(table);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch top APIs" });
  }
});

module.exports = router;
