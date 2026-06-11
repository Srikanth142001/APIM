/**
 * Top APIs in a specific time window
 * Called when user brushes a time range on the Error Burst Timeline chart
 * Returns top APIs ranked by failure count + avg RT for that exact window
 */
const express = require("express");
const router = express.Router();
const { queryAppInsights } = require("../services/appInsightsService");

router.get("/", async (req, res) => {
  const { windowStart, windowEnd } = req.query;
  if (!windowStart || !windowEnd) {
    return res.status(400).json({ error: "windowStart and windowEnd required" });
  }

  try {
    const timeFilter = `timestamp between (datetime("${windowStart}") .. datetime("${windowEnd}"))`;

    const query = `
requests
| where ${timeFilter}
| where client_Type != "Browser"
| summarize
    total      = sum(itemCount),
    failures   = sumif(itemCount, success == false),
    avg_rt     = avg(duration),
    p95_rt     = percentile(duration, 95),
    result_codes = make_set(resultCode, 5)
  by operation_Name
| where total > 0
| extend error_rate = round(failures * 100.0 / total, 2)
| order by failures desc
`;

    const rows = await queryAppInsights(query);

    const byErrors = rows.map(([op, total, failures, avgRt, p95Rt, resultCodes]) => {
      const t = Number(total) || 0;
      const f = Number(failures) || 0;
      return {
        operation_Name: op,
        total:          t,
        failures:       f,
        avg_rt:         Math.round(Number(avgRt) || 0),
        p95_rt:         Math.round(Number(p95Rt) || 0),
        error_rate:     t > 0 ? parseFloat(((f / t) * 100).toFixed(2)) : 0,
        result_codes:   Array.isArray(resultCodes) ? resultCodes.filter(Boolean).join(", ") : "",
      };
    });

    // Top by RT (separate sort)
    const byRt = [...byErrors]
      .filter(r => r.avg_rt > 0)
      .sort((a, b) => b.avg_rt - a.avg_rt);

    const windowDurationMs = new Date(windowEnd) - new Date(windowStart);
    const windowMinutes = Math.round(windowDurationMs / 60000);

    res.json({
      windowStart,
      windowEnd,
      windowMinutes,
      totalApis: byErrors.length,
      apis: byErrors,   // all APIs, sorted by failures desc by default
      byRt,             // same APIs sorted by avg_rt desc
    });
  } catch (err) {
    console.error("[Top APIs in Window] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
