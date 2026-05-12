/**
 * Azure Insights Hub — Backend API Server
 * Multi-tenant Azure monitoring dashboard backend
 */
const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");

dotenv.config();

const { requireAuth } = require("./middleware/auth");
const authRoutes = require("./routes/authRoutes");
const environmentsRoutes = require("./routes/environments");
const envProxyRoutes = require("./routes/envProxy");

const app = express();
app.use(cors());
app.use(express.json());

// ── Auth (public — no token required) ────────────────────────────────────────
app.use("/api/auth", authRoutes);

// ── Protect all other /api/* routes ──────────────────────────────────────────
app.use("/api", requireAuth);

// ── Environment CRUD + test/discover ─────────────────────────────────────────
app.use("/api/environments", environmentsRoutes);

// ── Per-environment proxy routes ──────────────────────────────────────────────
// Routes: /api/:envId/overview, /api/:envId/top-apis, etc.
app.use("/api/:envId", envProxyRoutes);

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "azure-insights-hub-backend", timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`🚀 Azure Insights Hub backend running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
});
