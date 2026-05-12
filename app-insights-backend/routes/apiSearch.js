/**
 * API Search — full-metrics search across all operation_Names in App Insights.
 *
 * GET /api/api-search?q=device&range=24h
 * GET /api/api-search?q=device&startDate=...&endDate=...
 *
 * Returns:
 * {
 *   results: [
 *     {
 *       operation_Name, total, success, failed, error_rate,
 *       avg_rt, min_rt, max_rt, p95_rt,
 *       status_codes: [{ code, count }]
 *     }
 *   ]
 * }
 */
const express = require("express");
const router = express.Router();
const { queryAppInsights } = require("../services/appInsightsService");
const { buildTimeFilter } = require("./dateHelper");

router.get("/", async (req, res) => {
  const { q } = req.query;
  if (!q || !q.trim()) return res.json({ results: [] });

  // Sanitise — strip quotes/backslashes to prevent KQL injection
  const safe = q.trim().replace(/"/g, "").replace(/\\/g, "");

  try {
    const timeFilter = buildTimeFilter(req);

    // Main metrics query — all matching operations
    const metricsQuery = `
requests
| where ${timeFilter}
| where operation_Name contains "${safe}"
| summarize
    total      = count(),
    success    = countif(success == true),
    failed     = countif(success == false),
    avg_rt     = round(avg(duration), 0),
    min_rt     = round(min(duration), 0),
    max_rt     = round(max(duration), 0),
    p95_rt     = round(percentile(duration, 95), 0)
  by operation_Name
| extend error_rate = round(failed * 100.0 / total, 2)
| order by total desc
| take 50
`;

    // Status codes query for the same matching operations
    const codesQuery = `
requests
| where ${timeFilter}
| where operation_Name contains "${safe}"
| summarize count_ = count() by operation_Name, resultCode
| order by operation_Name asc, count_ desc
`;

    const [metricRows, codeRows] = await Promise.all([
      queryAppInsights(metricsQuery),
      queryAppInsights(codesQuery),
    ]);

    // Build status code map keyed by operation_Name
    const codeMap = {};
    for (const row of codeRows) {
      const [opName, code, count] = row;
      if (!codeMap[opName]) codeMap[opName] = [];
      codeMap[opName].push({ code: String(code || ""), count: Number(count) || 0 });
    }

    const results = metricRows.map(row => {
      const [operation_Name, total, success, failed, avg_rt, min_rt, max_rt, p95_rt, error_rate] = row;
      return {
        operation_Name: String(operation_Name || ""),
        total:      Number(total)      || 0,
        success:    Number(success)    || 0,
        failed:     Number(failed)     || 0,
        avg_rt:     Math.round(Number(avg_rt)  || 0),
        min_rt:     Math.round(Number(min_rt)  || 0),
        max_rt:     Math.round(Number(max_rt)  || 0),
        p95_rt:     Math.round(Number(p95_rt)  || 0),
        error_rate: parseFloat(Number(error_rate).toFixed(2)) || 0,
        status_codes: codeMap[operation_Name] || [],
      };
    });

    res.json({ results, query: safe, total: results.length });
  } catch (err) {
    console.error("[API Search] Error:", err.message);
    res.status(500).json({ error: err.message, results: [] });
  }
});

module.exports = router;
