/**
 * Error Burst Timeline — minute-by-minute error count for last 30 min
 * Shows exactly when errors started spiking — critical for outage timeline
 */
const express = require("express");
const router = express.Router();
const { queryAppInsights } = require("../services/appInsightsService");
const { fmtSASTTime } = require("./dateHelper");

router.get("/", async (req, res) => {
  try {
    const range = req.query.range || "30m";

    const query = `
requests
| where timestamp > ago(${range})
| summarize
    total = count(),
    errors = countif(success == false),
    avgRt = avg(duration)
  by bin(timestamp, 1m)
| extend errorRate = iff(total > 0, (errors * 100.0 / total), 0.0)
| order by timestamp asc
`;

    const rows = await queryAppInsights(query);

    const data = rows.map(([timestamp, total, errors, avgRt, errorRate]) => ({
      time: fmtSASTTime(timestamp),
      timestamp,
      total,
      errors,
      avgRt: Math.round(avgRt || 0),
      errorRate: parseFloat((errorRate || 0).toFixed(2)),
    }));

    // Detect burst windows (consecutive minutes with error rate > 10%)
    const bursts = [];
    let inBurst = false;
    let burstStart = null;

    for (const point of data) {
      if (point.errorRate > 10 && !inBurst) {
        inBurst = true;
        burstStart = point.time;
      } else if (point.errorRate <= 10 && inBurst) {
        inBurst = false;
        bursts.push({ start: burstStart, end: point.time });
      }
    }
    if (inBurst) bursts.push({ start: burstStart, end: "ongoing" });

    res.json({ timeline: data, bursts });
  } catch (err) {
    console.error("Error burst timeline error:", err.message);
    res.status(500).json({ error: "Failed to fetch error burst timeline" });
  }
});

module.exports = router;
