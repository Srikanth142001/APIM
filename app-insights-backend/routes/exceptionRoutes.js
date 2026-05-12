const express = require("express");
const router = express.Router();
const { queryAppInsights } = require("../services/appInsightsService");

router.get("/", async (req, res) => {
  const { startDate, endDate } = req.query;

  let currStart, currEnd, prevStart, prevEnd;

  if (startDate && endDate) {
    currEnd   = new Date(endDate);
    currStart = new Date(startDate);
    const duration = currEnd - currStart;
    prevEnd   = new Date(currStart);
    prevStart = new Date(currStart.getTime() - duration);
  } else {
    currEnd   = new Date();
    currStart = new Date(currEnd.getTime() - 30 * 60 * 1000);
    prevEnd   = currStart;
    prevStart = new Date(currEnd.getTime() - 60 * 60 * 1000);
  }

  const CURR_QUERY = `
    let m = requests
    | where timestamp between (datetime("${currStart.toISOString()}") .. datetime("${currEnd.toISOString()}"))
    | where client_Type != "Browser"
    | project itemCount, duration, operation_Name;
    m
    | summarize sum_itemCount = sum(itemCount), avg_duration = sum(itemCount * duration) / sum(itemCount)
    by operation_Name
    | sort by avg_duration desc
  `;

  const PREV_QUERY = `
    let m = requests
    | where timestamp between (datetime("${prevStart.toISOString()}") .. datetime("${prevEnd.toISOString()}"))
    | where client_Type != "Browser"
    | project itemCount, duration, operation_Name;
    m
    | summarize sum_itemCount = sum(itemCount), avg_duration = sum(itemCount * duration) / sum(itemCount)
    by operation_Name
    | sort by avg_duration desc
  `;

  try {
    const [currResults, prevResults] = await Promise.all([
      queryAppInsights(CURR_QUERY),
      queryAppInsights(PREV_QUERY),
    ]);

    const currMap = new Map(
      currResults.map(([operation_Name, sum_itemCount, avg_duration]) => [
        operation_Name, { sum_itemCount, avg_duration },
      ])
    );
    const prevMap = new Map(
      prevResults.map(([operation_Name, sum_itemCount, avg_duration]) => [
        operation_Name, { sum_itemCount, avg_duration },
      ])
    );

    const result = [];
    for (const [operation_Name, currData] of currMap.entries()) {
      if (operation_Name.startsWith('cms')) continue;
      const prevData = prevMap.get(operation_Name);
      if (prevData && currData.sum_itemCount > 50 && prevData.avg_duration > 0) {
        const diffPercent = ((currData.avg_duration - prevData.avg_duration) / prevData.avg_duration) * 100;
        if (diffPercent > 30 && currData.avg_duration > 4000) {
          result.push({
            operation_Name,
            count: currData.sum_itemCount,
            prev_avg_duration: prevData.avg_duration,
            curr_avg_duration: currData.avg_duration,
            diff_percent: parseFloat(diffPercent.toFixed(2)),
          });
        }
      }
    }
    result.sort((a, b) => b.count - a.count);

    res.json({ increasedBy30Percent: result });
  } catch (error) {
    console.error("Error fetching performance data:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to fetch performance comparison" });
  }
});

module.exports = router;
