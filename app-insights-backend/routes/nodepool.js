const express = require("express");
const axios = require("axios");
const fs = require("fs");

const router = express.Router();

const clusterName = process.env.AKS_CLUSTER_NAME;
const subscriptionId = process.env.AZURE_SUBSCRIPTION_ID;
const resourceGroup = process.env.AZURE_RESOURCE_GROUP;

/*
Build KQL query dynamically
Example timespan values from UI:
30m
1h
6h
1d
7d
*/

function buildKqlQuery(timespan) {

return `
let lookback = ago(${timespan});

//
// CPU Usage
//
let cpuUsage = Perf
| where TimeGenerated > lookback
| where _ResourceId has "${clusterName}"
| where ObjectName == "K8SNode"
| where CounterName == "cpuUsageNanoCores"
| summarize cpu_usage = avg(CounterValue) by Computer, bin(TimeGenerated, 5m);

//
// CPU Capacity
//
let cpuCapacity = Perf
| where TimeGenerated > lookback
| where _ResourceId has "${clusterName}"
| where ObjectName == "K8SNode"
| where CounterName == "cpuCapacityNanoCores"
| summarize cpu_capacity = avg(CounterValue) by Computer;

//
// Extract NodePool
//
let nodePool = KubeNodeInventory
| where TimeGenerated > lookback
| where _ResourceId has "${clusterName}"
| summarize arg_max(TimeGenerated, Labels) by Computer
| extend NodePool = tostring(parse_json(Labels)[0].agentpool)
| project Computer, NodePool;

//
// Join metrics
//
cpuUsage
| join kind=inner cpuCapacity on Computer
| join kind=leftouter nodePool on Computer
| extend CPUPercent = (cpu_usage * 100.0 / cpu_capacity)

//
// Match Azure behavior (MAX CPU per pool)
//
| summarize MaxCPU = max(CPUPercent) by NodePool, TimeGenerated
| order by TimeGenerated asc
`;
}


// API endpoint
router.get("/", async (req, res) => {

try {

const timespan = req.query.timespan || "30m";

let token;

// Token from shared docker file
if (fs.existsSync("/app/shared/log_token.txt")) {

token = "Bearer " + fs.readFileSync("/app/shared/log_token.txt","utf8").trim();

} else {

const raw = process.env.LOG_ANALYTICS_AUTH_TOKEN || "";
token = raw.startsWith("Bearer ") ? raw : "Bearer " + raw;

}

const query = buildKqlQuery(timespan);

const url = `https://api.loganalytics.io/v1/subscriptions/${subscriptionId}/resourcegroups/${resourceGroup}/providers/Microsoft.ContainerService/managedClusters/${clusterName}/query`;

const response = await axios.post(
url,
{ query },
{
headers:{
Authorization: token,
"Content-Type":"application/json"
}
}
);

res.json(response.data);

}
catch(err){

console.error("Log Analytics Error:", err.response?.data || err.message);

res.status(500).json({
error: err.response?.data || err.message
});

}

});

module.exports = router;