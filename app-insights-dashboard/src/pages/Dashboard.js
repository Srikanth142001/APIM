import { useEffect, useState, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import CountUp from "react-countup";
import {
  ResponsiveContainer, XAxis, Tooltip,
  YAxis, AreaChart, Area, CartesianGrid,
} from "recharts";
import { FaUserCircle, FaClock, FaCheckCircle, FaTimesCircle, FaExclamationTriangle, FaDatabase, FaBell, FaSync, FaSignOutAlt, FaShieldAlt } from "react-icons/fa";
import { getSessionRemainingSeconds } from "../config/axiosSetup";
import DashboardTable from "../components/ui/DashboardTable";
import DateRangePicker from "../components/ui/DateRangePicker";
import NodeCpuOverview from "./NodeCpuOverview";
import MySQLConnectionsCard from "./MySQLConnectionsCard";
import MySQLMetricsCharts from "./MySQLMetricsCharts";
import NodePoolChart from "./NodePoolChart";
import HealthScore from "../components/ui/HealthScore";
import SLATracker from "../components/ui/SLATracker";
import AlertCenter, { generateAlerts } from "../components/ui/AlertCenter";
import TopologyMap from "../components/ui/TopologyMap";
import FailureCodeChart from "../components/ui/FailureCodeChart";
import QuickActions from "../components/ui/QuickActions";
import OutageDetectionPanel from "./OutageDetectionPanel";
import ApiAnalyticsTab from "./tabs/ApiAnalyticsTab";
import InfrastructureTab from "./tabs/InfrastructureTab";
import MySQLTab from "./tabs/MySQLTab";
import AlertsTab from "./tabs/AlertsTab";
import MLAlertsTab from "./tabs/MLAlertsTab";
import HighFailureApisTable from "../components/ui/HighFailureApisTable";
import "../App.css";
import { API_ENDPOINTS, API_CONFIG } from "../config/apiConfig";
import { useTheme } from "../context/ThemeContext";
import { useFeatures } from "../context/FeaturesContext";

// ── Shared chart card style — built dynamically using T from theme ───────────
const makeChartCard = (T) => ({
  flex: 1,
  background: T.panel,
  border: `1px solid ${T.border}`,
  borderRadius: 4,
  padding: "0",
  overflow: "hidden",
});

const makeChartTooltipStyle = (T) => ({
  contentStyle: { background: T.panel, border: `1px solid ${T.border2}`, borderRadius: 4, padding: "8px 12px", boxShadow: "0 4px 20px rgba(0,0,0,0.6)", fontSize: 12 },
  labelStyle: { color: T.muted, fontSize: 11, marginBottom: 4 },
  itemStyle: { color: T.text },
});

const ChartHeader = ({ color = "#5794f2", title, badge, legend, T }) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px", borderBottom: `1px solid ${T.border}`, background: T.surface, minHeight: 36 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ width: 3, height: 16, borderRadius: 2, background: color, flexShrink: 0 }} />
      <span style={{ color: T.text, fontWeight: 600, fontSize: 12, letterSpacing: "0.02em" }}>{title}</span>
      {badge && <span style={{ color: T.muted, fontSize: 11, background: T.border, padding: "1px 7px", borderRadius: 3, border: `1px solid ${T.border2}` }}>{badge}</span>}
    </div>
    <div style={{ display: "flex", gap: 14, fontSize: 11 }}>
      {legend.map(({ label, color: lc, dashed }) => (
        <span key={label} style={{ display: "flex", alignItems: "center", gap: 5, color: T.muted }}>
          <span style={{ display: "inline-block", width: 16, height: 2, borderRadius: 1, background: dashed ? "none" : lc, borderTop: dashed ? `2px dashed ${lc}` : "none", opacity: 0.9 }} />
          <span style={{ color: lc }}>{label}</span>
        </span>
      ))}
    </div>
  </div>
);

const LoaderCard = ({ T }) => (
  <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 4, padding: 14 }}>
    <div className="gf-skeleton" style={{ height: 11, width: "50%", marginBottom: 10 }} />
    <div className="gf-skeleton" style={{ height: 28, width: "70%" }} />
  </div>
);

