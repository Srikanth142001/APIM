/**
 * Top Failing URLs — exact URLs with failure details, result codes, and sample operation IDs
 * Gives engineers the exact endpoint to investigate during an outage
 */
const express = require("express");
const router = express.Router();
const { queryAppInsights } = require("../services/appInsightsService");
const { buildTimeFilter, fmtSASTTime, fmtSASTTimeSec } = require("./dateHelper");

router.get("/", async (req, res) => {
  try {
    const timeFilter = buildTimeFilter(req);

    const query = `
requests
| where ${timeFilter} and success == false
| where client_Type != "Browser"
| summarize
    failureCount = count(),
    resultCodes = make_set(resultCode, 5),
    sample_url = any(url),
    sample_operationId = any(operation_Id),
    lastSeen = max(timestamp),
    firstSeen = min(timestamp)
  by name, operation_Name
| order by failureCount desc
| take 20
`;

    const rows = await queryAppInsights(query);

    const data = rows
      .filter(([name]) =>
        !name.endsWith("signout") &&
        !name.endsWith("contactdetails") &&
        !name.includes("deeplink")
      )
      .map(([name, failureCount, resultCodes, sample_url, sample_operationId, lastSeen, firstSeen]) => ({
        name,
        operation_Name: name,
        failureCount,
        resultCodes: Array.isArray(resultCodes) ? resultCodes.join(", ") : resultCodes,
        sample_url,
        sample_operationId,
        lastSeen: lastSeen ? fmtSASTTimeSec(lastSeen) : "-",
        firstSeen: firstSeen ? fmtSASTTime(firstSeen) : "-",
        duration: firstSeen && lastSeen
          ? Math.round((new Date(lastSeen) - new Date(firstSeen)) / 60000) + "m"
          : "-",
      }));

    res.json(data);
  } catch (err) {
    console.error("Top failing URLs error:", err.message);
    res.status(500).json({ error: "Failed to fetch top failing URLs" });
  }
});

module.exports = router;

