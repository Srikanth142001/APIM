const express = require("express");
const { queryAppInsights } = require("../services/appInsightsService");
const { getBinSize, fmtSASTTime } = require("./dateHelper");
const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const bin = getBinSize(req);

    let selectedStart, selectedEnd, compareStart, compareEnd;

    if (startDate && endDate) {
      selectedStart = new Date(startDate);
      selectedEnd = new Date(endDate);
      const durationMs = selectedEnd - selectedStart;
      compareStart = new Date(selectedStart.getTime() - durationMs);
      compareEnd = new Date(selectedStart);
    } else {
      const now = new Date();
      selectedEnd = now;
      selectedStart = new Date(now);
      selectedStart.setHours(0, 0, 0, 0);
      const elapsed = now - selectedStart;
      compareStart = new Date(selectedStart.getTime() - 24 * 60 * 60 * 1000);
      compareEnd = new Date(compareStart.getTime() + elapsed);
    }

    const kqlQuery = `
let selectedData = requests
  | where timestamp between (datetime("${selectedStart.toISOString()}") .. datetime("${selectedEnd.toISOString()}"))
  | where client_Type != "Browser"
  | summarize value = avg(duration) by timestamp=bin(timestamp, ${bin})
  | extend period = "Today";

let compareData = requests
  | where timestamp between (datetime("${compareStart.toISOString()}") .. datetime("${compareEnd.toISOString()}"))
  | where client_Type != "Browser"
  | summarize value = avg(duration) by timestamp=bin(timestamp, ${bin})
  | extend period = "Yesterday";

union selectedData, compareData
| order by timestamp asc, period
`;

    const rows = await queryAppInsights(kqlQuery);

    const chartData = rows.map(([timestamp, value, period]) => ({
      time: fmtSASTTime(timestamp),
      value,
      period
    }));

    res.json(chartData);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch chart data" });
  }
});

module.exports = router;
