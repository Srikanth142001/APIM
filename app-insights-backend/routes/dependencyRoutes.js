const express = require("express");
const router = express.Router();
const { queryAppInsights } = require("../services/appInsightsService");

router.get("/", async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const now = new Date();

    let currentStart, currentEnd, previousStart, previousEnd;

    if (startDate && endDate) {
      currentEnd   = new Date(endDate);
      currentStart = new Date(startDate);
      const duration = currentEnd - currentStart;
      previousEnd   = new Date(currentStart);
      previousStart = new Date(currentStart.getTime() - duration);
    } else {
      currentEnd   = now;
      currentStart = new Date(now.getTime() - 30 * 60 * 1000);
      previousEnd  = currentStart;
      previousStart = new Date(now.getTime() - 60 * 60 * 1000);
    }

    const currentQuery = `
      requests
      | where timestamp between (datetime("${currentStart.toISOString()}") .. datetime("${currentEnd.toISOString()}"))
      | where client_Type != "Browser"
      | summarize
          totalCount = sum(itemCount),
          currentFailures = sumif(itemCount, success == false),
          sample_operationId = any(operation_Id),
          sample_operationName = any(operation_Name),
          sample_url = any(url)
        by name
      | where totalCount > 0
    `;

    const previousQuery = `
      requests
      | where timestamp between (datetime("${previousStart.toISOString()}") .. datetime("${previousEnd.toISOString()}"))
      | where client_Type != "Browser"
      | summarize pastFailures = sumif(itemCount, success == false) by name
    `;

    const [currentData, previousData] = await Promise.all([
      queryAppInsights(currentQuery),
      queryAppInsights(previousQuery),
    ]);

    const pastMap = new Map(previousData.map(([name, pastFailures]) => [name, pastFailures]));

    const result = currentData.map(
      ([name, totalCount, currentFailures, sample_operationId, sample_operationName, sample_url]) => {
        const pastFailures = pastMap.get(name) || 0;
        const diff = currentFailures - pastFailures;
        return {
          name,
          Total_count: totalCount,
          currentFailures,
          pastFailures,
          diff,
          diffPercent: totalCount > 0 ? +((currentFailures / totalCount) * 100).toFixed(2) : 0,
          sample_operationId,
          sample_operationName,
          sample_url
        };
      }
    );

    const filtered = result
      .filter(api =>
        api.diffPercent > 30 && api.pastFailures > 0 && api.currentFailures > 30 && api.diff > 0 &&
        !api.sample_operationName.endsWith('signout') &&
        !api.sample_operationName.endsWith('contactdetails') &&
        !api.sample_operationName.endsWith('momoagent-be-2-0-0/approvals') &&
        !api.sample_operationName.endsWith('deeplink') &&
        !api.sample_operationName.startsWith('GET') &&
        !api.sample_operationName.startsWith('POST') &&
        !api.sample_operationName.endsWith('contact-details-consumer')
      )
      .sort((a, b) => b.diffPercent - a.diffPercent);

    res.json(filtered);
  } catch (err) {
    console.error("Error comparing failures:", err);
    res.status(500).json({ error: "Failed to compare failures" });
  }
});

module.exports = router;
