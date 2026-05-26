// === index.js ===
const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const { requireAuth } = require("./middleware/auth");
const authRoutes = require("./routes/authRoutes");
const overviewRoutes = require("./routes/overview");
const chartRoutes = require("./routes/responseChart");
const apiRoutes = require("./routes/topApis");
const failureRoutes = require("./routes/failures");
const responseCompare = require("./routes/responseCompare")
const requestRateRoutes = require("./routes/requestRateRoutes");
const percentileRoutes = require("./routes/percentileRoutes");
const dependencyRoutes = require("./routes/dependencyRoutes");
const failureCodeRoutes = require("./routes/failureCodeRoutes");
const exceptionRoutes = require("./routes/exceptionRoutes");
const outage = require("./routes/outageform");
const testing = require("./routes/testingApi");
const nodeCpuRoutes = require("./routes/nodeCpuRoutes");
const mysqlconn = require("./routes/mysqlConnections");
const apppool = require("./routes/nodepool")
const mysqlmetrics = require("./routes/mysqlmetrics");
// ── New outage-detection routes ──────────────────────────────────────────────
const spikeDetector     = require("./routes/spikeDetector");
const errorBurstTimeline = require("./routes/errorBurstTimeline");
const percentileHeatmap  = require("./routes/percentileHeatmap");
const topFailingUrls     = require("./routes/topFailingUrls");
const operationAnomaly   = require("./routes/operationAnomaly");
// ── AI/ML Alert Engine ───────────────────────────────────────────────────────
const alertEngine        = require("./routes/alertEngine");
const mlApiAlerts        = require("./routes/mlApiAlerts");
const highFailureApis    = require("./routes/highFailureApis");
const topApisInWindow    = require("./routes/topApisInWindow");
const telegramRoutes     = require("./routes/telegramRoutes");
// ── Background ML Scheduler ──────────────────────────────────────────────────
const { startScheduler, stopScheduler, getStatus: getSchedulerStatus } = require("./services/mlScheduler");
const failuresPanel      = require("./routes/failuresPanel");
const performancePanel   = require("./routes/performancePanel");
const apiSearch          = require("./routes/apiSearch");
// ── Custom Database Query ────────────────────────────────────────────────────
const customDbRoutes     = require("./routes/customDbRoutes");

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

// ── Public endpoints (no auth required) ─────────────────────────────────────
app.use("/api/auth", authRoutes);

// ── Feature flags — public endpoint so frontend can check before login ──────
app.get("/api/features", (req, res) => {
  res.json({
    mysql:          !!process.env.MYSQL_SERVER_NAME,
    infrastructure: !!process.env.AKS_CLUSTER_NAME,
    logAnalytics:   !!process.env.LOG_ANALYTICS_AUTH_TOKEN,
    telegram:       !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
  });
});

// ── Protect all other /api/* routes ─────────────────────────────────────────
app.use("/api", requireAuth);


app.use("/api/overview", overviewRoutes);
app.use("/api/response-time-chart", chartRoutes);
app.use("/api/top-apis", apiRoutes);
app.use("/api/failures", failureRoutes);
app.use("/api/responseCompare", responseCompare);
app.use("/api/request-rate", requestRateRoutes);
app.use("/api/response-percentiles", percentileRoutes);
app.use("/api/dependencies", dependencyRoutes);
app.use("/api/failure-codes", failureCodeRoutes);
app.use("/api/exceptions", exceptionRoutes);
app.use("/api/testing", testing );
app.use("/api/outage", outage );
app.use("/api/node-cpu", nodeCpuRoutes);
app.use("/api/mysql-conn", mysqlconn);
app.use("/api/nodepool",apppool);
app.use("/api/mysql-metrics", mysqlmetrics);
// ── New outage-detection endpoints ──────────────────────────────────────────
app.use("/api/spike-detector",      spikeDetector);
app.use("/api/error-burst-timeline", errorBurstTimeline);
app.use("/api/percentile-heatmap",  percentileHeatmap);
app.use("/api/top-failing-urls",    topFailingUrls);
app.use("/api/operation-anomaly",   operationAnomaly);
// ── AI/ML Alert Engine ───────────────────────────────────────────────────────
app.use("/api/alerts",              alertEngine);
app.use("/api/ml-api-alerts",       mlApiAlerts);
app.use("/api/high-failure-apis",   highFailureApis);
app.use("/api/top-apis-in-window",  topApisInWindow);
app.use("/api/telegram",            telegramRoutes);
app.use("/api/failures-panel",      failuresPanel);
app.use("/api/performance-panel",   performancePanel);
app.use("/api/api-search",          apiSearch);
// ── Custom Database Query ────────────────────────────────────────────────────
app.use("/api/custom-db",           customDbRoutes);

// ── ML Scheduler Status & Control ────────────────────────────────────────────
app.get("/api/ml-scheduler/status", requireAuth, (req, res) => {
  res.json(getSchedulerStatus());
});

app.post("/api/ml-scheduler/start", requireAuth, (req, res) => {
  startScheduler();
  res.json({ ok: true, status: getSchedulerStatus() });
});

app.post("/api/ml-scheduler/stop", requireAuth, (req, res) => {
  stopScheduler();
  res.json({ ok: true, status: getSchedulerStatus() });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
  
  // Auto-start ML scheduler if Telegram is configured
  const telegramConfigured = process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID;
  if (telegramConfigured) {
    console.log("🤖 Telegram configured — starting ML background scheduler...");
    startScheduler();
  } else {
    console.log("📵 Telegram not configured — ML scheduler will not auto-start");
    console.log("   Configure via Dashboard → Alerts tab → Telegram section");
  }
});