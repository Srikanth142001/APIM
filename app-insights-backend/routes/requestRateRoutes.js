const express = require("express");
const router = express.Router();
const { queryAppInsights } = require("../services/appInsightsService");
const { getBinSize, fmtSASTTime } = require("./dateHelper");

router.get("/", async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const bin = getBinSize(req);

    let selectedStart, selectedEnd, compareStart, compareEnd;

    if (startDate && endDate) {
      // Custom date: compare selected range vs same duration before it
      selectedStart = new Date(startDate);
      selectedEnd = new Date(endDate);
      const durationMs = selectedEnd - selectedStart;
      compareStart = new Date(selectedStart.getTime() - durationMs);
      compareEnd = new Date(selectedStart);
    } else {
      // Default: today vs yesterday
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
  | summarize count = count() by timestamp=bin(timestamp, ${bin})
  | extend period = "Selected";

let compareData = requests
  | where timestamp between (datetime("${compareStart.toISOString()}") .. datetime("${compareEnd.toISOString()}"))
  | summarize count = count() by timestamp=bin(timestamp, ${bin})
  | extend period = "Previous";

union selectedData, compareData
| order by timestamp asc, period
`;

    const rows = await queryAppInsights(kqlQuery);

    const today = [];
    const yesterday = [];

    for (const [timestamp, count, period] of rows) {
      const formatted = {
        time: fmtSASTTime(timestamp),
        count,
      };
      if (period === "Selected") today.push(formatted);
      else yesterday.push(formatted);
    }

    res.json({ today, yesterday });
  } catch (err) {
    console.error("Error fetching request comparison:", err.message);
    res.status(500).json({ error: "Failed to fetch request comparison" });
  }
});

module.exports = router;
