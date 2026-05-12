/**
 * Percentile Heatmap — p50/p95/p99 response times per operation
 * Identifies which APIs are slow at tail latency — key for SLA breaches
 */
const express = require("express");
const router = express.Router();
const { queryAppInsights } = require("../services/appInsightsService");
const { buildTimeFilter } = require("./dateHelper");

router.get("/", async (req, res) => {
  try {
    const timeFilter = buildTimeFilter(req);

    const query = `
requests
| where ${timeFilter}
| where client_Type != "Browser"
| summarize
    p50 = percentile(duration, 50),
    p95 = percentile(duration, 95),
    p99 = percentile(duration, 99),
    totalCount = count(),
    errorCount = countif(success == false)
  by operation_Name
| where totalCount > 20
| extend errorRate = round((errorCount * 100.0 / totalCount), 2)
| order by p95 desc
| take 15
`;

    const rows = await queryAppInsights(query);

    const data = rows.map(([operation_Name, p50, p95, p99, totalCount, errorCount, errorRate]) => ({
      operation: operation_Name,
      p50: Math.round(p50 || 0),
      p95: Math.round(p95 || 0),
      p99: Math.round(p99 || 0),
      count: totalCount,
      errors: errorCount,
      errorRate: parseFloat(errorRate || 0),
      // SLA status based on p95
      slaStatus: (p95 || 0) > 5000 ? "critical" : (p95 || 0) > 2000 ? "warning" : "ok",
    }));

    res.json(data);
  } catch (err) {
    console.error("Percentile heatmap error:", err.message);
    res.status(500).json({ error: "Failed to fetch percentile heatmap" });
  }
});

module.exports = router;
