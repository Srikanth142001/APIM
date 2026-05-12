import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "../config/axiosSetup";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell,
} from "recharts";
import {
  FaClock, FaCheckCircle, FaTimesCircle, FaExclamationTriangle,
  FaSync, FaSignOutAlt, FaShieldAlt, FaCloud, FaBolt, FaFire,
  FaTachometerAlt, FaChartBar,
} from "react-icons/fa";
import { getSessionRemainingSeconds } from "../config/axiosSetup";
import { API_ENDPOINTS } from "../config/apiConfig";
import { useTheme } from "../context/ThemeContext";
import DashboardTable from "../components/DashboardTable";
import HighFailureApisTable from "../components/HighFailureApisTable";

// ─── helpers ────────────────────────────────────────────────────────────────
const getEnvId = () => localStorage.getItem("active_env_id") || "";

function fmt(v) {
  if (v == null || v === "") return "—";
  const n = Number(v);
  if (isNaN(n)) return String(v);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function fmtMs(v) {
  if (v == null) return "—";
  return `${Math.round(Number(v))} ms`;
}

function fmtPct(v) {
  if (v == null) return "—";
  return `${Number(v).toFixed(2)}%`;
}

function errColor(rate, T) {
  if (rate > 10) return T.red;
  if (rate > 4) return T.orange;
  return T.green;
}

function rtColor(ms, T) {
  if (ms > 500) return T.red;
  if (ms > 400) return T.orange;
  return T.green;
}

function deltaArrow(val) {
  if (val == null) return null;
  return val > 0 ? "▲" : val < 0 ? "▼" : "–";
}

// ─── Skeleton ────────────────────────────────────────────────────────────────
const Skel = ({ h = 14, w = "100%", mb = 0 }) => (
  <div className="gf-skeleton" style={{ height: h, width: w, marginBottom: mb, borderRadius: 3 }} />
);

// ─── Panel wrapper ───────────────────────────────────────────────────────────
function Panel({ accent, title, badge, children, T, style = {} }) {
  return (
    <div style={{
      background: T.panel, border: `1px solid ${T.border}`,
      borderRadius: 4, overflow: "hidden", ...style,
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "8px 14px", borderBottom: `1px solid ${T.border}`,
        background: T.surface, minHeight: 36,
      }}>
        <span style={{ width: 3, height: 16, borderRadius: 2, background: accent, flexShrink: 0 }} />
        <span style={{ color: T.text, fontWeight: 600, fontSize: 12 }}>{title}</span>
        {badge && (
          <span style={{
            fontSize: 10, color: T.muted, background: T.border,
            padding: "1px 7px", borderRadius: 3, border: `1px solid ${T.border2}`,
          }}>{badge}</span>
        )}
      </div>
      <div style={{ padding: "12px 14px" }}>{children}</div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function Dashboard() {
  const { T, themeKey } = useTheme();
  const isLight = themeKey === "light";
  const navigate = useNavigate();

  // ── state ──
  const [environments, setEnvironments] = useState([]);
  const [activeEnvId, setActiveEnvId] = useState(() => localStorage.getItem("active_env_id") || "");
  const [activeEnvName, setActiveEnvName] = useState(() => localStorage.getItem("active_env_name") || "");
  const [range, setRange] = useState("1h");
  const [dateMode, setDateMode] = useState("range");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [sessionSecs, setSessionSecs] = useState(getSessionRemainingSeconds);
  const [countdown, setCountdown] = useState(300);

  // data
  const [overview, setOverview] = useState({});
  const [requestRate, setRequestRate] = useState({ today: [], yesterday: [] });
  const [highFailure, setHighFailure] = useState([]);
  const [spikeData, setSpikeData] = useState(null);
  const [burstTimeline, setBurstTimeline] = useState([]);
  const [percentiles, setPercentiles] = useState([]);
  const [topFailing, setTopFailing] = useState([]);
  const [failureCodes, setFailureCodes] = useState([]);

  // ── API detail drawer ──  (now handled by HighFailureApisTable component)

  const gridStroke = isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.04)";
  const ttStyle = {
    contentStyle: { background: T.panel, border: `1px solid ${T.border2}`, borderRadius: 4, padding: "8px 12px", fontSize: 12 },
    labelStyle: { color: T.muted, fontSize: 11, marginBottom: 4 },
    itemStyle: { color: T.text },
  };

  // ── session timer ──
  useEffect(() => {
    const t = setInterval(() => {
      const rem = getSessionRemainingSeconds();
      setSessionSecs(rem);
      if (rem <= 0) handleLogout();
    }, 10000);
    return () => clearInterval(t);
  }, []);

  // ── countdown ──
  useEffect(() => {
    setCountdown(300);
    const t = setInterval(() => setCountdown(c => c > 0 ? c - 1 : 300), 1000);
    return () => clearInterval(t);
  }, [lastRefresh]);

  // ── load environments ──
  useEffect(() => {
    axios.get(API_ENDPOINTS.environments).then(({ data }) => {
      setEnvironments(data);
      if (!activeEnvId && data.length > 0) selectEnv(data[0]);
    }).catch(() => {});
  }, []);

  // ── fetch on env/range change ──
  useEffect(() => {
    if (activeEnvId) fetchAll();
  }, [activeEnvId, range]);

  // ── auto-refresh 5 min ──
  useEffect(() => {
    const t = setInterval(() => { if (activeEnvId) fetchAll(); }, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [activeEnvId, range, customStart, customEnd]);

  function selectEnv(env) {
    setActiveEnvId(env.id);
    setActiveEnvName(env.name);
    localStorage.setItem("active_env_id", env.id);
    localStorage.setItem("active_env_name", env.name);
  }

  function handleLogout() {
    ["auth_token", "auth_expires", "auth_user", "auth"].forEach(k => localStorage.removeItem(k));
    navigate("/");
  }

  async function fetchAll() {
    const envId = getEnvId();
    if (!envId) return;
    setLoading(true);
    const start = dateMode === "custom" ? customStart : null;
    const end   = dateMode === "custom" ? customEnd   : null;

    const [
      ovRes, rrRes, hfRes, spRes, btRes, pcRes, tfRes, fcRes,
    ] = await Promise.allSettled([
      axios.get(API_ENDPOINTS.overview(envId, range, start, end)),
      axios.get(API_ENDPOINTS.requestRate(envId, range, start, end)),
      axios.get(API_ENDPOINTS.highFailureApis(envId, range, start, end)),
      axios.get(API_ENDPOINTS.spikeDetector(envId)),
      axios.get(API_ENDPOINTS.errorBurstTimeline(envId, range)),
      axios.get(API_ENDPOINTS.responsePercentiles(envId, start, end)),
      axios.get(API_ENDPOINTS.topFailingUrls(envId, range, start, end)),
      axios.get(API_ENDPOINTS.failureCodes(envId, range)),
    ]);

    if (ovRes.status === "fulfilled") setOverview(ovRes.value.data || {});
    if (rrRes.status === "fulfilled") setRequestRate(rrRes.value.data || { today: [], yesterday: [] });
    if (hfRes.status === "fulfilled") setHighFailure(hfRes.value.data?.data || []);
    if (spRes.status === "fulfilled") setSpikeData(spRes.value.data || null);
    if (btRes.status === "fulfilled") {
      const d = btRes.value.data;
      setBurstTimeline(Array.isArray(d) ? d : (d?.timeline || []));
    }
    if (pcRes.status === "fulfilled") setPercentiles(pcRes.value.data || []);
    if (tfRes.status === "fulfilled") setTopFailing(tfRes.value.data || []);
    if (fcRes.status === "fulfilled") setFailureCodes(fcRes.value.data || []);

    setLoading(false);
    setLastRefresh(new Date());
  }

  // ── derived data ──
  const maxLen = Math.max(requestRate.today.length, requestRate.yesterday.length);
  const mergedRate = Array.from({ length: maxLen }, (_, i) => ({
    time: requestRate.today[i]?.time || requestRate.yesterday[i]?.time || "",
    Today: requestRate.today[i]?.count ?? null,
    Yesterday: requestRate.yesterday[i]?.count ?? null,
  }));

  const healthScore = overview.errorRate != null
    ? Math.max(0, Math.round(100 - (overview.errorRate || 0) * 5))
    : null;

  const totalSuccess = (overview.totalRequests != null && overview.totalFailures != null)
    ? overview.totalRequests - overview.totalFailures
    : null;

  const STAT_CARDS = [
    {
      label: "Avg Response Time",
      value: overview.avgResponseTime != null ? fmtMs(overview.avgResponseTime) : "—",
      icon: FaClock,
      color: overview.avgResponseTime != null ? rtColor(overview.avgResponseTime, T) : T.blue,
      status: overview.avgResponseTime > 500 ? "CRITICAL" : overview.avgResponseTime > 400 ? "WARNING" : "OK",
    },
    {
      label: "Total Requests",
      value: fmt(overview.totalRequests),
      icon: FaChartBar,
      color: T.blue,
      status: "INFO",
    },
    {
      label: "Total Success",
      value: fmt(totalSuccess),
      icon: FaCheckCircle,
      color: T.green,
      status: "OK",
    },
    {
      label: "Total Failures",
      value: fmt(overview.totalFailures),
      icon: FaTimesCircle,
      color: overview.errorRate > 10 ? T.red : overview.errorRate > 4 ? T.orange : T.green,
      status: overview.errorRate > 10 ? "CRITICAL" : overview.errorRate > 4 ? "WARNING" : "OK",
    },
    {
      label: "Error Rate",
      value: overview.errorRate != null ? fmtPct(overview.errorRate) : "—",
      icon: FaExclamationTriangle,
      color: overview.errorRate != null ? errColor(overview.errorRate, T) : T.muted,
      status: overview.errorRate > 10 ? "CRITICAL" : overview.errorRate > 4 ? "WARNING" : "OK",
    },
    {
      label: "Health Score",
      value: healthScore != null ? `${healthScore}%` : "—",
      icon: FaShieldAlt,
      color: healthScore != null ? (healthScore >= 90 ? T.green : healthScore >= 70 ? T.orange : T.red) : T.muted,
      status: healthScore >= 90 ? "HEALTHY" : healthScore >= 70 ? "DEGRADED" : "CRITICAL",
    },
  ];

  // HTTP status code bar colors
  function codeColor(code) {
    const c = String(code);
    if (c.startsWith("5")) return T.red;
    if (c.startsWith("4")) return T.orange;
    if (c.startsWith("2")) return T.green;
    if (c.startsWith("3")) return T.blue;
    return T.muted;
  }

  // spike status
  const spikeStatus = spikeData?.spikes?.length > 0
    ? spikeData.spikes[0].severity === "critical" ? "CRITICAL" : "WARNING"
    : "NORMAL";
  const spikeColor = spikeStatus === "CRITICAL" ? T.red : spikeStatus === "WARNING" ? T.orange : T.green;

  // ── render ──
  return (
    <div style={{
      background: T.bg, minHeight: "100vh", color: T.text,
      fontFamily: "Inter, Segoe UI, system-ui, sans-serif",
      transition: "background 0.2s, color 0.2s",
    }}>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
        .pulse-dot { display:inline-block; border-radius:50%; animation: pulse 1.5s ease-in-out infinite; }
        .gf-skeleton { background: linear-gradient(90deg, rgba(128,128,128,0.08) 25%, rgba(128,128,128,0.15) 50%, rgba(128,128,128,0.08) 75%); background-size: 200% 100%; animation: shimmer 1.4s infinite; border-radius: 3px; }
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        .gf-stat { background: var(--panel); border: 1px solid var(--border); border-radius: 4px; padding: 14px; position: relative; overflow: hidden; }
        .gf-stat-label { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; gap: 5px; margin-bottom: 6px; }
        .gf-stat-value { font-size: 24px; font-weight: 700; line-height: 1; }
        .gf-stat-unit { font-size: 13px; font-weight: 400; margin-left: 3px; }
        .gf-stat-bar { position: absolute; bottom: 0; left: 0; right: 0; height: 2px; opacity: 0.5; }
        .gf-badge { display: inline-block; padding: 2px 6px; border-radius: 3px; font-size: 10px; font-weight: 600; letter-spacing: 0.04em; }
        .gf-badge-red { background: rgba(242,73,92,0.15); color: #f2495c; }
        .gf-badge-yellow { background: rgba(245,166,35,0.15); color: #f5a623; }
        .gf-badge-green { background: rgba(115,191,105,0.15); color: #73bf69; }
        .gf-badge-blue { background: rgba(87,148,242,0.15); color: #5794f2; }
        .gf-select { background: ${T.surface}; border: 1px solid ${T.border2}; border-radius: 3px; color: ${T.text}; font-size: 12px; padding: 5px 8px; cursor: pointer; outline: none; }
        .gf-btn { border-radius: 4px; font-size: 12px; font-weight: 600; cursor: pointer; padding: 5px 12px; border: none; }
        .gf-btn-primary { background: rgba(87,148,242,0.2); color: ${T.blue}; border: 1px solid rgba(87,148,242,0.4); }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>

      {/* ── Loading overlay ── */}
      {loading && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 999,
          background: "rgba(0,0,0,0.45)", backdropFilter: "blur(3px)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16,
        }}>
          <div style={{
            width: 48, height: 48, border: "3px solid rgba(255,255,255,0.15)",
            borderTopColor: T.blue, borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>Loading dashboard…</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>Querying Azure App Insights</div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TOP NAV BAR
      ══════════════════════════════════════════════════════════════════════ */}
      <div style={{
        background: T.surface, borderBottom: `1px solid ${T.border}`,
        padding: "0 16px", height: 48,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 50,
      }}>
        {/* Left */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Overview</div>
            {lastRefresh && (
              <div style={{ fontSize: 10, color: T.muted, marginTop: -1 }}>
                Updated {lastRefresh.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </div>
            )}
          </div>
          <div style={{ width: 1, height: 24, background: T.border }} />
          <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: countdown < 30 ? T.orange : T.dim }}>
            <FaSync style={{ fontSize: 9, animation: loading ? "spin 1s linear infinite" : "none" }} />
            {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, "0")}
          </span>
        </div>

        {/* Right */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "nowrap" }}>
          {/* Env selector */}
          {environments.length > 0 ? (
            <select
              value={activeEnvId}
              onChange={e => {
                const env = environments.find(x => x.id === e.target.value);
                if (env) selectEnv(env);
              }}
              className="gf-select"
            >
              {environments.map(env => (
                <option key={env.id} value={env.id} style={{ background: T.surface }}>
                  {env.name}
                </option>
              ))}
            </select>
          ) : (
            <button onClick={() => navigate("/setup")} className="gf-btn gf-btn-primary" style={{ fontSize: 11 }}>
              + Add Environment
            </button>
          )}

          {/* Date mode toggle */}
          <div style={{ display: "flex", background: T.surface, border: `1px solid ${T.border2}`, borderRadius: 3, overflow: "hidden" }}>
            {[["range", "Quick"], ["custom", "Custom"]].map(([mode, label]) => (
              <button key={mode} onClick={() => setDateMode(mode)} style={{
                padding: "5px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer",
                border: "none",
                background: dateMode === mode ? "rgba(87,148,242,0.2)" : "transparent",
                color: dateMode === mode ? T.blue : T.muted,
              }}>
                {label}
              </button>
            ))}
          </div>

          {/* Quick range */}
          {dateMode === "range" && (
            <select value={range} onChange={e => setRange(e.target.value)} className="gf-select">
              {[["10m","Last 10 min"],["30m","Last 30 min"],["1h","Last 1 hr"],["6h","Last 6 hrs"],["12h","Last 12 hrs"],["24h","Last 24 hrs"],["7d","Last 7 days"],["30d","Last 30 days"],["90d","Last 90 days"]].map(([v, l]) => (
                <option key={v} value={v} style={{ background: T.surface }}>{l}</option>
              ))}
            </select>
          )}

          {/* Custom range */}
          {dateMode === "custom" && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input type="datetime-local" value={customStart} onChange={e => setCustomStart(e.target.value)}
                style={{ background: T.inputBg, border: `1px solid ${T.border2}`, borderRadius: 3, color: T.text, fontSize: 11, padding: "4px 8px" }} />
              <span style={{ color: T.muted, fontSize: 11 }}>→</span>
              <input type="datetime-local" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
                style={{ background: T.inputBg, border: `1px solid ${T.border2}`, borderRadius: 3, color: T.text, fontSize: 11, padding: "4px 8px" }} />
              <button onClick={fetchAll} className="gf-btn gf-btn-primary" style={{ fontSize: 11, padding: "4px 10px" }}>Apply</button>
            </div>
          )}

          {/* Refresh */}
          <button onClick={fetchAll} disabled={loading} style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "5px 14px",
            background: loading ? "rgba(87,148,242,0.05)" : "rgba(87,148,242,0.12)",
            border: "1px solid rgba(87,148,242,0.3)", borderRadius: 4,
            color: loading ? T.dim : T.blue,
            fontSize: 11, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer",
          }}>
            <FaSync style={{ fontSize: 11, animation: loading ? "spin 1s linear infinite" : "none" }} />
            {loading ? "Loading…" : "Refresh"}
          </button>

          {/* LIVE */}
          <div style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "3px 10px",
            background: "rgba(115,191,105,0.1)", border: "1px solid rgba(115,191,105,0.25)",
            borderRadius: 3, fontSize: 11, color: T.green,
          }}>
            <span className="pulse-dot" style={{ background: T.green, width: 6, height: 6 }} />
            LIVE
          </div>

          {/* Session */}
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "4px 10px",
            background: sessionSecs < 1800 ? "rgba(242,73,92,0.08)" : "rgba(87,148,242,0.06)",
            border: `1px solid ${sessionSecs < 1800 ? "rgba(242,73,92,0.25)" : "rgba(87,148,242,0.2)"}`,
            borderRadius: 4, fontSize: 10,
          }}>
            <FaShieldAlt style={{ color: sessionSecs < 1800 ? T.red : T.blue, fontSize: 10 }} />
            <span style={{ color: sessionSecs < 1800 ? T.red : T.muted }}>
              {localStorage.getItem("auth_user") || "admin"} · {Math.floor(sessionSecs / 3600)}h {Math.floor((sessionSecs % 3600) / 60)}m
            </span>
          </div>

          {/* Logout */}
          <button onClick={handleLogout} style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "5px 10px", background: "transparent",
            border: `1px solid ${T.border2}`, borderRadius: 4,
            color: T.muted, fontSize: 11, cursor: "pointer",
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = T.red; e.currentTarget.style.color = T.red; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = T.border2; e.currentTarget.style.color = T.muted; }}
          >
            <FaSignOutAlt style={{ fontSize: 11 }} /> Logout
          </button>
        </div>
      </div>

      {/* ── No env warning ── */}
      {environments.length === 0 && (
        <div style={{ margin: 16, padding: 14, background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.3)", borderRadius: 4, fontSize: 13, color: T.orange }}>
          ⚠ No environments configured.{" "}
          <button onClick={() => navigate("/setup")} style={{ background: "none", border: "none", color: T.blue, cursor: "pointer", textDecoration: "underline", fontSize: 13 }}>
            Add an environment
          </button>{" "}to start monitoring.
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          CONTENT
      ══════════════════════════════════════════════════════════════════════ */}
      <div style={{ padding: "16px 16px 32px" }}>

        {/* ── 6 STAT CARDS ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8, marginBottom: 16 }}>
          {loading
            ? Array(6).fill(0).map((_, i) => (
                <div key={i} style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 4, padding: 14 }}>
                  <Skel h={11} w="55%" mb={10} /><Skel h={28} w="70%" />
                </div>
              ))
            : STAT_CARDS.map(({ label, value, icon: Icon, color, status }, i) => (
                <div key={i} style={{
                  background: T.panel, border: `1px solid ${color}30`,
                  borderRadius: 4, padding: 14, position: "relative", overflow: "hidden",
                }}>
                  <div style={{ fontSize: 11, color: T.muted, textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
                    <Icon style={{ color, fontSize: 11 }} />{label}
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700, color, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{value}</div>
                  <div style={{ marginTop: 8 }}>
                    <span className={`gf-badge ${status === "CRITICAL" ? "gf-badge-red" : status === "WARNING" || status === "DEGRADED" ? "gf-badge-yellow" : status === "INFO" ? "gf-badge-blue" : "gf-badge-green"}`}>
                      {status}
                    </span>
                  </div>
                  <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${color}, transparent)`, opacity: 0.5 }} />
                </div>
              ))
          }
        </div>

        {/* ── ROW 2: Request Rate chart + High Failure APIs table ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>

          {/* Request Rate Area Chart */}
          <Panel T={T} accent={T.blue} title="Request Rate" badge="Today vs Yesterday">
            {loading ? <Skel h={200} /> : (
              <div style={{ background: T.chartBg, borderRadius: 2, padding: "8px 4px 4px", border: `1px solid ${T.border}`, margin: "0 -2px" }}>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={mergedRate} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradToday" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={T.blue} stopOpacity={0.4} />
                      <stop offset="90%" stopColor={T.blue} stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="gradYest" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={T.muted} stopOpacity={0.25} />
                      <stop offset="90%" stopColor={T.muted} stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 4" stroke={gridStroke} vertical={false} />
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: T.muted }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: T.muted }} axisLine={false} tickLine={false} width={36} />
                  <Tooltip {...ttStyle} />
                  <Legend wrapperStyle={{ fontSize: 11, color: T.muted }} />
                  <Area type="monotone" dataKey="Today" stroke={T.blue} strokeWidth={2} fill="url(#gradToday)" dot={false} isAnimationActive={false} />
                  <Area type="monotone" dataKey="Yesterday" stroke={isLight ? "#6070a0" : T.muted} strokeWidth={1.5} strokeDasharray="4 2" fill="url(#gradYest)" dot={false} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
              </div>
            )}
          </Panel>

          {/* High Failure APIs — full component with expand-on-click */}
          <div>
            <HighFailureApisTable
              range={range}
              startDate={dateMode === "custom" ? customStart : null}
              endDate={dateMode === "custom" ? customEnd : null}
            />
          </div>
        </div>

        {/* ── ROW 3: OUTAGE DETECTION ZONE ── */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
            <FaBolt style={{ color: T.orange }} /> Outage Detection Zone
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: 8 }}>

            {/* Live Spike Detector */}
            <div style={{ background: T.panel, border: `1px solid ${spikeColor}40`, borderRadius: 4, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderBottom: `1px solid ${T.border}`, background: T.surface }}>
                <FaBolt style={{ color: spikeColor, fontSize: 12 }} />
                <span style={{ color: T.text, fontWeight: 600, fontSize: 12 }}>Live Spike Detector</span>
                <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 700, color: spikeColor, background: `${spikeColor}18`, padding: "2px 8px", borderRadius: 3, border: `1px solid ${spikeColor}40` }}>
                  {spikeStatus}
                </span>
              </div>
              <div style={{ padding: "14px" }}>
                {loading || !spikeData ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {Array(4).fill(0).map((_, i) => <Skel key={i} h={40} />)}
                  </div>
                ) : (
                  <>
                    {/* 4 metric tiles */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                      {[
                        {
                          label: "Error Rate",
                          curr: fmtPct(spikeData.current?.errorRate),
                          prev: fmtPct(spikeData.previous?.errorRate),
                          color: errColor(spikeData.current?.errorRate || 0, T),
                        },
                        {
                          label: "Requests / 5m",
                          curr: fmt(spikeData.current?.total),
                          prev: fmt(spikeData.previous?.total),
                          color: T.blue,
                        },
                        {
                          label: "Avg Response",
                          curr: fmtMs(spikeData.current?.avgRt),
                          prev: fmtMs(spikeData.previous?.avgRt),
                          color: rtColor(spikeData.current?.avgRt || 0, T),
                        },
                        {
                          label: "Spike Status",
                          curr: spikeStatus,
                          prev: `${spikeData.spikes?.length || 0} active`,
                          color: spikeColor,
                        },
                      ].map(({ label, curr, prev, color }) => (
                        <div key={label} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 4, padding: "10px 12px" }}>
                          <div style={{ fontSize: 10, color: T.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>{label}</div>
                          <div style={{ fontSize: 18, fontWeight: 700, color }}>{curr}</div>
                          <div style={{ fontSize: 10, color: T.dim, marginTop: 2 }}>prev: {prev}</div>
                        </div>
                      ))}
                    </div>

                    {/* Spike alerts */}
                    {spikeData.spikes?.length > 0 ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {spikeData.spikes.map((sp, i) => (
                          <div key={i} style={{
                            padding: "8px 12px", borderRadius: 4,
                            background: sp.severity === "critical" ? "rgba(242,73,92,0.08)" : "rgba(245,166,35,0.08)",
                            border: `1px solid ${sp.severity === "critical" ? "rgba(242,73,92,0.3)" : "rgba(245,166,35,0.3)"}`,
                          }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: sp.severity === "critical" ? T.red : T.orange, marginBottom: 2 }}>
                              {sp.severity === "critical" ? "🔴" : "🟡"} {sp.title}
                            </div>
                            <div style={{ fontSize: 10, color: T.muted }}>{sp.message}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ textAlign: "center", padding: "10px 0", fontSize: 12, color: T.green }}>
                        ✅ No spikes detected in last 5 minutes
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Error Burst Timeline */}
            <Panel T={T} accent={T.red} title="Error Burst Timeline" badge="error rate % + avg response ms">
              {loading ? <Skel h={220} /> : (
                <div style={{ background: T.chartBg, borderRadius: 2, padding: "8px 4px 4px" }}>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={burstTimeline} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradErr" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={T.red} stopOpacity={0.4} />
                        <stop offset="90%" stopColor={T.red} stopOpacity={0.03} />
                      </linearGradient>
                      <linearGradient id="gradRt" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={T.orange} stopOpacity={0.3} />
                        <stop offset="90%" stopColor={T.orange} stopOpacity={0.03} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="2 4" stroke={gridStroke} vertical={false} />
                    <XAxis dataKey="time" tick={{ fontSize: 10, fill: T.muted }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="left" tick={{ fontSize: 10, fill: T.muted }} axisLine={false} tickLine={false} width={36} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: T.muted }} axisLine={false} tickLine={false} width={50} />
                    <Tooltip {...ttStyle} />
                    <Legend wrapperStyle={{ fontSize: 11, color: T.muted }} />
                    <Area yAxisId="left" type="monotone" dataKey="errorRate" name="Error Rate %" stroke={T.red} strokeWidth={2} fill="url(#gradErr)" dot={false} isAnimationActive={false} />
                    <Area yAxisId="right" type="monotone" dataKey="avgRt" name="Avg RT (ms)" stroke={T.orange} strokeWidth={1.5} fill="url(#gradRt)" dot={false} isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
                </div>
              )}
            </Panel>
          </div>
        </div>

        {/* ── ROW 4: Response Time Percentiles + Top Failing Endpoints ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 8, marginBottom: 8 }}>

          {/* Response Time Percentiles */}
          <Panel T={T} accent={T.cyan || T.blue} title="Response Time Percentiles" badge="p50 / p95 / p99">
            {loading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {Array(6).fill(0).map((_, i) => <Skel key={i} h={14} w={`${60 + i * 6}%`} />)}
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                  <thead>
                    <tr>
                      {["Operation", "Count", "Curr Avg", "Prev Avg", "Δ%", "SLA"].map(h => (
                        <th key={h} style={{ padding: "5px 8px", textAlign: h === "Operation" ? "left" : "right", fontSize: 10, fontWeight: 600, color: T.muted, textTransform: "uppercase", borderBottom: `1px solid ${T.border}`, whiteSpace: "nowrap", background: T.surface }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {percentiles.length === 0 ? (
                      <tr><td colSpan={6} style={{ textAlign: "center", color: T.dim, padding: "16px 0", fontStyle: "italic" }}>No data</td></tr>
                    ) : percentiles.slice(0, 10).map((row, i) => {
                      const diff = row.diffPercent ?? row.diff_percent ?? 0;
                      const diffColor = diff > 20 ? T.red : diff > 10 ? T.orange : T.green;
                      const slaOk = (row.currentAvgResponseTime || 0) <= 500;
                      return (
                        <tr key={i} style={{ background: i % 2 === 0 ? T.panel : T.surface }}>
                          <td style={{ padding: "5px 8px", color: T.text, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", borderBottom: `1px solid ${T.border}` }} title={row.operationName}>{row.operationName}</td>
                          <td style={{ padding: "5px 8px", textAlign: "right", color: T.muted, borderBottom: `1px solid ${T.border}` }}>{fmt(row.currentCount)}</td>
                          <td style={{ padding: "5px 8px", textAlign: "right", color: rtColor(row.currentAvgResponseTime, T), fontWeight: 600, borderBottom: `1px solid ${T.border}` }}>{fmtMs(row.currentAvgResponseTime)}</td>
                          <td style={{ padding: "5px 8px", textAlign: "right", color: T.muted, borderBottom: `1px solid ${T.border}` }}>{row.previousAvgResponseTime ? fmtMs(row.previousAvgResponseTime) : "—"}</td>
                          <td style={{ padding: "5px 8px", textAlign: "right", color: diffColor, fontWeight: 600, borderBottom: `1px solid ${T.border}` }}>
                            {diff !== 0 ? `${deltaArrow(diff)} ${Math.abs(diff).toFixed(1)}%` : "—"}
                          </td>
                          <td style={{ padding: "5px 8px", textAlign: "right", borderBottom: `1px solid ${T.border}` }}>
                            <span className={`gf-badge ${slaOk ? "gf-badge-green" : "gf-badge-red"}`}>{slaOk ? "OK" : "BREACH"}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          {/* Top Failing Endpoints */}
          <Panel T={T} accent={T.red} title="Top Failing Endpoints" badge="by failure count">
            {loading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {Array(8).fill(0).map((_, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Skel h={12} w="60%" />
                    <Skel h={12} w="20%" />
                  </div>
                ))}
              </div>
            ) : topFailing.length === 0 ? (
              <div style={{ textAlign: "center", color: T.dim, padding: "20px 0", fontStyle: "italic", fontSize: 12 }}>No failing endpoints</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {topFailing.slice(0, 10).map((ep, i) => {
                  const failCount = ep.failure_count || ep.failureCount || 0;
                  const er = ep.error_rate ?? null;
                  const ec = er != null ? errColor(er, T) : T.red;
                  const barW = Math.min(100, (failCount / (Math.max(topFailing[0]?.failure_count || topFailing[0]?.failureCount || 1, 1))) * 100);
                  return (
                    <div key={i} style={{ padding: "7px 10px", background: i % 2 === 0 ? T.surface : T.panel, borderRadius: 3, border: `1px solid ${T.border}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <span style={{ fontSize: 11, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "65%" }} title={ep.operation_Name || ep.name}>
                          {ep.operation_Name || ep.name}
                        </span>
                        <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                          <span style={{ fontSize: 10, color: T.red, fontWeight: 600 }}>{fmt(failCount)} fails</span>
                          {er != null && <span style={{ fontSize: 10, color: ec, fontWeight: 700 }}>{fmtPct(er)}</span>}
                        </div>
                      </div>
                      <div style={{ height: 3, background: T.border, borderRadius: 2, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${barW}%`, background: T.red, borderRadius: 2, transition: "width 0.4s" }} />
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
                        <span style={{ fontSize: 9, color: T.dim }}>codes: {ep.resultCodes || ep.result_codes || "—"}</span>
                        <span style={{ fontSize: 9, color: T.dim }}>{ep.lastSeen && ep.lastSeen !== "-" ? `last: ${ep.lastSeen}` : ""}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>
        </div>

        {/* ── ROW 5: HTTP Status Code Distribution ── */}
        <Panel T={T} accent={T.blue} title="HTTP Status Code Distribution" badge="failure codes by count">
          {loading ? <Skel h={180} /> : failureCodes.length === 0 ? (
            <div style={{ textAlign: "center", color: T.dim, padding: "20px 0", fontStyle: "italic", fontSize: 12 }}>No failure code data</div>
          ) : (
            <div style={{ background: T.chartBg, borderRadius: 2, padding: "8px 4px 4px" }}>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart
                data={failureCodes.map(d => ({ code: String(d.statusCode || d.code || "?"), count: d.count }))}
                margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="2 4" stroke={gridStroke} vertical={false} />
                <XAxis dataKey="code" tick={{ fontSize: 11, fill: T.muted }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: T.muted }} axisLine={false} tickLine={false} width={40} />
                <Tooltip
                  {...ttStyle}
                  formatter={(val, name, props) => [fmt(val), `HTTP ${props.payload.code}`]}
                />
                <Bar dataKey="count" radius={[3, 3, 0, 0]} maxBarSize={48}>
                  {failureCodes.map((d, i) => (
                    <Cell key={i} fill={codeColor(d.statusCode || d.code)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            </div>
          )}
        </Panel>

      </div>{/* end content */}
    </div>
  );
}
