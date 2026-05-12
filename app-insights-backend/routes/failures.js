const express = require("express");
const { queryAppInsights } = require("../services/appInsightsService");
const { buildTimeFilter } = require("./dateHelper");
const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const timeFilter = buildTimeFilter(req);
    const rows = await queryAppInsights(`
      requests
      | where ${timeFilter} and success == false
      | summarize failureCount = count(), status = tostring(take_any(resultCode)) by name
      | top 10 by failureCount desc
    `);

    const data = rows
      .filter(([name]) =>
        !name.endsWith('signout') &&
        !name.endsWith('contactdetails') &&
        name !== 'POST /api/ae/momoagent-be-2-0-0/approvals'
      )
      .map(([name, failureCount, status]) => ({ name, failureCount, status }));

    res.json(data);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch failed APIs" });
  }
});

module.exports = router;
