// routes/failureCodeRoutes.js
const express = require("express");
const router = express.Router();
const { queryAppInsights } = require("../services/appInsightsService");

router.get("/", async (req, res) => {
  const range = req.query.range || "1h";
  const query = `
requests
| where timestamp > ago(${range}) and success == false
| summarize count_ = count() by resultCode
| order by count_ desc
`;

  try {
    const rows = await queryAppInsights(query);
    const result = rows.map(([code, count]) => ({
      statusCode: code,
      count: Number(count) || 0,
    }));
    res.json(result);
  } catch (err) {
    console.error("Error fetching failure codes:", err);
    res.status(500).json({ error: "Failed to fetch failure codes" });
  }
});

module.exports = router;