const METRIC_CARDS = (overview, activeConnections, mysqlApiError) => [
  {
    title: "Avg Response Time", value: overview.avgResponseTime, unit: "ms", icon: FaClock,
    color: overview.avgResponseTime > 500 ? "#f2495c" : overview.avgResponseTime > 400 ? "#f5a623" : "#73bf69",
    barColor: overview.avgResponseTime > 500 ? "#f2495c" : overview.avgResponseTime > 400 ? "#f5a623" : "#73bf69",
    status: overview.avgResponseTime > 500 ? "CRITICAL" : overview.avgResponseTime > 400 ? "WARNING" : "OK",
  },
  {
    title: "Total Requests", value: overview.totalRequests, unit: "", icon: FaCheckCircle,
    color: "#5794f2", barColor: "#5794f2", status: "INFO",
  },
  {
    title: "Total Success", value: (overview.totalRequests || 0) - (overview.totalFailures || 0), unit: "", icon: FaCheckCircle,
    color: overview.errorRate > 6 ? "#f2495c" : overview.errorRate >= 4 ? "#f5a623" : "#73bf69",
    barColor: overview.errorRate > 6 ? "#f2495c" : overview.errorRate >= 4 ? "#f5a623" : "#73bf69",
    status: overview.errorRate > 6 ? "CRITICAL" : overview.errorRate >= 4 ? "WARNING" : "OK",
  },
  {
    title: "Total Failures", value: overview.totalFailures, unit: "", icon: FaTimesCircle,
    color: overview.errorRate > 10 ? "#f2495c" : overview.errorRate >= 4 ? "#f5a623" : "#73bf69",
    barColor: overview.errorRate > 10 ? "#f2495c" : overview.errorRate >= 4 ? "#f5a623" : "#73bf69",
    status: overview.errorRate > 10 ? "CRITICAL" : overview.errorRate >= 4 ? "WARNING" : "OK",
  },
  {
    title: "Error Rate", value: overview.errorRate, unit: "%", icon: FaExclamationTriangle,
    color: overview.errorRate > 10 ? "#f2495c" : overview.errorRate >= 4 ? "#f5a623" : "#73bf69",
    barColor: overview.errorRate > 10 ? "#f2495c" : overview.errorRate >= 4 ? "#f5a623" : "#73bf69",
    status: overview.errorRate > 10 ? "CRITICAL" : overview.errorRate >= 4 ? "WARNING" : "OK",
  },
  {
    title: "MySQL Active Conn", value: activeConnections, unit: "", icon: FaDatabase,
    color: mysqlApiError ? "#8e8e8e" : activeConnections > 5000 ? "#f2495c" : activeConnections >= 4000 ? "#f5a623" : "#73bf69",
    barColor: mysqlApiError ? "#8e8e8e" : activeConnections > 5000 ? "#f2495c" : "#73bf69",
    status: mysqlApiError ? "N/A" : activeConnections > 5000 ? "CRITICAL" : "OK",
    error: mysqlApiError,
  },
];

