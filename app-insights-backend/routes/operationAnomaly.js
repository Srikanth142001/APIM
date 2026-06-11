/**
 * Operation Anomaly Detector
 * Finds operations that had traffic in the previous window but have ZERO or very low traffic now
 * This is the #1 signal for a complete service outage
 */
const express = require("express");
const router = express.Router();
const { queryAppInsights } = require("../services/appInsightsService");

router.get("/", async (req, res) => {
  try {
    const now = new Date();
    const currStart = new Date(now.getTime() - 15 * 60 * 1000);  // last 15 min
    const prevStart = new Date(now.getTime() - 30 * 60 * 1000);  // 15-30 min ago

    const query = `
let current = requests
| where timestamp between (datetime("${currStart.toISOString()}") .. datetime("${now.toISOString()}"))
| where client_Type != "Browser"
| summarize curr_count = sum(itemCount), curr_errors = sumif(itemCount, success == false) by operation_Name
| extend curr_errorRate = iff(curr_count > 0, round(curr_errors * 100.0 / curr_count, 2), 0.0);

let previous = requests
| where timestamp between (datetime("${prevStart.toISOString()}") .. datetime("${currStart.toISOString()}"))
| where client_Type != "Browser"
| summarize prev_count = sum(itemCount) by operation_Name;

previous
| join kind=leftouter current on operation_Name
| project
    operation_Name,
    prev_count,
    curr_count = iff(isnull(curr_count), 0, curr_count),
    curr_errors = iff(isnull(curr_errors), 0, curr_errors),
    curr_errorRate = iff(isnull(curr_errorRate), 0.0, curr_errorRate)
| where prev_count > 30
| extend
    dropPercent = round((prev_count - curr_count) * 100.0 / prev_count, 1),
    status = case(
        curr_count == 0, "DEAD",
        curr_count < prev_count * 0.3, "CRITICAL_DROP",
        curr_count < prev_count * 0.6, "DEGRADED",
        curr_errorRate > 30, "HIGH_ERRORS",
        "OK"
    )
| where status != "OK"
| order by dropPercent desc
`;

    const rows = await queryAppInsights(query);

    const data = rows
      .filter(([op]) =>
        !op.endsWith("signout") &&
        !op.endsWith("contactdetails") &&
        !op.includes("deeplink")
      )
      .map(([operation_Name, prev_count, curr_count, curr_errors, curr_errorRate, dropPercent, status]) => ({
        operation_Name,
        prev_count,
        curr_count,
        curr_errors,
        curr_errorRate: parseFloat(curr_errorRate || 0),
        dropPercent: parseFloat(dropPercent || 0),
        status,
      }));

    res.json(data);
  } catch (err) {
    console.error("Operation anomaly error:", err.message);
    res.status(500).json({ error: "Failed to detect operation anomalies" });
  }
});

module.exports = router;
