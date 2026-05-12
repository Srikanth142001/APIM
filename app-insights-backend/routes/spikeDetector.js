/**
 * Spike Detector — compares last 5 min vs previous 5 min
 * Detects sudden error spikes, traffic drops, and response time spikes
 * Critical for fast outage detection
 */
const express = require("express");
const router = express.Router();
const { queryAppInsights } = require("../services/appInsightsService");

router.get("/", async (req, res) => {
  try {
    const now = new Date();
    const t0 = new Date(now.getTime() - 5 * 60 * 1000);   // 5 min ago
    const t1 = new Date(now.getTime() - 10 * 60 * 1000);  // 10 min ago

    const query = `
let current = requests
| where timestamp between (datetime("${t0.toISOString()}") .. datetime("${now.toISOString()}"))
| summarize
    curr_total = count(),
    curr_errors = countif(success == false),
    curr_avg_rt = avg(duration)
| extend period = "current";

let previous = requests
| where timestamp between (datetime("${t1.toISOString()}") .. datetime("${t0.toISOString()}"))
| summarize
    prev_total = count(),
    prev_errors = countif(success == false),
    prev_avg_rt = avg(duration)
| extend period = "previous";

union current, previous
`;

    const rows = await queryAppInsights(query);

    let curr = { total: 0, errors: 0, avgRt: 0 };
    let prev = { total: 0, errors: 0, avgRt: 0 };

    for (const row of rows) {
      const [total, errors, avgRt, period] = row;
      if (period === "current") curr = { total, errors, avgRt: Math.round(avgRt || 0) };
      else prev = { total, errors, avgRt: Math.round(avgRt || 0) };
    }

    const errorRateCurr = curr.total > 0 ? (curr.errors / curr.total) * 100 : 0;
    const errorRatePrev = prev.total > 0 ? (prev.errors / prev.total) * 100 : 0;

    const spikes = [];

    // Error rate spike
    if (errorRateCurr > 10 && errorRateCurr > errorRatePrev * 1.5) {
      spikes.push({
        type: "ERROR_SPIKE",
        severity: errorRateCurr > 20 ? "critical" : "warning",
        title: "Error Rate Spike Detected",
        message: `Error rate jumped from ${errorRatePrev.toFixed(1)}% to ${errorRateCurr.toFixed(1)}% in last 5 min`,
        current: errorRateCurr.toFixed(2),
        previous: errorRatePrev.toFixed(2),
        unit: "%",
        change: errorRatePrev > 0 ? +(((errorRateCurr - errorRatePrev) / errorRatePrev) * 100).toFixed(1) : 100,
      });
    }

    // Traffic drop (possible outage)
    if (prev.total > 50 && curr.total < prev.total * 0.5) {
      spikes.push({
        type: "TRAFFIC_DROP",
        severity: "critical",
        title: "Traffic Drop Detected",
        message: `Request volume dropped from ${prev.total} to ${curr.total} (${(((prev.total - curr.total) / prev.total) * 100).toFixed(0)}% drop)`,
        current: curr.total,
        previous: prev.total,
        unit: "req",
        change: -(((prev.total - curr.total) / prev.total) * 100).toFixed(1),
      });
    }

    // Response time spike
    if (curr.avgRt > 1000 && prev.avgRt > 0 && curr.avgRt > prev.avgRt * 1.5) {
      spikes.push({
        type: "LATENCY_SPIKE",
        severity: curr.avgRt > 3000 ? "critical" : "warning",
        title: "Response Time Spike",
        message: `Avg response time jumped from ${prev.avgRt}ms to ${curr.avgRt}ms`,
        current: curr.avgRt,
        previous: prev.avgRt,
        unit: "ms",
        change: +(((curr.avgRt - prev.avgRt) / prev.avgRt) * 100).toFixed(1),
      });
    }

    res.json({
      current: { ...curr, errorRate: +errorRateCurr.toFixed(2) },
      previous: { ...prev, errorRate: +errorRatePrev.toFixed(2) },
      spikes,
      checkedAt: now.toISOString(),
    });
  } catch (err) {
    console.error("Spike detector error:", err.message);
    res.status(500).json({ error: "Failed to detect spikes" });
  }
});

module.exports = router;
