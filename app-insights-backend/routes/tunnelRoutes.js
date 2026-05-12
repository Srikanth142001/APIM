const express = require("express");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const router = express.Router();

// Build KQL Query
function buildKqlQuery(timespan) {
  return `
let lookback = ago(${timespan});

// Get the latest pod info
let latestPod = KubePodInventory
| where TimeGenerated > lookback
| summarize arg_max(TimeGenerated, *) by ClusterName, Computer, Name
| project ClusterName, Computer, PodName = Name, PodStatus, PodRestartCount;

// Cluster summary
let clusterSummary = latestPod
| summarize
    totalNodes = dcount(Computer),
    totalPods = count(),
    healthyPods = countif(PodStatus == "Running"),
    nonHealthyPods = countif(PodStatus != "Running")
  by ClusterName;

// Pod details (for embedding in output)
let podDetails = latestPod
| project ClusterName, PodName, restarts = coalesce(PodRestartCount, 0), status = PodStatus;

// Join summaries
clusterSummary
| join kind=leftouter podDetails on ClusterName
| summarize
    totalNodes = max(totalNodes),
    totalPods = max(totalPods),
    healthyPods = max(healthyPods),
    nonHealthyPods = max(nonHealthyPods),
    pods = make_list(bag_pack("podName", PodName, "restarts", restarts, "status", status))
  by ClusterName
| project ClusterName, totalNodes, healthyPods, nonHealthyPods, totalPods, pods
`;
}

// Express route
router.get("/", async (req, res) => {
  try {
    const timespan = req.query.timespan || "30m";
    const token = "Bearer " + fs.readFileSync("/app/shared/log_token.txt", "utf8").trim();

    const subscriptionId = process.env.AZURE_SUBSCRIPTION_ID;
    const resourceGroup  = process.env.AZURE_RESOURCE_GROUP;
    const clusterName    = process.env.AKS_CLUSTER_NAME;
    const url = `https://api.loganalytics.io/v1/subscriptions/${subscriptionId}/resourcegroups/${resourceGroup}/providers/Microsoft.ContainerService/managedClusters/${clusterName}/query`;


    const response = await axios.post(
      url,
      { query: buildKqlQuery(timespan) },
      { headers: { Authorization: token, "Content-Type": "application/json" } }
    );

    const tables = response.data?.tables;
    if (!tables?.length) return res.status(200).json({ clusters: [] });

    const table = tables[0];
    const cols = table.columns.map((c) => c.name);
    const rows = table.rows;

    const out = rows.map((r) => {
      const data = Object.fromEntries(cols.map((c, i) => [c, r[i]]));
      return {
        clusterName: data.ClusterName,
        totalNodes: data.totalNodes,
        healthyNodes: data.totalNodes, // placeholder (no node health metric in this query)
        nonHealthyNodes: 0,
        totalPods: data.totalPods,
        healthyPods: data.healthyPods,
        nonHealthyPods: data.nonHealthyPods,
        pods: data.pods || [],
      };
    });

    res.json({ clusters: out });
  } catch (err) {
    console.error("Error fetching metrics:", err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data || err.message });
  }
});

module.exports = router;