const Dashboard = () => {
  const { T, themeKey } = useTheme();
  const features = useFeatures();
  const isLight = themeKey === "light";
  const chartCard = makeChartCard(T);
  const chartTooltipStyle = makeChartTooltipStyle(T);
  const gridStroke = isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.04)";
  const [overview, setOverview] = useState({});
  const [chartData, setChartData] = useState([]);
  const [topApis, setTopApis] = useState([]);
  const [failures, setFailures] = useState([]);
  const [requestRateData, setRequestRateData] = useState({ today: [], yesterday: [] });
  const [percentiles, setPercentiles] = useState([]);
  const [range, setRange] = useState("24h");
  const [loading, setLoading] = useState(true);
  const [exceptions, setExceptions] = useState([]);
  const [failureDiffs, setFailureDiffs] = useState([]);
  const [dataToday, setDataToday] = useState([]);
  const [dataYesterday, setDataYesterday] = useState([]);
  const [activeConnections, setActiveConnections] = useState(0);
  const [mysqlApiError, setMysqlApiError] = useState(false);
  // Custom date range state
  const [dateMode, setDateMode] = useState("range"); // "range" | "custom"
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerDates, setPickerDates] = useState({ startDate: null, endDate: null });
  const pickerRef = useRef(null);
  // New feature states
  const [showAlerts, setShowAlerts] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [nodeCount, setNodeCount] = useState(0);
  const [readyNodes, setReadyNodes] = useState(0);
  const [countdown, setCountdown] = useState(300); // 5 min countdown
  const [activeTab, setActiveTab] = useState("overview"); // overview | analytics | infra | mysql | alerts

  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_expires");
    localStorage.removeItem("auth_user");
    localStorage.removeItem("auth");
    navigate("/");
  };

  // Session countdown
  const [sessionSecs, setSessionSecs] = useState(getSessionRemainingSeconds());
  useEffect(() => {
    const t = setInterval(() => {
      const rem = getSessionRemainingSeconds();
      setSessionSecs(rem);
      if (rem <= 0) { handleLogout(); }
    }, 10000); // check every 10s
    return () => clearInterval(t);
  }, []);

  // Sync tab from URL search param (sidebar navigation)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get("tab");
    setActiveTab(tab || "overview");
  }, [location.search]);

  // Close picker on outside click
  useEffect(() => {
    const handler = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setShowDatePicker(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Returns ISO strings — uses overrides when provided (avoids stale closure on setState)
  const getDateParams = (overrideStart, overrideEnd) => {
    // If explicit overrides are passed (e.g. from onApply), always use them
    if (overrideStart !== undefined && overrideEnd !== undefined) {
      return { startDate: overrideStart || null, endDate: overrideEnd || null };
    }
    // Otherwise fall back to current state
    if (customStart && customEnd) {
      return { startDate: customStart, endDate: customEnd };
    }
    return { startDate: null, endDate: null };
  };

  const fetchData = async (selectedRange, overrideStart, overrideEnd) => {
    setLoading(true);
    const { startDate, endDate } = getDateParams(overrideStart, overrideEnd);
    try {
      const apiCalls = [
        { name: "overview",        call: () => axios.get(API_ENDPOINTS.overview(selectedRange, startDate, endDate)) },
        { name: "chart",           call: () => axios.get(API_ENDPOINTS.responseTimeChart(selectedRange, startDate, endDate)) },
        { name: "apis",            call: () => axios.get(API_ENDPOINTS.topApis(selectedRange, startDate, endDate)) },
        { name: "failures",        call: () => axios.get(API_ENDPOINTS.failures(selectedRange, startDate, endDate)) },
        { name: "requestRate",     call: () => axios.get(API_ENDPOINTS.requestRate(selectedRange, startDate, endDate)) },
        { name: "percentiles",     call: () => axios.get(API_ENDPOINTS.responsePercentiles(startDate, endDate)) },
        { name: "exceptions",      call: () => axios.get(API_ENDPOINTS.exceptions(startDate, endDate)) },
        { name: "dependencies",    call: () => axios.get(API_ENDPOINTS.dependencies(startDate, endDate)) },
        { name: "responseCompare", call: () => axios.get(API_ENDPOINTS.responseCompare(startDate, endDate)) },
        { name: "mysqlConnections",call: () => axios.get(API_ENDPOINTS.mysqlConn) },
      ];
      const results = {};
      await Promise.allSettled(apiCalls.map(async ({ name, call }) => {
        try { results[name] = (await call()).data; }
        catch {
          const defaults = { overview: { avgResponseTime:0, totalRequests:0, totalFailures:0, errorRate:0, total_diff_percentage:0 }, chart:[], apis:[], failures:[], requestRate:{ today:[], yesterday:[] }, percentiles:[], exceptions:{ increasedBy30Percent:[] }, dependencies:[], responseCompare:[], mysqlConnections:{ results:[] } };
          results[name] = defaults[name] ?? null;
        }
      }));

      setOverview(results.overview || {});
      setChartData(results.chart || []);
      setTopApis(results.apis || []);
      setFailures(results.failures || []);
      setRequestRateData(results.requestRate || { today: [], yesterday: [] });
      setPercentiles(results.percentiles || []);
      setExceptions(results.exceptions?.increasedBy30Percent || []);
      setFailureDiffs(results.dependencies || []);
      const raw = results.responseCompare || [];
      setDataToday(raw.filter(d => d.period === "Today"));
      setDataYesterday(raw.filter(d => d.period === "Yesterday"));
      const activeConn = results.mysqlConnections?.results?.find(r => r.name === "active_connections");
      setActiveConnections(activeConn?.metricData?.at(-1)?.maximum || 0);
      setMysqlApiError(!results.mysqlConnections?.results?.length);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setLastRefresh(new Date()); }
  };

  useEffect(() => { fetchData(range, customStart || undefined, customEnd || undefined); }, [range]);
  useEffect(() => {
    const t = setInterval(() => fetchData(range, customStart || undefined, customEnd || undefined), 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [range, customStart, customEnd]);

  // Countdown timer
  useEffect(() => {
    setCountdown(300);
    const t = setInterval(() => setCountdown(c => c > 0 ? c - 1 : 300), 1000);
    return () => clearInterval(t);
  }, [lastRefresh]);

  // Fetch node data for health score
  useEffect(() => {
    axios.get(API_ENDPOINTS.nodeCpu)
      .then(res => {
        const table = res.data?.tables?.[0];
        if (!table) return;
        const cols = table.columns.map(c => c.name);
        const rows = table.rows.map(row => { const o = {}; cols.forEach((c, i) => o[c] = row[i]); return o; });
        setNodeCount(rows.length);
        setReadyNodes(rows.filter(n => n.NodeStatus === "Ready").length);
      })
      .catch(() => {});
  }, []);

  const formatCount = (v) => v >= 1_000_000 ? `${(v/1_000_000).toFixed(1)}M` : v >= 1_000 ? `${(v/1_000).toFixed(1)}K` : v;

  // Merge today+yesterday by index for full x-axis coverage
  const maxLen = Math.max(requestRateData.today.length, requestRateData.yesterday.length);
  const mergedReq = Array.from({ length: maxLen }, (_, i) => ({
    time: requestRateData.today[i]?.time || requestRateData.yesterday[i]?.time || "",
    Today: requestRateData.today[i]?.count,
    Yesterday: requestRateData.yesterday[i]?.count,
  }));

  const maxRtLen = Math.max(dataToday.length, dataYesterday.length);
  const mergedRt = Array.from({ length: maxRtLen }, (_, i) => ({
    time: dataToday[i]?.time || dataYesterday[i]?.time || "",
    Today: dataToday[i]?.value,
    Yesterday: dataYesterday[i]?.value,
  }));

  return (
    <div style={{ background: T.bg, minHeight: "100vh", color: T.text, fontFamily: "Inter, Segoe UI, system-ui, sans-serif", padding: "0", transition: "background 0.2s, color 0.2s" }} className="hide-scrollbar">

      {/* ── Top Nav Bar ── */}
      <div style={{ background: T.surface, borderBottom: `1px solid ${T.border}`, padding: "0 16px", height: 48, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50, transition: "background 0.2s" }}>

        {/* Left: title + last refresh */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.text, letterSpacing: "0.01em" }}>Live Dashboard</div>
            <div style={{ fontSize: 10, color: T.muted, marginTop: -1 }}>{API_CONFIG.regionName}</div>
          </div>
          <div style={{ width: 1, height: 24, background: T.border, margin: "0 4px" }} />
          {lastRefresh && (
            <span style={{ fontSize: 11, color: T.dim }}>
              Updated {lastRefresh.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          )}
          <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: countdown < 30 ? T.orange : T.dim }}>
            <FaSync style={{ fontSize: 9, animation: loading ? "spin 1s linear infinite" : "none" }} />
            {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, "0")}
          </span>
        </div>

        {/* Right: controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>

          {/* ── Refresh button ── */}
          <button
            onClick={() => fetchData(range, customStart || undefined, customEnd || undefined)}
            disabled={loading}
            title="Refresh data"
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "5px 14px",
              background: loading ? "rgba(87,148,242,0.05)" : "rgba(87,148,242,0.12)",
              border: "1px solid rgba(87,148,242,0.3)",
              borderRadius: 4, color: loading ? T.dim : T.blue,
              fontSize: 11, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer",
              transition: "all 0.15s",
            }}
            onMouseEnter={e => { if (!loading) { e.currentTarget.style.background = "rgba(87,148,242,0.22)"; e.currentTarget.style.borderColor = "rgba(87,148,242,0.6)"; }}}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(87,148,242,0.12)"; e.currentTarget.style.borderColor = "rgba(87,148,242,0.3)"; }}
          >
            <FaSync style={{ fontSize: 11, animation: loading ? "spin 1s linear infinite" : "none" }} />
            {loading ? "Refreshing..." : "Refresh"}
          </button>

          <div style={{ width: 1, height: 24, background: T.border }} />

          {/* Live indicator */}
          <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 10px", background: "rgba(115,191,105,0.1)", border: "1px solid rgba(115,191,105,0.25)", borderRadius: 3, fontSize: 11, color: "#73bf69" }}>
            <span className="pulse-dot" style={{ background: "#73bf69", width: 6, height: 6 }} />
            LIVE
          </div>

          {/* Alert Bell */}
          {(() => {
            const alerts = generateAlerts(overview, activeConnections, mysqlApiError);
            const critCount = alerts.filter(a => a.severity === "critical").length;
            return (
              <button onClick={() => setShowAlerts(v => !v)}
                style={{ position: "relative", background: showAlerts ? "rgba(87,148,242,0.15)" : "transparent", border: `1px solid ${critCount > 0 ? "rgba(242,73,92,0.4)" : T.border2}`, borderRadius: 3, padding: "5px 10px", cursor: "pointer", color: critCount > 0 ? "#f2495c" : T.muted, display: "flex", alignItems: "center", gap: 5, fontSize: 11 }}>
                <FaBell style={{ fontSize: 13 }} />
                {critCount > 0 && <span style={{ background: "#f2495c", color: "#fff", borderRadius: 10, fontSize: 10, fontWeight: 700, padding: "0 5px", minWidth: 16, textAlign: "center" }}>{critCount}</span>}
              </button>
            );
          })()}
          {/* Date Mode Toggle */}
          <div style={{ display: "flex", background: T.surface, border: `1px solid ${T.border2}`, borderRadius: 3, overflow: "hidden" }}>
            {[["range", "Quick Range"], ["custom", "Custom"]].map(([mode, label]) => (
              <button key={mode} onClick={() => {
                setDateMode(mode);
                if (mode === "range") { setCustomStart(""); setCustomEnd(""); setShowDatePicker(false); setPickerDates({ startDate: null, endDate: null }); }
                else setShowDatePicker(v => !v);
              }}
                style={{ padding: "5px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer", border: "none", background: dateMode === mode ? "rgba(87,148,242,0.2)" : "transparent", color: dateMode === mode ? T.blue : T.muted, transition: "all 0.15s" }}>
                {label}
              </button>
            ))}
          </div>

          {/* Quick Range Selector */}
          {dateMode === "range" && (
            <div style={{ position: "relative" }}>
              <select value={range} onChange={e => setRange(e.target.value)} className="gf-select">
                {[["10m","Last 10 min"],["30m","Last 30 min"],["1h","Last 1 hour"],["6h","Last 6 hours"],["12h","Last 12 hours"],["24h","Last 24 hours"],["7d","Last 7 days"],["30d","Last 30 days"]].map(([v,l]) => <option key={v} value={v} style={{ background: T.surface }}>{l}</option>)}
              </select>
            </div>
          )}

          {/* Custom Date */}
          {dateMode === "custom" && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button onClick={() => setShowDatePicker(v => !v)} className="gf-btn gf-btn-secondary" style={{ fontSize: 11 }}>
                📅 {customStart && customEnd
                  ? `${new Date(customStart).toLocaleDateString("en-GB", { day:"2-digit", month:"short" })} → ${new Date(customEnd).toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" })}`
                  : "Select Range"}
              </button>
              {customStart && customEnd && (
                <button onClick={() => { setCustomStart(""); setCustomEnd(""); setPickerDates({ startDate: null, endDate: null }); fetchData(range, null, null); }} className="gf-btn" style={{ background: "rgba(242,73,92,0.1)", border: "1px solid rgba(242,73,92,0.3)", color: "#f2495c", fontSize: 11, padding: "5px 8px" }}>✕</button>
              )}
            </div>
          )}

          {/* DateRangePicker Dropdown */}
          {dateMode === "custom" && showDatePicker && (
            <div ref={pickerRef} style={{ position: "absolute", top: 52, right: 60, zIndex: 1000 }}>
              <DateRangePicker
                startDate={pickerDates.startDate}
                endDate={pickerDates.endDate}
                onChange={({ startDate, endDate }) => setPickerDates({ startDate, endDate })}
                onApply={(start, end, isPreset, presetRange) => {
                  if (isPreset && presetRange) {
                    // Quick Select preset — use range mode, not absolute dates
                    setDateMode("range");
                    setRange(presetRange);
                    setCustomStart("");
                    setCustomEnd("");
                    setPickerDates({ startDate: null, endDate: null });
                    setShowDatePicker(false);
                    fetchData(presetRange, null, null);
                  } else {
                    // Manual calendar selection — use absolute dates
                    setCustomStart(start);
                    setCustomEnd(end);
                    setDateMode("custom");
                    setShowDatePicker(false);
                    fetchData(range, start, end);
                  }
                }}
                onClear={() => { setPickerDates({ startDate: null, endDate: null }); setCustomStart(""); setCustomEnd(""); }}
              />
            </div>
          )}

          {/* Session info + logout */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", background: sessionSecs < 1800 ? "rgba(242,73,92,0.08)" : "rgba(87,148,242,0.06)", border: `1px solid ${sessionSecs < 1800 ? "rgba(242,73,92,0.25)" : "rgba(87,148,242,0.2)"}`, borderRadius: 4, fontSize: 10 }}>
            <FaShieldAlt style={{ color: sessionSecs < 1800 ? "#f2495c" : T.blue, fontSize: 10 }} />
            <span style={{ color: sessionSecs < 1800 ? "#f2495c" : T.muted }}>
              {localStorage.getItem("auth_user") || "admin"} · {Math.floor(sessionSecs / 3600)}h {Math.floor((sessionSecs % 3600) / 60)}m left
            </span>
          </div>
          <button onClick={handleLogout}
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", background: "transparent", border: `1px solid ${T.border2}`, borderRadius: 4, color: T.muted, fontSize: 11, cursor: "pointer" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "#f2495c"; e.currentTarget.style.color = "#f2495c"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = T.border2; e.currentTarget.style.color = T.muted; }}>
            <FaSignOutAlt style={{ fontSize: 11 }} /> Logout
          </button>
        </div>
      </div>

      {/* ── Alert Center Overlay ── */}
      {showAlerts && (
        <AlertCenter
          alerts={generateAlerts(overview, activeConnections, mysqlApiError)}
          onClose={() => setShowAlerts(false)}
        />
      )}

      {/* ── Dashboard Content ── */}
      <div style={{ padding: "16px 16px 24px", background: T.bg, transition: "background 0.2s" }} className="space-y-4 hide-scrollbar">

        {/* ── Render active tab ── */}
        {activeTab === "analytics" && (
          <ApiAnalyticsTab range={range} startDate={dateMode === "custom" ? customStart : null} endDate={dateMode === "custom" ? customEnd : null} />
        )}
        {activeTab === "infra" && features.infrastructure !== false && (
          <InfrastructureTab overview={overview} activeConnections={activeConnections} mysqlApiError={mysqlApiError} />
        )}
        {activeTab === "mysql" && features.mysql !== false && (
          <MySQLTab overview={overview} />
        )}
        {activeTab === "alerts" && (
          <AlertsTab overview={overview} activeConnections={activeConnections} mysqlApiError={mysqlApiError} range={range} startDate={dateMode === "custom" ? customStart : null} endDate={dateMode === "custom" ? customEnd : null} />
        )}
        {activeTab === "ml-alerts" && (
          <MLAlertsTab />
        )}

        {/* ── Overview Tab (default) ── */}
        {activeTab === "overview" && (<>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8 }}>
          {loading ? Array(6).fill(0).map((_, i) => <LoaderCard key={i} T={T} />) :
            METRIC_CARDS(overview, activeConnections, mysqlApiError)
              .filter(card => card.title !== "MySQL Active Conn" || features.mysql !== false)
              .map(({ title, value, unit, icon: Icon, color, barColor, status, error }, i) => (
              <div key={i} className="gf-stat animate-fadeIn" style={{ borderColor: `${color}30` }}>
                <div className="gf-stat-label">
                  <Icon style={{ color, fontSize: 12 }} />
                  {title}
                </div>
                <div className="gf-stat-value" style={{ color }}>
                  <CountUp end={Number(value) || 0} separator="," duration={1.2} />
                  {unit && <span className="gf-stat-unit">{unit}</span>}
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
                  <span className={`gf-badge ${status === "CRITICAL" ? "gf-badge-red" : status === "WARNING" ? "gf-badge-yellow" : status === "INFO" ? "gf-badge-blue" : status === "N/A" ? "gf-badge-gray" : "gf-badge-green"}`} style={{ fontSize: 10 }}>
                    {status}
                  </span>
                  {error && <span style={{ fontSize: 10, color: "#f2495c" }}>⚠ API Error</span>}
                </div>
                <div className="gf-stat-bar" style={{ background: `linear-gradient(90deg, transparent, ${barColor}, transparent)` }} />
              </div>
            ))
          }
        </div>

        {/* ── High Failure APIs Table (date-range aware, paginated, CSV export) ── */}
        <HighFailureApisTable
          range={range}
          startDate={dateMode === "custom" ? customStart : null}
          endDate={dateMode === "custom" ? customEnd : null}
        />

        {/* ── 🚨 ERROR RATE DETECTION ZONE ── */}
        <OutageDetectionPanel
          range={range}
          startDate={dateMode === "custom" ? customStart : null}
          endDate={dateMode === "custom" ? customEnd : null}
        />

        {/* ── Health Score + SLA + Topology + Quick Actions — removed ── */}

        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ ...chartCard, flex: 1 }}>
            <ChartHeader color={T.blue} title="Response Time" badge={`Last ${range}`} legend={[{ label: "Response (s)", color: T.blue }]} T={T} />
            <div style={{ padding: "12px 14px" }}>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="rtGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#5794f2" stopOpacity={0.3} />
                      <stop offset="90%" stopColor="#5794f2" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 4" stroke={gridStroke} vertical={false} />
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: T.muted }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: T.muted }} axisLine={false} tickLine={false} tickFormatter={v => `${v}s`} width={34} />
                  <Tooltip {...chartTooltipStyle} formatter={v => [`${v} s`, "Response Time"]} />
                  <Area type="monotone" dataKey="value" stroke={T.blue} strokeWidth={2} fill="url(#rtGrad)" isAnimationActive={false} dot={false} activeDot={{ r: 4, fill: T.blue, stroke: T.panel, strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div style={{ ...chartCard, flex: 1 }}>
            <div style={{ padding: "8px 14px", borderBottom: `1px solid ${T.border}`, background: T.surface, display: "flex", alignItems: "center", gap: 8, minHeight: 36 }}>
              <span style={{ width: 3, height: 16, borderRadius: 2, background: T.orange, flexShrink: 0 }} />
              <span style={{ color: T.text, fontWeight: 600, fontSize: 12 }}>APIs with 4sec Increase in Response Time</span>
            </div>
            <div style={{ padding: "8px 14px" }}>
              <DashboardTable title="" data={exceptions} columns={[
                { label: "API Name", key: "operation_Name", align: "text-left", sortable: true },
                { label: "Prev Avg", key: "prev_avg_duration", align: "text-center", sortable: true },
                { label: "Curr Avg", key: "curr_avg_duration", align: "text-center", sortable: true },
                { label: "Count", key: "count", align: "text-center", sortable: true },
                { label: "Change %", key: "diff_percent", align: "text-center", sortable: true },
              ]} />
              <div style={{ textAlign: "center", fontSize: 11, marginTop: 8, color: T.muted, borderTop: `1px solid ${T.border}`, paddingTop: 8 }}>
                Overall Error Rate: <span style={{ color: overview.errorRate > 10 ? T.red : overview.errorRate >= 4 ? T.orange : T.green, fontWeight: 700 }}>{overview.errorRate}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Failure + Critical Tables ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div style={chartCard}>
            <div style={{ padding: "8px 14px", borderBottom: `1px solid ${T.border}`, background: T.surface, display: "flex", alignItems: "center", gap: 8, minHeight: 36 }}>
              <span style={{ width: 3, height: 16, borderRadius: 2, background: T.red, flexShrink: 0 }} />
              <span style={{ color: T.text, fontWeight: 600, fontSize: 12 }}>APIs with &gt;30% Increase in Failures</span>
              <span style={{ marginLeft: "auto", fontSize: 10, color: T.muted, background: T.border, padding: "1px 7px", borderRadius: 3, border: `1px solid ${T.border2}` }}>Last 30 mins vs Previous</span>
            </div>
            <div style={{ padding: "8px 14px" }}>
              <DashboardTable title="" data={failureDiffs} columns={[
                { label: "Endpoint", key: "name", align: "text-left", sortable: true },
                { label: "API Name", key: "sample_operationName", align: "text-left", sortable: true },
                { label: "Prev", key: "pastFailures", align: "text-center", sortable: true },
                { label: "Current", key: "currentFailures", align: "text-center", sortable: true },
                { label: "Total", key: "Total_count", align: "text-center", sortable: true },
                { label: "Diff", key: "diff", align: "text-center", sortable: true },
                { label: "Diff %", key: "diffPercent", align: "text-center", sortable: true },
              ]} />
            </div>
          </div>
          <div style={chartCard}>
            <div style={{ padding: "8px 14px", borderBottom: `1px solid ${T.border}`, background: T.surface, display: "flex", alignItems: "center", gap: 8, minHeight: 36 }}>
              <span style={{ width: 3, height: 16, borderRadius: 2, background: T.orange, flexShrink: 0 }} />
              <span style={{ color: T.text, fontWeight: 600, fontSize: 12 }}>Top 10 Critical APIs</span>
              <span style={{ marginLeft: "auto", fontSize: 10, color: T.muted, background: T.border, padding: "1px 7px", borderRadius: 3, border: `1px solid ${T.border2}` }}>Last 30 mins vs Previous</span>
            </div>
            <div style={{ padding: "8px 14px" }}>
              <DashboardTable title="" data={percentiles} columns={[
                { label: "API Name", key: "operationName", align: "text-left", sortable: true },
                { label: "Prev (ms)", key: "previousAvgResponseTime", align: "text-center", sortable: true },
                { label: "Current (ms)", key: "currentAvgResponseTime", align: "text-center", sortable: true },
                { label: "Count", key: "currentCount", align: "text-center", sortable: true },
                { label: "Diff %", key: "diffPercent", align: "text-center", sortable: true },
              ]} />
            </div>
          </div>
        </div>

        {/* ── Comparison Charts ── */}
        <div style={{ display: "flex", gap: 8 }}>
          <div style={chartCard}>
            <ChartHeader color={T.green} title="Total Request Comparison" badge="Today vs Yesterday"
              legend={[{ label: "Today", color: T.green }, { label: "Yesterday", color: T.blue, dashed: true }]} T={T} />
            <div style={{ padding: "12px 14px" }}>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={mergedReq} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="reqToday" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#73bf69" stopOpacity={0.3} /><stop offset="90%" stopColor="#73bf69" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="reqYest" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#5794f2" stopOpacity={0.2} /><stop offset="90%" stopColor="#5794f2" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 4" stroke={gridStroke} vertical={false} />
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: T.muted }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10, fill: T.muted }} axisLine={false} tickLine={false} tickFormatter={formatCount} width={44} />
                  <Tooltip {...chartTooltipStyle} formatter={(v, name) => [`${formatCount(v)} reqs`, name]} />
                  <Area type="monotone" dataKey="Yesterday" stroke={T.blue} strokeWidth={1.5} strokeDasharray="5 3" fill="url(#reqYest)" isAnimationActive={false} dot={false} activeDot={{ r: 3 }} connectNulls />
                  <Area type="monotone" dataKey="Today" stroke={T.green} strokeWidth={2} fill="url(#reqToday)" isAnimationActive={false} dot={false} activeDot={{ r: 3 }} connectNulls />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={chartCard}>
            <ChartHeader color={T.red} title="Response Time Comparison" badge="Today vs Yesterday"
              legend={[{ label: "Today", color: T.red }, { label: "Yesterday", color: T.blue, dashed: true }]} T={T} />
            <div style={{ padding: "12px 14px" }}>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={mergedRt} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="rtToday" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f2495c" stopOpacity={0.3} /><stop offset="90%" stopColor="#f2495c" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="rtYest" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#5794f2" stopOpacity={0.2} /><stop offset="90%" stopColor="#5794f2" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 4" stroke={gridStroke} vertical={false} />
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: T.muted }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10, fill: T.muted }} axisLine={false} tickLine={false} tickFormatter={v => `${v.toFixed(0)}ms`} width={48} domain={[0, "auto"]} />
                  <Tooltip {...chartTooltipStyle} formatter={(v, name) => [`${v.toFixed(2)} ms`, name]} />
                  <Area type="monotone" dataKey="Yesterday" stroke={T.blue} strokeWidth={1.5} strokeDasharray="5 3" fill="url(#rtYest)" isAnimationActive={false} dot={false} activeDot={{ r: 3 }} connectNulls />
                  <Area type="monotone" dataKey="Today" stroke={T.red} strokeWidth={2} fill="url(#rtToday)" isAnimationActive={false} dot={false} activeDot={{ r: 3 }} connectNulls />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* ── Top APIs + Recent Failures ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div style={chartCard}>
            <div style={{ padding: "8px 14px", borderBottom: `1px solid ${T.border}`, background: T.surface, display: "flex", alignItems: "center", gap: 8, minHeight: 36 }}>
              <span style={{ width: 3, height: 16, borderRadius: 2, background: T.green, flexShrink: 0 }} />
              <span style={{ color: T.text, fontWeight: 600, fontSize: 12 }}>Top Success APIs</span>
            </div>
            <div style={{ padding: "8px 14px" }}>
              <DashboardTable title="" data={topApis} columns={[
                { label: "API Name", key: "name", align: "text-left", sortable: true },
                { label: "Count", key: "count", align: "text-center", sortable: true },
                { label: "Avg Time", key: "avg", align: "text-center", sortable: true },
                { label: "Errors", key: "errors", align: "text-center", sortable: true },
                { label: "Success %", key: "success", align: "text-center", sortable: true },
              ]} />
            </div>
          </div>
          <div style={chartCard}>
            <div style={{ padding: "8px 14px", borderBottom: `1px solid ${T.border}`, background: T.surface, display: "flex", alignItems: "center", gap: 8, minHeight: 36 }}>
              <span style={{ width: 3, height: 16, borderRadius: 2, background: T.red, flexShrink: 0 }} />
              <span style={{ color: T.text, fontWeight: 600, fontSize: 12 }}>Recent Failures</span>
            </div>
            <div style={{ padding: "8px 14px" }}>
              <DashboardTable title="" data={failures} columns={[
                { label: "API Name", key: "name", align: "text-left", sortable: true },
                { label: "Status", key: "status", align: "text-center", sortable: true },
                { label: "Count", key: "failureCount", align: "text-center", sortable: true },
              ]} />
            </div>
          </div>
        </div>

        {/* ── Failure Code Distribution ── */}
        <FailureCodeChart range={range} />

        {/* ── Pod Monitoring — Node Overview (moved to bottom) ── */}
        {features.infrastructure !== false && <NodeCpuOverview />}

        {/* ── MySQL + Node Pool ── */}
        {features.mysql !== false && <MySQLConnectionsCard />}
        {features.mysql !== false && <MySQLMetricsCharts />}
        {features.infrastructure !== false && <NodePoolChart />}
        </>)}
      </div>
    </div>
  );
};

export default Dashboard;

