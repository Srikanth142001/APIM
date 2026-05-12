const express = require("express");
const axios = require("axios");
const fs = require("fs");
const router = express.Router();

const subscriptionId = process.env.AZURE_SUBSCRIPTION_ID;
const resourceGroup = process.env.AZURE_RESOURCE_GROUP;
const clusterName = process.env.AKS_CLUSTER_NAME;



// KQL query builder
function buildKqlQuery(timespan) {
  return `
let lookback = ago(${timespan});

//
// ===== CPU Usage =====
let cpu = Perf
| where TimeGenerated > lookback
| where _ResourceId has "${clusterName}"
| where ObjectName == "K8SNode" and CounterName == "cpuUsageNanoCores"
| summarize cpu_usage = avg(CounterValue) by Computer;

//
// ===== CPU Capacity =====
let cpuCap = Perf
| where TimeGenerated > lookback
| where _ResourceId has "${clusterName}"
| where ObjectName == "K8SNode" and CounterName == "cpuCapacityNanoCores"
| summarize cpu_capacity = avg(CounterValue) by Computer;

//
// ===== Memory Usage =====
let mem = Perf
| where TimeGenerated > lookback
| where _ResourceId has "${clusterName}"
| where ObjectName == "K8SNode" and CounterName == "memoryRssBytes"
| summarize mem_usage = avg(CounterValue) by Computer;

//
// ===== Memory Capacity =====
let memCap = Perf
| where TimeGenerated > lookback
| where _ResourceId has "${clusterName}"
| where ObjectName == "K8SNode" and CounterName == "memoryCapacityBytes"
| summarize mem_capacity = avg(CounterValue) by Computer;

//
// ===== Disk Usage =====
let disk = Perf
| where TimeGenerated > lookback
| where _ResourceId has "${clusterName}"
| where ObjectName == "K8SNode" and CounterName == "diskUsedBytes"
| summarize disk_usage = avg(CounterValue) by Computer;

//
// ===== Disk Capacity =====
let diskCap = Perf
| where TimeGenerated > lookback
| where _ResourceId has "${clusterName}"
| where ObjectName == "K8SNode" and CounterName == "diskCapacityBytes"
| summarize disk_capacity = avg(CounterValue) by Computer;

//
// ===== Node Status =====
let nodeStatus = KubeNodeInventory
| where TimeGenerated > lookback
| where _ResourceId has "${clusterName}"
| summarize arg_max(TimeGenerated, *) by Computer
| project Computer, NodeStatus = Status;

//
// ===== Pod Count =====
let pods = KubePodInventory
| where TimeGenerated > lookback
| where _ResourceId has "${clusterName}"
| summarize pod_count = dcount(PodUid) by Computer;

//
// ===== Final Join =====
cpu
| join kind=inner cpuCap on Computer
| join kind=inner mem on Computer
| join kind=inner memCap on Computer
| join kind=leftouter pods on Computer
| join kind=leftouter disk on Computer
| join kind=leftouter diskCap on Computer
| join kind=leftouter nodeStatus on Computer
| project 
    NodeName = Computer,
    NodeStatus,
    CPU = round((cpu_usage * 100.0 / cpu_capacity), 1),
    Memory = round((mem_usage * 100.0 / mem_capacity), 1),
    Disk = iff(isnull(disk_usage) or isnull(disk_capacity), 0.0, round((disk_usage * 100.0 / disk_capacity), 1)),
    PodPercent = iff(isnull(pod_count), 0.0, round((pod_count * 100.0 / 30), 1)), 
    PodCount = tostring(pod_count)
`;
}


// API route
router.get("/", async (req, res) => {
  try {
    const timespan = req.query.timespan || "30m"; // default = last 30 min

    // Token: from file in Docker, env var otherwise
    let token;
    if (fs.existsSync("/app/shared/log_token.txt")) {
      token = "Bearer " + fs.readFileSync("/app/shared/log_token.txt", "utf8").trim();
    } else {
      const raw = process.env.LOG_ANALYTICS_AUTH_TOKEN || "";
      token = raw.startsWith("Bearer ") ? raw : "Bearer " + raw;
    }
    const query = buildKqlQuery(timespan);

    const url = `https://api.loganalytics.io/v1/subscriptions/${subscriptionId}/resourcegroups/${resourceGroup}/providers/Microsoft.ContainerService/managedClusters/${clusterName}/query`;

    const response = await axios.post(
      url,
      { query },
      { headers: { Authorization: token } }
    );

    res.json(response.data);
  } catch (err) {
    console.error("Error fetching metrics:", err.response?.data || err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
