import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid, Cell, ReferenceLine,
  ComposedChart, RadialBarChart, RadialBar,
} from "recharts";
import { API_ENDPOINTS } from "../../config/apiConfig";
import { useTheme } from "../../context/ThemeContext";
import {
  FaExclamationCircle, FaExclamationTriangle,
  FaInfoCircle, FaCheckCircle, FaSync, FaChevronDown, FaChevronUp, FaHistory,
  FaShieldAlt, FaFire, FaArrowUp, FaArrowDown, FaMinus, FaDownload,
} from "react-icons/fa";

// TT is built per-component using useTheme � see useTT() helper below
const SEV = {
  critical: { color: "#f2495c", bg: "rgba(242,73,92,0.1)",  border: "rgba(242,73,92,0.3)",  icon: FaExclamationCircle,   label: "CRITICAL" },
  warning:  { color: "#f5a623", bg: "rgba(245,166,35,0.1)", border: "rgba(245,166,35,0.3)", icon: FaExclamationTriangle, label: "WARNING" },
  info:     { color: "#5794f2", bg: "rgba(87,148,242,0.1)", border: "rgba(87,148,242,0.3)", icon: FaInfoCircle,          label: "INFO" },
  ok:       { color: "#73bf69", bg: "rgba(115,191,105,0.1)",border: "rgba(115,191,105,0.3)",icon: FaCheckCircle,         label: "HEALTHY" },
};

// -- Critical API Chart: RT comparison (80d) + Error Rate (7d/24h) + Confidence Bands -
function CriticalApiChart({ api }) {
  const { T, themeKey } = useTheme();
  const isLight = themeKey === "light";
  const gridStroke = isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.04)";
  const TT = {
    contentStyle: { background: T.panel, border: `1px solid ${T.border2}`, borderRadius: 4, fontSize: 11, padding: "8px 12px" },
    labelStyle: { color: T.muted, fontSize: 10 },
  };
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("rt"); // "rt" | "daily" | "hourly"

  useEffect(() => {
    if (!api) return;
    setLoading(true);
    axios.get(API_ENDPOINTS.mlCriticalChart(api))
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [api]);

  if (loading) return (
    <div style={{ padding: "12px 0" }}>
      <div className="gf-skeleton" style={{ height: 220, width: "100%" }} />
      <div style={{ fontSize: 10, color: T.dim, textAlign: "center", marginTop: 6 }}>Loading 80-day response time history...</div>
    </div>
  );
  if (!data) return <div style={{ color: "#f2495c", fontSize: 11, padding: "8px 0" }}>Failed to load chart data</div>;

  const b = data.bands || {};
  const rtData  = data.rtHistory || [];
  const errData = view === "hourly" ? (data.hourly || []) : (data.daily || []);
  
  // Debug: check if we have data
  if (rtData.length === 0 && errData.length === 0) {
    return (
      <div style={{ padding: "12px 14px", background: "rgba(242,73,92,0.05)", border: "1px solid rgba(242,73,92,0.2)", borderRadius: 4 }}>
        <div style={{ fontSize: 11, color: "#f2495c", marginBottom: 4 }}>? No historical data available</div>
        <div style={{ fontSize: 10, color: T.muted }}>
          This API may be new or has no traffic in the last 80 days. 
          Data received: rtHistory={rtData.length}, daily={data.daily?.length || 0}, hourly={data.hourly?.length || 0}
        </div>
      </div>
    );
  }
  
  const maxRt   = Math.max(...rtData.map(d => Math.max(d.p95Rt || 0, d.avgRt || 0)), b.rtUpper || 0, 100);
  const maxErr  = Math.max(...errData.map(d => d.errorRate || 0), b.upper || 0, 5);

  const RtTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    return (
      <div style={{ background: T.panel, border: `1px solid ${T.border2}`, borderRadius: 4, padding: "10px 12px", fontSize: 11 }}>
        <div style={{ color: T.muted, marginBottom: 5, fontWeight: 600 }}>{label}</div>
        {[
          { l: "Avg RT",     v: `${d?.avgRt}ms`,     c: d?.avgRt > b.rtUpper ? "#f2495c" : d?.avgRt > b.rtWarning ? "#f5a623" : "#73bf69" },
          { l: "p50 RT",     v: `${d?.p50Rt}ms`,     c: "#5794f2" },
          { l: "p95 RT",     v: `${d?.p95Rt}ms`,     c: "#f5a623" },
          { l: "Error Rate", v: `${d?.errorRate}%`,  c: d?.errorRate > 10 ? "#f2495c" : "#73bf69" },
          { l: "Requests",   v: (d?.total||0).toLocaleString(), c: T.muted },
        ].map(({ l, v, c }) => (
          <div key={l} style={{ display: "flex", justifyContent: "space-between", gap: 14, marginBottom: 2 }}>
            <span style={{ color: T.muted }}>{l}</span>
            <span style={{ color: c, fontWeight: 600 }}>{v}</span>
          </div>
        ))}
        <div style={{ borderTop: `1px solid ${T.border}`, marginTop: 5, paddingTop: 5 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 14 }}>
            <span style={{ color: T.dim }}>Upper bound (2s)</span>
            <span style={{ color: "#f2495c" }}>{b.rtUpper}ms</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 14 }}>
            <span style={{ color: T.dim }}>80-day mean</span>
            <span style={{ color: "#73bf69" }}>{b.rtMean}ms</span>
          </div>
        </div>
      </div>
    );
  };

  const ErrTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    return (
      <div style={{ background: T.panel, border: `1px solid ${T.border2}`, borderRadius: 4, padding: "10px 12px", fontSize: 11 }}>
        <div style={{ color: T.muted, marginBottom: 5, fontWeight: 600 }}>{label}</div>
        {[
          { l: "Error Rate", v: `${d?.errorRate}%`,  c: d?.errorRate > b.upper ? "#f2495c" : d?.errorRate > b.warning ? "#f5a623" : "#73bf69" },
          { l: "Requests",   v: (d?.total||0).toLocaleString(), c: T.muted },
          { l: "Errors",     v: (d?.errors||0).toLocaleString(), c: "#f2495c" },
          { l: "Avg RT",     v: `${d?.avgRt}ms`,     c: "#5794f2" },
        ].map(({ l, v, c }) => (
          <div key={l} style={{ display: "flex", justifyContent: "space-between", gap: 14, marginBottom: 2 }}>
            <span style={{ color: T.muted }}>{l}</span>
            <span style={{ color: c, fontWeight: 600 }}>{v}</span>
          </div>
        ))}
        <div style={{ borderTop: `1px solid ${T.border}`, marginTop: 5, paddingTop: 5 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 14 }}>
            <span style={{ color: T.dim }}>Upper bound (2s)</span>
            <span style={{ color: "#f2495c" }}>{b.upper}%</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 14 }}>
            <span style={{ color: T.dim }}>Baseline mean</span>
            <span style={{ color: "#73bf69" }}>{b.mean}%</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ marginTop: 12 }}>
      {/* View toggle */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", background: T.surface, border: `1px solid ${T.border2}`, borderRadius: 3, overflow: "hidden" }}>
          {[
            ["rt",     "?? Response Time (80d)"],
            ["daily",  "?? Error Rate (7d)"],
            ["hourly", "?? Error Rate (24h)"],
          ].map(([v, l]) => (
            <button key={v} onClick={() => setView(v)}
              style={{ padding: "5px 12px", background: view === v ? (isLight ? "rgba(26,79,170,0.15)" : "rgba(87,148,242,0.2)") : "transparent", border: "none", color: view === v ? T.blue : T.muted, fontSize: 11, fontWeight: view === v ? 700 : 400, cursor: "pointer", whiteSpace: "nowrap" }}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* -- Response Time Chart (80-day) -- */}
      {view === "rt" && (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
            {[
              { label: "80-day Mean RT", value: `${b.rtMean}ms`, color: "#73bf69" },
              { label: "Warning (1s)",   value: `${b.rtWarning}ms`, color: "#f5a623" },
              { label: "Upper (2s)",     value: `${b.rtUpper}ms`, color: "#f2495c" },
              { label: "Std Dev",        value: `${b.rtStd}ms`, color: T.muted },
              { label: "p95 Mean",       value: `${b.p95Mean}ms`, color: T.muted },
              { label: "Data points",    value: `${rtData.length} days`, color: T.muted },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ padding: "3px 10px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 3, fontSize: 10 }}>
                <span style={{ color: T.dim }}>{label}: </span>
                <span style={{ color, fontWeight: 700 }}>{value}</span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 12, marginBottom: 8, fontSize: 10 }}>
            {[
              { color: "#5794f2", label: `Avg RT (current: ${data.daily?.[data.daily.length-1]?.avgRt || "�"}ms)` },
              { color: "#f5a623", label: "p95 RT" },
              { color: "#f2495c", dashed: true, label: `Upper bound ${b.rtUpper}ms` },
              { color: "#f5a623", dashed: true, label: `Warning ${b.rtWarning}ms` },
              { color: "#73bf69", dashed: true, label: `Mean ${b.rtMean}ms` },
            ].map(({ color, label, dashed }) => (
              <span key={label} style={{ display: "flex", alignItems: "center", gap: 4, color: T.muted }}>
                <span style={{ width: 16, height: 2, background: dashed ? "none" : color, borderTop: dashed ? `2px dashed ${color}` : "none", display: "inline-block" }} />
                <span style={{ color }}>{label}</span>
              </span>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={rtData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="avgRtGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#5794f2" stopOpacity={0.4} />
                  <stop offset="90%" stopColor="#5794f2" stopOpacity={0.03} />
                </linearGradient>
                <linearGradient id="p95RtGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f5a623" stopOpacity={0.2} />
                  <stop offset="90%" stopColor="#f5a623" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 4" stroke={gridStroke} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 9, fill: T.muted }} axisLine={false} tickLine={false} interval={Math.max(0, Math.floor(rtData.length / 10))} />
              <YAxis tick={{ fontSize: 9, fill: T.muted }} axisLine={false} tickLine={false}
                tickFormatter={v => `${v}ms`} width={52} domain={[0, Math.round(maxRt * 1.15)]} />
              <Tooltip content={<RtTooltip />} />
              <ReferenceLine y={b.rtUpper}   stroke="#f2495c" strokeDasharray="4 3" strokeWidth={1.5} />
              <ReferenceLine y={b.rtWarning} stroke="#f5a623" strokeDasharray="4 3" strokeWidth={1} />
              <ReferenceLine y={b.rtMean}    stroke="#73bf69" strokeDasharray="6 3" strokeWidth={1.5} />
              <Area type="monotone" dataKey="p95Rt" stroke="#f5a623" strokeWidth={1.5} fill="url(#p95RtGrad)" isAnimationActive={false} dot={false} />
              <Area type="monotone" dataKey="avgRt" stroke="#5794f2" strokeWidth={2.5} fill="url(#avgRtGrad)"
                dot={{ r: 2, fill: "#5794f2", stroke: T.panel, strokeWidth: 1 }}
                activeDot={{ r: 4, fill: "#5794f2", stroke: T.panel, strokeWidth: 2 }} />
            </ComposedChart>
          </ResponsiveContainer>
          <div style={{ marginTop: 6, padding: "6px 10px", background: "rgba(87,148,242,0.06)", border: "1px solid rgba(87,148,242,0.15)", borderRadius: 3, fontSize: 10, color: T.muted }}>
            ?? <strong style={{ color: T.text }}>How to read:</strong> Blue = avg RT � Orange = p95 RT � Points above <span style={{ color: "#f2495c" }}>red line ({b.rtUpper}ms)</span> are anomalous (2s above 80-day mean of {b.rtMean}ms)
          </div>
        </>
      )}

      {/* -- Error Rate Chart (7-day or 24h) -- */}
      {(view === "daily" || view === "hourly") && (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
            {[
              { label: "80-day Mean", value: `${b.mean}%`, color: "#73bf69" },
              { label: "Warning (1s)", value: `${b.warning}%`, color: "#f5a623" },
              { label: "Upper (2s)", value: `${b.upper}%`, color: "#f2495c" },
              { label: "p75", value: `${b.p75}%`, color: T.muted },
              { label: "p95", value: `${b.p95}%`, color: T.muted },
              { label: "Std Dev", value: `${b.std}%`, color: T.muted },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ padding: "3px 10px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 3, fontSize: 10 }}>
                <span style={{ color: T.dim }}>{label}: </span>
                <span style={{ color, fontWeight: 700 }}>{value}</span>
              </div>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={errData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="critGrad2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f2495c" stopOpacity={0.5} />
                  <stop offset="90%" stopColor="#f2495c" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 4" stroke={gridStroke} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 9, fill: T.muted }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: T.muted }} axisLine={false} tickLine={false}
                tickFormatter={v => `${v}%`} width={36} domain={[0, Math.min(100, maxErr + 5)]} />
              <Tooltip content={<ErrTooltip />} />
              <ReferenceLine y={b.upper}   stroke="#f2495c" strokeDasharray="4 3" strokeWidth={1.5} />
              <ReferenceLine y={b.warning} stroke="#f5a623" strokeDasharray="4 3" strokeWidth={1} />
              <ReferenceLine y={b.mean}    stroke="#73bf69" strokeDasharray="6 3" strokeWidth={1.5} />
              <Area type="monotone" dataKey="errorRate" stroke="#f2495c" strokeWidth={2.5} isAnimationActive={false}
                fill="url(#critGrad2)" dot={{ r: 3, fill: "#f2495c", stroke: T.panel, strokeWidth: 2 }}
                activeDot={{ r: 5, fill: "#f2495c", stroke: T.panel, strokeWidth: 2 }} />
            </ComposedChart>
          </ResponsiveContainer>
          <div style={{ marginTop: 6, padding: "6px 10px", background: "rgba(87,148,242,0.06)", border: "1px solid rgba(87,148,242,0.15)", borderRadius: 3, fontSize: 10, color: T.muted }}>
            ?? Points above <span style={{ color: "#f2495c" }}>red line ({b.upper}%)</span> are anomalous � <span style={{ color: "#73bf69" }}>Green dashed</span> = 80-day baseline mean ({b.mean}%)
          </div>
        </>
      )}
    </div>
  );
}




function SummaryBar({ summary, systemSummary, loading }) {
  const { T } = useTheme();
  if (loading) return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 8 }}>
      {Array(8).fill(0).map((_, i) => <div key={i} className="gf-skeleton" style={{ height: 72 }} />)}
    </div>
  );
  if (!summary) return null;
  const cards = [
    { label: "APIs Analyzed",  value: summary.total,                color: "#5794f2", sub: "80-day baseline" },
    { label: "Critical",       value: summary.critical,             color: "#f2495c", sub: "Immediate action" },
    { label: "Warning",        value: summary.warning,              color: "#f5a623", sub: "Monitor closely" },
    { label: "Info",           value: summary.info,                 color: "#5794f2", sub: "Low severity" },
    { label: "Healthy",        value: summary.healthy,              color: "#73bf69", sub: "Within baseline" },
    { label: "Silent APIs",    value: summary.silentApis || 0,      color: "#f2495c", sub: "Zero traffic now" },
    { label: "Chronic",        value: summary.chronic || 0,         color: "#f5a623", sub: ">50% err always" },
    { label: "System Alerts",  value: summary.systemAlerts || 0,    color: summary.systemAlerts > 0 ? "#f2495c" : "#73bf69", sub: "Platform-wide" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* System-level summary bar */}
      {systemSummary && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, padding: "10px 14px", background: T.panel, border: `1px solid ${T.border}`, borderRadius: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 10, color: T.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>System Total Requests</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: T.blue }}>{(systemSummary.currTotal || 0).toLocaleString()}</span>
            <span style={{ fontSize: 10, color: T.dim }}>/ 30min</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 10, color: T.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>System Avg RT</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: systemSummary.currAvgRt > systemSummary.baselineAvgRt * 2 ? "#f2495c" : "#73bf69" }}>{systemSummary.currAvgRt}ms</span>
            <span style={{ fontSize: 10, color: T.dim }}>baseline {systemSummary.baselineAvgRt}ms</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 10, color: T.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>System Error Rate</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: systemSummary.currErrRate > 10 ? "#f2495c" : systemSummary.currErrRate > 5 ? "#f5a623" : "#73bf69" }}>{systemSummary.currErrRate}%</span>
            <span style={{ fontSize: 10, color: T.dim }}>baseline {systemSummary.baselineAvgErrRate}%</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 10, color: T.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>Traffic vs Baseline</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: systemSummary.trafficDropPct > 50 ? "#f2495c" : systemSummary.trafficDropPct > 20 ? "#f5a623" : "#73bf69" }}>
              {systemSummary.trafficDropPct > 0 ? `? ${systemSummary.trafficDropPct.toFixed(0)}%` : "Normal"}
            </span>
          </div>
        </div>
      )}

      {/* Per-API summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 8 }}>
        {cards.map(({ label, value, color, sub }) => (
          <div key={label} style={{ background: T.panel, border: `1px solid ${color}25`, borderRadius: 4, padding: "12px 14px", position: "relative", overflow: "hidden" }}>
            <div style={{ fontSize: 10, color: T.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color, letterSpacing: "-0.02em", lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: 10, color: T.dim, marginTop: 4 }}>{sub}</div>
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${color}, transparent)`, opacity: 0.5 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function SparklineChart({ data }) {
  const { T } = useTheme();
  if (!data || data.length === 0) return <div style={{ color: T.dim, fontSize: 10, textAlign: "center" }}>�</div>;
  const maxRate = Math.max(...data.map(d => d.rate), 1);
  return (
    <ResponsiveContainer width="100%" height={50}>
      <AreaChart data={data} margin={{ top: 2, right: 2, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="spkGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f2495c" stopOpacity={0.4} />
            <stop offset="90%" stopColor="#f2495c" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <XAxis dataKey="hour" hide />
        <YAxis hide domain={[0, Math.max(maxRate + 5, 20)]} />
        <Tooltip contentStyle={{ background: T.panel, border: `1px solid ${T.border2}`, borderRadius: 4, fontSize: 10 }} formatter={(v) => [`${v}%`, "Error Rate"]} />
        {maxRate > 10 && <ReferenceLine y={10} stroke="#f5a623" strokeDasharray="3 2" strokeWidth={1} />}
        <Area type="monotone" dataKey="rate" stroke="#f2495c" strokeWidth={1.5} fill="url(#spkGrad)" isAnimationActive={false} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function HistoryChart({ api }) {
  const { T, themeKey } = useTheme();
  const isLight = themeKey === "light";
  const gridStroke = isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.04)";
  const TT = {
    contentStyle: { background: T.panel, border: `1px solid ${T.border2}`, borderRadius: 4, fontSize: 11, padding: "8px 12px" },
    labelStyle: { color: T.muted, fontSize: 10 },
  };
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!api) return;
    setLoading(true);
    axios.get(API_ENDPOINTS.mlApiHistory(api))
      .then(r => setData(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [api]);
  if (loading) return <div className="gf-skeleton" style={{ height: 100, width: "100%" }} />;
  if (!data.length) return <div style={{ color: T.dim, fontSize: 11, textAlign: "center", padding: "10px 0" }}>No historical data</div>;
  return (
    <div>
      <div style={{ fontSize: 10, color: T.muted, marginBottom: 4 }}>80-day daily error rate</div>
      <ResponsiveContainer width="100%" height={90}>
        <BarChart data={data} margin={{ top: 2, right: 2, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="2 4" stroke={gridStroke} vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 8, fill: T.muted }} axisLine={false} tickLine={false} interval={Math.floor(data.length / 5)} />
          <YAxis tick={{ fontSize: 8, fill: T.muted }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} width={26} />
          <Tooltip {...TT} formatter={(v) => [`${v}%`, "Error Rate"]} />
          <Bar dataKey="errorRate" radius={[1, 1, 0, 0]}>
            {data.map((d, i) => <Cell key={i} fill={d.errorRate > 20 ? "#f2495c" : d.errorRate > 10 ? "#f5a623" : "#73bf69"} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function AlertCard({ alert, rank }) {
  const { T } = useTheme();
  // Don't auto-expand � let user click to expand
  const [expanded, setExpanded] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const s = SEV[alert.severity] || SEV.info;
  const Icon = s.icon;

  const sendToWhatsApp = async () => {
    try {
      const { data } = await axios.post(API_ENDPOINTS.whatsappSend, alert);
      if (data.skipped) {
        alert("WhatsApp not configured. Go to Alerts tab ? Configure WhatsApp.");
      } else {
        alert(`? Sent to ${data.sent} recipient(s)`);
      }
    } catch (err) {
      alert("Failed: " + (err.response?.data?.error || err.message));
    }
  };
  return (
    <div className="animate-fadeIn" style={{ background: T.panel, border: `1px solid ${s.color}30`, borderRadius: 4, overflow: "hidden" }}>
      <div onClick={() => setExpanded(v => !v)}
        style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", cursor: "pointer", background: expanded ? T.surface : "transparent" }}>
        <span style={{ fontSize: 11, color: T.dim, fontWeight: 700, width: 20, flexShrink: 0 }}>#{rank}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 8px", background: s.bg, border: `1px solid ${s.border}`, borderRadius: 3, fontSize: 10, fontWeight: 700, color: s.color, flexShrink: 0 }}>
          <Icon style={{ fontSize: 10 }} />{s.label}
        </span>
        <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={alert.operation}>{alert.operation}</span>
        {alert.anomalyType && <span style={{ fontSize: 10, color: T.muted, background: T.border, padding: "1px 7px", borderRadius: 3, border: `1px solid ${T.border2}`, flexShrink: 0 }}>{alert.anomalyType.replace(/_/g, " ")}</span>}
        <div style={{ display: "flex", gap: 12, flexShrink: 0 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: alert.current.errorRate > 20 ? "#f2495c" : alert.current.errorRate > 10 ? "#f5a623" : "#73bf69" }}>{alert.current.errorRate}%</div>
            <div style={{ fontSize: 9, color: T.dim }}>err rate</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: (alert.ml?.rtMultiplier || 1) >= 3 ? "#f2495c" : (alert.ml?.rtMultiplier || 1) >= 2 ? "#f5a623" : "#73bf69" }}>{alert.current.avgRt}ms</div>
            <div style={{ fontSize: 9, color: T.dim }}>avg rt {alert.ml?.rtMultiplier ? `(${alert.ml.rtMultiplier}x)` : ""}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.blue }}>{alert.ml.confidence}</div>
            <div style={{ fontSize: 9, color: T.dim }}>confidence</div>
          </div>
        </div>
        <div style={{ width: 80, flexShrink: 0 }}><SparklineChart data={alert.sparkline?.errorRates || []} /></div>
        <span style={{ color: T.dim, fontSize: 11, flexShrink: 0 }}>{expanded ? <FaChevronUp /> : <FaChevronDown />}</span>
      </div>

      {expanded && (
        <div style={{ padding: "12px 14px", borderTop: `1px solid ${T.border}`, background: T.bg }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Current (30 min)</div>
              {[
                { label: "Requests", value: (alert.current.total || 0).toLocaleString() },
                { label: "Errors", value: (alert.current.errors || 0).toLocaleString(), color: "#f2495c" },
                { label: "Error Rate", value: `${alert.current.errorRate}%`, color: alert.current.errorRate > 10 ? "#f2495c" : "#73bf69" },
                { label: "Avg RT", value: `${alert.current.avgRt}ms`, color: alert.current.avgRt > (alert.baseline.avgRt * 2) ? "#f2495c" : alert.current.avgRt > (alert.baseline.avgRt * 1.5) ? "#f5a623" : "#73bf69" },
                { label: "p50 RT", value: `${alert.current.p50Rt || "�"}ms` },
                { label: "p95 RT", value: `${alert.current.p95Rt}ms` },
                { label: "RT vs Baseline", value: `${alert.ml.rtMultiplier}x`, color: alert.ml.rtMultiplier >= 3 ? "#f2495c" : alert.ml.rtMultiplier >= 2 ? "#f5a623" : "#73bf69" },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: `1px solid ${T.border}` }}>
                  <span style={{ fontSize: 11, color: T.muted }}>{label}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: color || T.text }}>{value}</span>
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>80-Day Baseline</div>
              {[
                { label: "Days of data", value: alert.baseline.days },
                { label: "Avg daily req", value: (alert.baseline.avgDailyRequests || 0).toLocaleString() },
                { label: "Avg error rate", value: `${alert.baseline.avgErrorRate}%` },
                { label: "Max error rate", value: `${alert.baseline.maxErrorRate}%`, color: alert.baseline.maxErrorRate > 20 ? "#f5a623" : T.muted },
                { label: "Trained Avg RT", value: `${alert.baseline.avgRt}ms`, color: T.blue },
                { label: "Trained p50 RT", value: `${alert.baseline.p50Rt || "�"}ms` },
                { label: "Trained p95 RT", value: `${alert.baseline.p95Rt || "�"}ms` },
                { label: "RT Std Dev", value: `�${alert.baseline.stdRt}ms`, color: T.muted },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: `1px solid ${T.border}` }}>
                  <span style={{ fontSize: 11, color: T.muted }}>{label}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: color || T.text }}>{value}</span>
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>ML Scores</div>
              {[
                { label: "Error Rate Z-score", value: `${alert.ml.errZ ?? alert.ml.errorRateZScore}s`,  color: Math.abs(alert.ml.errZ ?? alert.ml.errorRateZScore ?? 0) > 2.5 ? "#f2495c" : "#73bf69" },
                { label: "RT Z-score",         value: `${alert.ml.rtZ ?? alert.ml.rtZScore}s`,          color: Math.abs(alert.ml.rtZ ?? alert.ml.rtZScore ?? 0) > 2.0 ? "#f5a623" : "#73bf69" },
                { label: "Traffic Z-score",    value: `${alert.ml.trafficZ ?? "�"}s`,                   color: (alert.ml.trafficZ ?? 0) < -2 ? "#f2495c" : "#73bf69" },
                { label: "RT vs Baseline",     value: `${alert.ml.rtMultiplier}x`,                      color: alert.ml.rtMultiplier >= 3 ? "#f2495c" : alert.ml.rtMultiplier >= 2 ? "#f5a623" : "#73bf69" },
                { label: "IQR Outlier (err)",  value: (alert.ml.errIQR ?? alert.ml.errorRateIQROutlier) ? "YES" : "no", color: (alert.ml.errIQR ?? alert.ml.errorRateIQROutlier) ? "#f2495c" : "#73bf69" },
                { label: "24h err trend",      value: (alert.ml.errTrendSlope ?? alert.ml.shortTermErrTrend ?? 0) > 0 ? `? +${(alert.ml.errTrendSlope ?? alert.ml.shortTermErrTrend ?? 0).toFixed(2)}/hr` : `? ${(alert.ml.errTrendSlope ?? alert.ml.shortTermErrTrend ?? 0).toFixed(2)}/hr`, color: (alert.ml.errTrendSlope ?? alert.ml.shortTermErrTrend ?? 0) > 1 ? "#f2495c" : "#73bf69" },
                { label: "24h RT trend",       value: (alert.ml.rtTrendSlope ?? alert.ml.shortTermRtTrend ?? 0) > 0 ? `? +${Math.round(alert.ml.rtTrendSlope ?? alert.ml.shortTermRtTrend ?? 0)}ms/hr` : `? ${Math.round(alert.ml.rtTrendSlope ?? alert.ml.shortTermRtTrend ?? 0)}ms/hr`, color: (alert.ml.rtTrendSlope ?? alert.ml.shortTermRtTrend ?? 0) > 20 ? "#f5a623" : "#73bf69" },
                { label: "Confidence",         value: alert.ml.confidence,                              color: T.blue },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: `1px solid ${T.border}` }}>
                  <span style={{ fontSize: 11, color: T.muted }}>{label}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: color || T.text }}>{value}</span>
                </div>
              ))}
              {alert.statusCodes?.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 10, color: T.muted, marginBottom: 4 }}>HTTP Codes (30min)</div>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {alert.statusCodes.slice(0, 6).map(({ code, count }) => {
                      const c = String(code);
                      const col = c.startsWith("5") ? "#f2495c" : c.startsWith("4") ? "#f5a623" : c.startsWith("2") ? "#73bf69" : T.blue;
                      return (
                        <span key={code} style={{ padding: "2px 7px", background: `${col}15`, border: `1px solid ${col}30`, borderRadius: 3, fontSize: 10, fontWeight: 700, color: col }}>
                          {code} <span style={{ color: T.muted, fontWeight: 400 }}>�{count.toLocaleString()}</span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {alert.issues?.length > 0 && (
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: T.text, textTransform: "uppercase", letterSpacing: "0.05em" }}>?? What's Wrong</div>
              {alert.issues.map((issue, i) => (
                <div key={i} style={{ padding: "10px 12px", background: issue.type.includes("CRITICAL") ? "rgba(242,73,92,0.08)" : issue.type.includes("HIGH") ? "rgba(245,166,35,0.08)" : "rgba(87,148,242,0.06)", border: `1px solid ${issue.type.includes("CRITICAL") ? "rgba(242,73,92,0.25)" : issue.type.includes("HIGH") ? "rgba(245,166,35,0.25)" : "rgba(87,148,242,0.2)"}`, borderRadius: 3 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 13 }}>{issue.icon}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{issue.title}</span>
                    <span style={{ fontSize: 10, color: T.muted, background: T.border, padding: "1px 6px", borderRadius: 3, marginLeft: "auto" }}>{issue.type.replace(/_/g, " ")}</span>
                  </div>
                  <div style={{ fontSize: 11, color: T.text, marginBottom: 4 }}>{issue.detail}</div>
                  <div style={{ fontSize: 11, color: T.blue }}>?? {issue.action}</div>
                </div>
              ))}
            </div>
          )}

          {alert.comparison && (
            <div style={{ marginTop: 10, padding: "10px 12px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 3 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: T.blue, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>?? Yesterday vs Today (same 30-min window)</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                {[
                  { label: "Requests", yest: (alert.comparison.yesterday?.total || 0).toLocaleString(), today: (alert.comparison.today?.total || 0).toLocaleString(), worse: (alert.comparison.today?.total || 0) < (alert.comparison.yesterday?.total || 0) },
                  { label: "Error Rate", yest: `${(alert.comparison.yesterday?.errorRate || 0).toFixed(2)}%`, today: `${(alert.comparison.today?.errorRate || 0).toFixed(2)}%`, worse: (alert.comparison.today?.errorRate || 0) > (alert.comparison.yesterday?.errorRate || 0) },
                  { label: "Avg RT", yest: `${alert.comparison.yesterday?.avgRt || 0}ms`, today: `${alert.comparison.today?.avgRt || 0}ms`, worse: (alert.comparison.today?.avgRt || 0) > (alert.comparison.yesterday?.avgRt || 0) },
                ].map(({ label, yest, today, worse }) => (
                  <div key={label} style={{ background: T.panel, borderRadius: 3, padding: "8px 10px" }}>
                    <div style={{ fontSize: 10, color: T.muted, marginBottom: 4 }}>{label}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 11, color: T.dim }}>{yest}</span>
                      <span style={{ fontSize: 10, color: T.dim }}>?</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: worse ? "#f2495c" : "#73bf69" }}>{today}</span>
                      <span style={{ fontSize: 10 }}>{worse ? "??" : "??"}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginTop: 10 }}>
            <button onClick={() => setShowHistory(v => !v)}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", background: "transparent", border: `1px solid ${T.border2}`, borderRadius: 3, color: T.muted, fontSize: 11, cursor: "pointer" }}>
              <FaHistory style={{ fontSize: 10 }} />
              {showHistory ? "Hide" : "Show"} 80-day history
            </button>
            {showHistory && <div style={{ marginTop: 8 }}><HistoryChart api={alert.operation} /></div>}
          </div>

          <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={sendToWhatsApp}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", background: "rgba(37,211,102,0.08)", border: "1px solid rgba(37,211,102,0.25)", borderRadius: 3, color: "#25D366", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
              ?? Send to WhatsApp
            </button>
          </div>

          {alert.severity === "critical" && (
            <div style={{ marginTop: 12, padding: "12px 14px", background: T.bg, border: "1px solid rgba(242,73,92,0.2)", borderRadius: 4 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#f2495c", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
                ?? Critical API � Trend Analysis with Confidence Bands
              </div>
              <CriticalApiChart api={alert.operation} bands={alert.ml} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// -- Risk Score Gauge ----------------------------------------------------------
function RiskGauge({ score, color }) {
  const data = [{ value: score, fill: color }, { value: 100 - score, fill: "rgba(255,255,255,0.04)" }];
  return (
    <div style={{ position: "relative", width: 56, height: 56, flexShrink: 0 }}>
      <RadialBarChart width={56} height={56} cx={28} cy={28} innerRadius={18} outerRadius={26}
        startAngle={90} endAngle={-270} data={data} barSize={7}>
        <RadialBar dataKey="value" cornerRadius={4} background={false} />
      </RadialBarChart>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 12, fontWeight: 800, color, lineHeight: 1 }}>{score}</span>
      </div>
    </div>
  );
}

// -- Mini 7-day sparkline for risk table ---------------------------------------
function RiskSparkline({ data, color }) {
  const { T } = useTheme();
  if (!data || data.length === 0) return <div style={{ color: T.dim, fontSize: 10 }}>�</div>;
  return (
    <ResponsiveContainer width="100%" height={32}>
      <AreaChart data={data} margin={{ top: 2, right: 2, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`rspk-${color.replace("#","")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.5} />
            <stop offset="90%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <XAxis dataKey="day" hide />
        <YAxis hide />
        <Tooltip contentStyle={{ background: T.panel, border: `1px solid ${T.border2}`, borderRadius: 4, fontSize: 10 }}
          formatter={(v, n) => [n === "rate" ? `${v}%` : `${v}ms`, n === "rate" ? "Err Rate" : "Avg RT"]} />
        <Area type="monotone" dataKey="rate" stroke={color} strokeWidth={1.5}
          fill={`url(#rspk-${color.replace("#","")})`} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// -- Score breakdown bar -------------------------------------------------------
function ScoreBar({ label, value, max, color }) {
  const { T } = useTheme();
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
        <span style={{ fontSize: 9, color: T.muted }}>{label}</span>
        <span style={{ fontSize: 9, fontWeight: 700, color }}>{value}/{max}</span>
      </div>
      <div style={{ height: 4, background: T.border, borderRadius: 2, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 2, transition: "width 0.4s ease" }} />
      </div>
    </div>
  );
}

// -- Risk Forecast Section -----------------------------------------------------
function RiskForecastSection() {
  const { T, themeKey } = useTheme();
  const isLight = themeKey === "light";
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [lastRun, setLastRun] = useState(null);
  const [running, setRunning] = useState(false);

  const runForecast = useCallback(async () => {
    setRunning(true);
    setError(null);
    try {
      const { data: result } = await axios.get(API_ENDPOINTS.mlRiskForecast);
      setData(result);
      setLastRun(new Date());
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setRunning(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => { runForecast(); }, [runForecast]);

  const apis = (data?.apis || []).filter(a => {
    if (filter !== "all" && a.riskLevel !== filter) return false;
    if (search && !a.operation.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const trendIcon = (label) => {
    if (label.includes("Rising")) return <FaArrowUp style={{ color: "#f2495c", fontSize: 9 }} />;
    if (label.includes("Falling")) return <FaArrowDown style={{ color: "#73bf69", fontSize: 9 }} />;
    return <FaMinus style={{ color: T.muted, fontSize: 9 }} />;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Header */}
      <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 4, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18 }}>??</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>API Risk Forecast</div>
            <div style={{ fontSize: 11, color: T.muted, marginTop: 1 }}>
              Composite risk model � Error rate Z-score + RT Z-score + 7-day trend + volatility � All APIs ranked
              {lastRun && ` � ${lastRun.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`}
            </div>
          </div>
        </div>
        <button onClick={runForecast} disabled={running}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 16px", background: "#1f60c4", border: "none", borderRadius: 3, color: "#fff", fontSize: 12, fontWeight: 600, cursor: running ? "not-allowed" : "pointer", opacity: running ? 0.7 : 1 }}>
          <FaSync style={{ fontSize: 11, animation: running ? "spin 1s linear infinite" : "none" }} />
          {running ? "Scoring APIs..." : "Run Forecast"}
        </button>
      </div>

      {/* Summary cards */}
      {!loading && data?.summary && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
          {[
            { label: "APIs Scored",   value: data.summary.total,  color: "#5794f2", sub: "7-day trend data" },
            { label: "High Risk",     value: data.summary.high,   color: "#f2495c", sub: "Score = 70" },
            { label: "Medium Risk",   value: data.summary.medium, color: "#f5a623", sub: "Score 40�69" },
            { label: "Low Risk",      value: data.summary.low,    color: "#73bf69", sub: "Score < 40" },
            { label: "Analysis Time", value: `${data.summary.analysisTimeMs}ms`, color: T.muted, sub: data.summary.modelVersion },
          ].map(({ label, value, color, sub }) => (
            <div key={label} style={{ background: T.panel, border: `1px solid ${color}25`, borderRadius: 4, padding: "10px 14px", position: "relative", overflow: "hidden" }}>
              <div style={{ fontSize: 10, color: T.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color, letterSpacing: "-0.02em", lineHeight: 1 }}>{value}</div>
              <div style={{ fontSize: 9, color: T.dim, marginTop: 4 }}>{sub}</div>
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${color}, transparent)`, opacity: 0.4 }} />
            </div>
          ))}
        </div>
      )}

      {loading && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
          {Array(5).fill(0).map((_, i) => <div key={i} className="gf-skeleton" style={{ height: 72 }} />)}
        </div>
      )}

      {error && (
        <div style={{ padding: "10px 14px", background: "rgba(242,73,92,0.1)", border: "1px solid rgba(242,73,92,0.3)", borderRadius: 4, color: "#f2495c", fontSize: 12 }}>
          ? Forecast failed: {error}
        </div>
      )}

      {/* Filter + search */}
      {!loading && data && (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", background: T.panel, border: `1px solid ${T.border2}`, borderRadius: 3, overflow: "hidden" }}>
            {[
              { key: "all",    label: "All",    color: "#5794f2" },
              { key: "HIGH",   label: "?? High",   color: "#f2495c" },
              { key: "MEDIUM", label: "?? Medium", color: "#f5a623" },
              { key: "LOW",    label: "? Low",    color: "#73bf69" },
            ].map(({ key, label, color }) => {
              const count = key === "all" ? data.apis.length : data.apis.filter(a => a.riskLevel === key).length;
              return (
                <button key={key} onClick={() => setFilter(key)}
                  style={{ padding: "5px 12px", background: filter === key ? `${color}20` : "transparent", border: "none", color: filter === key ? color : T.muted, fontSize: 11, fontWeight: filter === key ? 700 : 400, cursor: "pointer" }}>
                  {label} ({count})
                </button>
              );
            })}
          </div>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search API name..."
            style={{ flex: 1, background: T.panel, border: `1px solid ${T.border2}`, borderRadius: 3, color: T.text, fontSize: 12, padding: "5px 10px", outline: "none" }}
            onFocus={e => e.target.style.borderColor = "#5794f2"}
            onBlur={e => e.target.style.borderColor = T.border2}
          />
        </div>
      )}

      {/* Risk table */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {Array(8).fill(0).map((_, i) => <div key={i} className="gf-skeleton" style={{ height: 52 }} />)}
        </div>
      ) : apis.length === 0 ? (
        <div style={{ padding: "20px", textAlign: "center", color: T.muted, fontSize: 12 }}>No APIs match the current filter.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {/* Table header */}
          <div style={{ display: "grid", gridTemplateColumns: "56px 1fr 90px 90px 90px 90px 90px 100px", gap: 8, padding: "6px 12px", background: T.bg, borderRadius: 3, fontSize: 9, fontWeight: 700, color: T.dim, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            <div>Score</div>
            <div>API Name</div>
            <div>Risk</div>
            <div>Err Rate</div>
            <div>Avg RT</div>
            <div>RT vs Base</div>
            <div>Err Trend</div>
            <div>7-day Err Rate</div>
          </div>

          {apis.map((api, idx) => {
            const isOpen = expanded === api.operation;
            const errDelta = api.current.errorRate - api.baseline.avgErrorRate;
            const rtDelta  = api.current.avgRt - api.baseline.avgRt;
            const errDeltaColor = errDelta > 5 ? "#f2495c" : errDelta > 1 ? "#f5a623" : "#73bf69";
            const rtDeltaColor  = rtDelta  > 500 ? "#f2495c" : rtDelta > 100 ? "#f5a623" : "#73bf69";

            return (
              <div key={api.operation} style={{ background: T.panel, border: `1px solid ${isOpen ? api.riskColor + "40" : T.border}`, borderRadius: 4, overflow: "hidden", transition: "border-color 0.2s" }}>
                {/* Row */}
                <div onClick={() => setExpanded(isOpen ? null : api.operation)}
                  style={{ display: "grid", gridTemplateColumns: "56px 1fr 90px 90px 90px 90px 90px 100px", gap: 8, padding: "8px 12px", cursor: "pointer", alignItems: "center" }}>
                  <RiskGauge score={api.riskScore} color={api.riskColor} />
                  <div style={{ overflow: "hidden" }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={api.operation}>{api.operation}</div>
                    <div style={{ fontSize: 10, color: T.muted, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{api.prediction}</div>
                  </div>
                  <div>
                    <span style={{ padding: "2px 8px", background: `${api.riskColor}18`, border: `1px solid ${api.riskColor}40`, borderRadius: 3, fontSize: 10, fontWeight: 700, color: api.riskColor }}>
                      {api.riskLevel}
                    </span>
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: errDeltaColor }}>{api.current.errorRate}%</div>
                    <div style={{ fontSize: 9, color: T.dim }}>base: {api.baseline.avgErrorRate}%</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: rtDeltaColor }}>{api.current.avgRt}ms</div>
                    <div style={{ fontSize: 9, color: T.dim }}>base: {api.baseline.avgRt}ms</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: (api.current.rtMultiplier || api.ml?.rtMultiplier || 1) >= 3 ? "#f2495c" : (api.current.rtMultiplier || api.ml?.rtMultiplier || 1) >= 2 ? "#f5a623" : "#73bf69" }}>
                      {(api.current.rtMultiplier || api.ml?.rtMultiplier || 1).toFixed(1)}x
                    </div>
                    <div style={{ fontSize: 9, color: T.dim }}>vs baseline</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    {trendIcon(api.ml.errTrendLabel)}
                    <span style={{ fontSize: 10, color: api.ml.errTrendLabel.includes("Rising") ? "#f2495c" : api.ml.errTrendLabel.includes("Falling") ? "#73bf69" : T.muted }}>
                      {api.ml.errTrendLabel.replace("? ", "").replace("? ", "").replace("? ", "")}
                    </span>
                  </div>
                  <div style={{ width: "100%" }}>
                    <RiskSparkline data={api.sparkline} color={api.riskColor} />
                  </div>
                </div>

                {/* Expanded detail */}
                {isOpen && (
                  <div style={{ padding: "12px 14px", borderTop: `1px solid ${T.border}`, background: T.bg }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
                      {/* Current */}
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Current (1h)</div>
                        {[
                          { label: "Requests",   value: (api.current.total || 0).toLocaleString() },
                          { label: "Errors",     value: (api.current.errors || 0).toLocaleString(), color: "#f2495c" },
                          { label: "Error Rate", value: `${api.current.errorRate}%`, color: errDeltaColor },
                          { label: "Avg RT",     value: `${api.current.avgRt}ms`,    color: rtDeltaColor },
                          { label: "p50 RT",     value: `${api.current.p50Rt}ms` },
                          { label: "p95 RT",     value: `${api.current.p95Rt}ms` },
                        ].map(({ label, value, color }) => (
                          <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: `1px solid ${T.border}` }}>
                            <span style={{ fontSize: 11, color: T.muted }}>{label}</span>
                            <span style={{ fontSize: 11, fontWeight: 600, color: color || T.text }}>{value}</span>
                          </div>
                        ))}
                      </div>
                      {/* Baseline */}
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>80-Day Baseline</div>
                        {[
                          { label: "Days of data",  value: api.baseline.days },
                          { label: "Avg daily req", value: (api.baseline.avgDailyRequests || api.baseline.avgDailyReqs || 0).toLocaleString() },
                          { label: "Avg err rate",  value: `${api.baseline.avgErrorRate}%` },
                          { label: "Max err rate",  value: `${api.baseline.maxErrorRate ?? api.baseline.maxErrRate ?? "�"}%`, color: (api.baseline.maxErrorRate ?? api.baseline.maxErrRate ?? 0) > 20 ? "#f5a623" : T.muted },
                          { label: "Avg RT",        value: `${api.baseline.avgRt}ms` },
                          { label: "Std Dev (err)", value: `${api.baseline.stdErr ?? "�"}%`, color: T.muted },
                          { label: "Std Dev (RT)",  value: `${api.baseline.stdRt}ms`, color: T.muted },
                        ].map(({ label, value, color }) => (
                          <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: `1px solid ${T.border}` }}>
                            <span style={{ fontSize: 11, color: T.muted }}>{label}</span>
                            <span style={{ fontSize: 11, fontWeight: 600, color: color || T.text }}>{value}</span>
                          </div>
                        ))}
                      </div>
                      {/* ML signals */}
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>ML Signals</div>
                        {[
                          { label: "Error Rate Z",    value: `${api.ml.errZ}s`, color: Math.abs(api.ml.errZ) > 2.5 ? "#f2495c" : "#73bf69" },
                          { label: "RT Z-score",      value: `${api.ml.rtZ}s`,  color: Math.abs(api.ml.rtZ) > 2.0 ? "#f5a623" : "#73bf69" },
                          { label: "Err Trend/day",   value: `${api.ml.errTrendSlope > 0 ? "+" : ""}${api.ml.errTrendSlope}%`, color: api.ml.errTrendSlope > 1.5 ? "#f2495c" : "#73bf69" },
                          { label: "RT Trend/day",    value: `${api.ml.rtTrendSlope > 0 ? "+" : ""}${api.ml.rtTrendSlope}ms`, color: api.ml.rtTrendSlope > 30 ? "#f5a623" : "#73bf69" },
                          { label: "Volatility",      value: `${(api.ml.volatility * 100).toFixed(0)}%`, color: api.ml.volatility > 0.5 ? "#f5a623" : "#73bf69" },
                          { label: "14d Err Drift",   value: `${api.ml.recentErrDrift > 0 ? "+" : ""}${api.ml.recentErrDrift}%`, color: api.ml.recentErrDrift > 2 ? "#f5a623" : "#73bf69" },
                          { label: "14d RT Drift",    value: `${api.ml.recentRtDrift > 0 ? "+" : ""}${api.ml.recentRtDrift}ms`, color: api.ml.recentRtDrift > 100 ? "#f5a623" : "#73bf69" },
                        ].map(({ label, value, color }) => (
                          <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: `1px solid ${T.border}` }}>
                            <span style={{ fontSize: 11, color: T.muted }}>{label}</span>
                            <span style={{ fontSize: 11, fontWeight: 600, color: color || T.text }}>{value}</span>
                          </div>
                        ))}
                      </div>
                      {/* Score breakdown */}
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                          Risk Score Breakdown
                          <span style={{ marginLeft: 6, fontSize: 14, fontWeight: 800, color: api.riskColor }}>{api.riskScore}/100</span>
                        </div>
                        <ScoreBar label="Error Rate Z-score" value={api.ml.scoreBreakdown.errZScore}  max={40} color="#f2495c" />
                        <ScoreBar label="RT Z-score"         value={api.ml.scoreBreakdown.rtZScore}   max={25} color="#f5a623" />
                        <ScoreBar label="Trend (7d slope)"   value={api.ml.scoreBreakdown.trendScore} max={25} color="#5794f2" />
                        <ScoreBar label="Volatility"         value={api.ml.scoreBreakdown.volatScore} max={10} color="#9b59b6" />
                        <div style={{ marginTop: 10, padding: "8px 10px", background: `${api.riskColor}10`, border: `1px solid ${api.riskColor}30`, borderRadius: 3 }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: api.riskColor, marginBottom: 4 }}>?? Prediction</div>
                          <div style={{ fontSize: 11, color: T.text }}>{api.prediction}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Model explanation */}
      {!loading && data && (
        <div style={{ padding: "10px 14px", background: "rgba(87,148,242,0.05)", border: "1px solid rgba(87,148,242,0.15)", borderRadius: 4, fontSize: 10, color: T.muted }}>
          <strong style={{ color: "#5794f2" }}>?? How the Risk Score works:</strong>{" "}
          <span style={{ color: "#f2495c" }}>Error Rate Z-score (40pts)</span> � how far current error rate deviates from 80-day baseline �{" "}
          <span style={{ color: "#f5a623" }}>RT Z-score (25pts)</span> � response time deviation �{" "}
          <span style={{ color: "#5794f2" }}>7-day Trend (25pts)</span> � is error rate / RT climbing? �{" "}
          <span style={{ color: "#9b59b6" }}>Volatility (10pts)</span> � coefficient of variation (unpredictable APIs score higher).{" "}
          Score = 70 = HIGH RISK � 40�69 = MEDIUM � &lt;40 = LOW
        </div>
      )}
    </div>
  );
}

export default function MLAlertsTab() {
  const { T } = useTheme();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [lastRun, setLastRun] = useState(null);
  const [running, setRunning] = useState(false);
  const [activeView, setActiveView] = useState("alerts"); // "alerts" | "forecast"

  const runAnalysis = useCallback(async () => {
    setRunning(true);
    setError(null);
    try {      const { data: result } = await axios.get(API_ENDPOINTS.mlApiAlerts);
      setData(result);
      setLastRun(new Date());
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setRunning(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => { runAnalysis(); }, [runAnalysis]);

  const filtered = (data?.alerts || []).filter(a => {
    if (filter !== "all" && a.severity !== filter) return false;
    if (search && !a.operation.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // -- CSV Export ------------------------------------------------------------
  const exportCSV = () => {
    if (!data) return;

    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const ts = lastRun ? lastRun.toISOString().slice(0, 19).replace("T", " ") : new Date().toISOString().slice(0, 19).replace("T", " ");

    // -- Sheet 1: Alerts --------------------------------------------------
    const alertHeaders = [
      "Severity", "API Name", "Anomaly Type",
      // Current
      "Curr Requests", "Curr Errors", "Curr Error Rate %", "Curr Avg RT (ms)", "Curr p50 RT (ms)", "Curr p95 RT (ms)",
      // Baseline
      "Baseline Days", "Baseline Avg Error Rate %", "Baseline Max Error Rate %",
      "Baseline Avg RT (ms)", "Baseline p50 RT (ms)", "Baseline p95 RT (ms)", "Baseline Std RT (ms)", "Baseline Avg Daily Req",
      // ML Scores
      "ML Confidence", "Error Rate Z-score", "RT Z-score", "Traffic Z-score",
      "RT vs Baseline (x)", "IQR Outlier (err)", "24h Err Trend /hr", "24h RT Trend ms/hr",
      // Issues
      "Issues Count", "Issue Titles",
      // Status Codes
      "HTTP Status Codes",
      // Comparison
      "Yesterday Error Rate %", "Yesterday Avg RT (ms)", "Yesterday Requests",
      "Today Error Rate %", "Today Avg RT (ms)", "Today Requests",
      // Meta
      "Analysis Timestamp",
    ];

    const alertRows = (data.alerts || []).map(a => [
      a.severity?.toUpperCase(),
      a.operation,
      a.anomalyType || "",
      // Current
      a.current?.total ?? "",
      a.current?.errors ?? "",
      a.current?.errorRate ?? "",
      a.current?.avgRt ?? "",
      a.current?.p50Rt ?? "",
      a.current?.p95Rt ?? "",
      // Baseline
      a.baseline?.days ?? "",
      a.baseline?.avgErrorRate ?? "",
      a.baseline?.maxErrorRate ?? "",
      a.baseline?.avgRt ?? "",
      a.baseline?.p50Rt ?? "",
      a.baseline?.p95Rt ?? "",
      a.baseline?.stdRt ?? "",
      a.baseline?.avgDailyRequests ?? "",
      // ML
      a.ml?.confidence ?? "",
      a.ml?.errZ ?? a.ml?.errorRateZScore ?? "",
      a.ml?.rtZ ?? a.ml?.rtZScore ?? "",
      a.ml?.trafficZ ?? "",
      a.ml?.rtMultiplier ?? "",
      (a.ml?.errIQR ?? a.ml?.errorRateIQROutlier) ? "YES" : "no",
      a.ml?.errTrendSlope ?? a.ml?.shortTermErrTrend ?? "",
      a.ml?.rtTrendSlope ?? a.ml?.shortTermRtTrend ?? "",
      // Issues
      (a.issues?.length ?? 0),
      (a.issues || []).map(i => i.title).join(" | "),
      // Status codes
      (a.statusCodes || []).map(s => `${s.code}�${s.count}`).join(" | "),
      // Comparison
      a.comparison?.yesterday?.errorRate ?? "",
      a.comparison?.yesterday?.avgRt ?? "",
      a.comparison?.yesterday?.total ?? "",
      a.comparison?.today?.errorRate ?? "",
      a.comparison?.today?.avgRt ?? "",
      a.comparison?.today?.total ?? "",
      // Meta
      ts,
    ].map(esc));

    // -- Sheet 2: Healthy APIs --------------------------------------------
    const healthyHeaders = ["API Name", "Error Rate %", "Status", "Analysis Timestamp"];
    const healthyRows = (data.healthy || []).map(h => [
      esc(h.operation), esc(h.errorRate), esc("HEALTHY"), esc(ts),
    ]);

    // -- Sheet 3: Chronic Failures ----------------------------------------
    const chronicHeaders = ["API Name", "80d Avg Error Rate %", "Current Error Rate %", "Days of Data", "Total Calls", "Analysis Timestamp"];
    const chronicRows = (data.chronicFailures || []).map(c => [
      esc(c.operation), esc(c.avgErrorRate), esc(c.currErrorRate ?? ""), esc(c.days), esc(c.totalCalls ?? ""), esc(ts),
    ]);

    // -- Sheet 4: System Summary ------------------------------------------
    const sys = data.systemSummary || {};
    const sum = data.summary || {};
    const summaryLines = [
      ["Metric", "Value"],
      ["Analysis Timestamp", ts],
      ["Total APIs Analyzed", sum.total ?? ""],
      ["Critical", sum.critical ?? ""],
      ["Warning", sum.warning ?? ""],
      ["Info", sum.info ?? ""],
      ["Healthy", sum.healthy ?? ""],
      ["Silent APIs", sum.silentApis ?? ""],
      ["Chronic Failures", sum.chronic ?? ""],
      ["System Alerts", sum.systemAlerts ?? ""],
      ["Data Range", sum.dataRange ?? ""],
      ["Analysis Time (ms)", sum.analysisTimeMs ?? ""],
      ["System Total Requests (30min)", sys.currTotal ?? ""],
      ["System Avg RT (ms)", sys.currAvgRt ?? ""],
      ["System Baseline Avg RT (ms)", sys.baselineAvgRt ?? ""],
      ["System Error Rate %", sys.currErrRate ?? ""],
      ["System Baseline Error Rate %", sys.baselineAvgErrRate ?? ""],
      ["Traffic Drop %", sys.trafficDropPct ?? ""],
    ].map(r => r.map(esc));

    // -- Combine into one CSV with section separators ---------------------
    const lines = [
      ["=== ML ANOMALY ALERTS ==="].map(esc),
      alertHeaders.map(esc),
      ...alertRows,
      [],
      ["=== HEALTHY APIS ==="].map(esc),
      healthyHeaders.map(esc),
      ...healthyRows,
      [],
      ["=== CHRONIC FAILURES ==="].map(esc),
      chronicHeaders.map(esc),
      ...chronicRows,
      [],
      ["=== SYSTEM SUMMARY ==="].map(esc),
      ...summaryLines,
    ];

    const csv = lines.map(r => r.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }); // BOM for Excel
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ml-alerts-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* View toggle */}
      <div style={{ display: "flex", background: T.panel, border: `1px solid ${T.border}`, borderRadius: 4, overflow: "hidden" }}>
        {[
          { key: "alerts",   label: "?? Anomaly Alerts",  sub: "Active issues vs 80-day baseline" },
          { key: "forecast", label: "?? Risk Forecast",    sub: "All APIs ranked by risk score" },
        ].map(({ key, label, sub }) => (
          <button key={key} onClick={() => setActiveView(key)}
            style={{ flex: 1, padding: "10px 16px", background: activeView === key ? "rgba(87,148,242,0.12)" : "transparent", border: "none", borderBottom: activeView === key ? "2px solid #5794f2" : "2px solid transparent", color: activeView === key ? "#5794f2" : T.muted, fontSize: 13, fontWeight: activeView === key ? 700 : 400, cursor: "pointer", textAlign: "left", transition: "all 0.15s" }}>
            {label}
            <div style={{ fontSize: 10, color: activeView === key ? "#5794f2" : T.dim, fontWeight: 400, marginTop: 1 }}>{sub}</div>
          </button>
        ))}
      </div>

      {activeView === "forecast" ? (
        <RiskForecastSection />
      ) : (
        <>
          <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 4, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 18 }}>??</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>ML API Anomaly Detection v4</div>
                <div style={{ fontSize: 11, color: T.muted, marginTop: 1 }}>
                  3-layer detection: System � Per-API � Status Codes � Z-score + IQR + Trend + Traffic Silence � 80-day baseline
                  {lastRun && ` � Last run: ${lastRun.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={runAnalysis} disabled={running}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 16px", background: "#1f60c4", border: "none", borderRadius: 3, color: "#fff", fontSize: 12, fontWeight: 600, cursor: running ? "not-allowed" : "pointer", opacity: running ? 0.7 : 1 }}>
                <FaSync style={{ fontSize: 11, animation: running ? "spin 1s linear infinite" : "none" }} />
                {running ? "Analyzing 80 days..." : "Run ML Analysis"}
              </button>
              {data && (
                <button onClick={exportCSV}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", background: "rgba(115,191,105,0.1)", border: "1px solid rgba(115,191,105,0.3)", borderRadius: 3, color: "#73bf69", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  <FaDownload style={{ fontSize: 11 }} />
                  Export CSV
                </button>
              )}
            </div>
          </div>

          <SummaryBar summary={data?.summary} systemSummary={data?.systemSummary} loading={loading} />

          {/* System-level alerts */}
          {!loading && data?.systemAlerts?.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#f2495c", textTransform: "uppercase", letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#f2495c", display: "inline-block" }} />
                Platform-Wide Signals
              </div>
              {data.systemAlerts.map((sa, i) => (
                <div key={i} style={{ padding: "10px 14px", background: sa.severity === "critical" ? "rgba(242,73,92,0.08)" : "rgba(245,166,35,0.08)", border: `1px solid ${sa.severity === "critical" ? "rgba(242,73,92,0.3)" : "rgba(245,166,35,0.3)"}`, borderRadius: 4, display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <span style={{ fontSize: 18, flexShrink: 0 }}>{sa.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: sa.severity === "critical" ? "#f2495c" : "#f5a623", background: sa.severity === "critical" ? "rgba(242,73,92,0.15)" : "rgba(245,166,35,0.15)", padding: "1px 7px", borderRadius: 3 }}>{sa.severity.toUpperCase()}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{sa.title}</span>
                    </div>
                    <div style={{ fontSize: 11, color: T.muted, marginBottom: 4 }}>{sa.detail}</div>
                    <div style={{ fontSize: 11, color: "#5794f2" }}>?? {sa.action}</div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: sa.severity === "critical" ? "#f2495c" : "#f5a623" }}>{(sa.value != null ? Math.round(sa.value) : 0).toLocaleString()}</div>
                    <div style={{ fontSize: 9, color: T.dim, textTransform: "uppercase" }}>{sa.metric?.replace("_", " ")}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {error && (
            <div style={{ padding: "10px 14px", background: "rgba(242,73,92,0.1)", border: "1px solid rgba(242,73,92,0.3)", borderRadius: 4, color: "#f2495c", fontSize: 12 }}>
              ? Analysis failed: {error}
            </div>
          )}

          {!loading && data && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ display: "flex", background: T.panel, border: `1px solid ${T.border2}`, borderRadius: 3, overflow: "hidden" }}>
                {["all", "critical", "warning", "info"].map(f => {
                  const count = f === "all" ? data.alerts.length : data.alerts.filter(a => a.severity === f).length;
                  const color = { all: "#5794f2", critical: "#f2495c", warning: "#f5a623", info: "#5794f2" }[f];
                  return (
                    <button key={f} onClick={() => setFilter(f)}
                      style={{ padding: "5px 12px", background: filter === f ? `${color}20` : "transparent", border: "none", color: filter === f ? color : T.muted, fontSize: 11, fontWeight: filter === f ? 700 : 400, cursor: "pointer" }}>
                      {f.charAt(0).toUpperCase() + f.slice(1)} ({count})
                    </button>
                  );
                })}
              </div>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search API name..."
                style={{ flex: 1, background: T.panel, border: `1px solid ${T.border2}`, borderRadius: 3, color: T.text, fontSize: 12, padding: "5px 10px", outline: "none" }}
                onFocus={e => e.target.style.borderColor = "#5794f2"}
                onBlur={e => e.target.style.borderColor = T.border2}
              />
              {data.summary && <span style={{ fontSize: 11, color: T.dim, flexShrink: 0 }}>{data.summary.analysisTimeMs}ms � {data.summary.dataRange}</span>}
            </div>
          )}

          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {Array(5).fill(0).map((_, i) => <div key={i} className="gf-skeleton" style={{ height: 56 }} />)}
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "20px 16px", background: "rgba(115,191,105,0.08)", border: "1px solid rgba(115,191,105,0.2)", borderRadius: 4 }}>
              <FaCheckCircle style={{ color: "#73bf69", fontSize: 24 }} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#73bf69" }}>All APIs Within Normal Baseline</div>
                <div style={{ fontSize: 12, color: T.muted, marginTop: 3 }}>ML analysis of {data?.summary?.total || 0} APIs across 80 days found no anomalies.</div>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {filtered.map((alert, i) => <AlertCard key={alert.operation} alert={alert} rank={i + 1} />)}
            </div>
          )}

          {!loading && data?.healthy?.length > 0 && filter === "all" && !search && (
            <details style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 4, overflow: "hidden" }}>
              <summary style={{ padding: "10px 14px", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#73bf69", listStyle: "none" }}>
                <FaCheckCircle style={{ fontSize: 12, marginRight: 6 }} />
                {data.healthy.length} Healthy APIs (within 80-day baseline)
              </summary>
              <div style={{ padding: "8px 14px", display: "flex", flexWrap: "wrap", gap: 6 }}>
                {data.healthy.map(h => (
                  <span key={h.operation} style={{ fontSize: 10, padding: "2px 8px", background: "rgba(115,191,105,0.08)", border: "1px solid rgba(115,191,105,0.2)", borderRadius: 3, color: "#73bf69" }}>
                    {h.operation} ({h.errorRate}%)
                  </span>
                ))}
              </div>
            </details>
          )}

          {!loading && data?.chronicFailures?.length > 0 && filter === "all" && !search && (
            <details style={{ background: T.panel, border: "1px solid rgba(245,166,35,0.2)", borderRadius: 4, overflow: "hidden" }}>
              <summary style={{ padding: "10px 14px", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#f5a623", listStyle: "none" }}>
                <FaExclamationTriangle style={{ fontSize: 12, marginRight: 6 }} />
                {data.chronicFailures.length} Chronically Failing APIs (excluded from alerts)
              </summary>
              <div style={{ padding: "10px 14px", background: T.bg }}>
                <div style={{ fontSize: 11, color: T.muted, marginBottom: 10, padding: "8px 10px", background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.2)", borderRadius: 3 }}>
                  ?? These APIs have been failing &gt;50% on average over 80 days. They are <strong style={{ color: "#f5a623" }}>NOT treated as incidents</strong> � they are known broken APIs that need architectural fixes.
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {data.chronicFailures.map(c => (
                    <div key={c.operation} style={{ padding: "8px 10px", background: T.panel, border: `1px solid ${T.border}`, borderRadius: 3, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 11, color: T.text, fontWeight: 600, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={c.operation}>{c.operation}</span>
                      <div style={{ display: "flex", gap: 10, fontSize: 10, color: T.muted, flexShrink: 0 }}>
                        <span>80d avg: <strong style={{ color: "#f5a623" }}>{c.avgErrorRate}%</strong></span>
                        {c.currErrorRate != null && (
                          <span>Current: <strong style={{ color: c.currErrorRate > c.avgErrorRate ? "#f2495c" : "#f5a623" }}>{c.currErrorRate}%</strong></span>
                        )}
                        <span>{c.days} days</span>
                        {c.totalCalls != null && <span>{c.totalCalls.toLocaleString()} calls</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </details>
          )}
        </>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
