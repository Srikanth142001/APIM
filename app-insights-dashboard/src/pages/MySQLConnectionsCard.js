import { useEffect, useState } from "react";
import axios from "axios";
import { format } from "date-fns";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid,
} from "recharts";
import { API_ENDPOINTS } from "../config/apiConfig";
import { useTheme } from "../context/ThemeContext";

const METRICS = [
  { key: "active_connections",        label: "Active Connections",   warning: 80,  critical: 150, color: "#34d399",
    tooltip: "Current active connections to MySQL server" },
  { key: "total_connections_summary", label: "Conn Pool (Summary)",  warning: 100, critical: 200, color: "#38bdf8",
    tooltip: "Aggregated connection pool summary — this is a rolled-up metric and can be lower than Active Connections" },
  { key: "active_transactions",       label: "Active Transactions",  warning: 10,  critical: 20,  color: "#fb923c",
    tooltip: "Current active transactions in progress" },
];

const TIMESPAN_OPTIONS = [
  { label: "30 min", value: "30m" },
  { label: "1 hr",   value: "1h"  },
  { label: "2 hr",   value: "2h"  },
  { label: "6 hr",   value: "6h"  },
  { label: "12 hr",  value: "12h" },
  { label: "24 hr",  value: "24h" },
];

const getBadge = (value, warning, critical) => {
  if (value >= critical) return { label: "Critical", statusColor: "#f2495c", badgeClass: "gf-badge-red" };
  if (value >= warning)  return { label: "Warning",  statusColor: "#f5a623", badgeClass: "gf-badge-yellow" };
  return                        { label: "Normal",   statusColor: "#73bf69", badgeClass: "gf-badge-green" };
};

const MySQLConnectionsCard = () => {
  const { T, themeKey } = useTheme();
  const isLight = themeKey === "light";
  const gridStroke = isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.04)";

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [tooltip, setTooltip] = useState(null);
  const [timespan, setTimespan] = useState("2h");

  const load = (ts) => {
    setLoading(true);
    axios.get(`${API_ENDPOINTS.mysqlConn}?timespan=${ts}`)
      .then((res) => { setData(res.data); setError(false); })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load(timespan);
    const t = setInterval(() => load(timespan), 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [timespan]);

  const chartMap = {};
  (data?.results || []).forEach(({ name, metricData }) => {
    const metric = METRICS.find(m => m.key === name);
    if (!metric) return;
    (metricData || []).forEach(({ timeStamp, maximum }) => {
      const t = format(new Date(timeStamp), "HH:mm");
      if (!chartMap[t]) chartMap[t] = { time: t };
      chartMap[t][metric.label] = maximum;
    });
  });
  const chartData = Object.values(chartMap).sort((a, b) => a.time.localeCompare(b.time));

  const summaryValues = {};
  (data?.results || []).forEach(({ name, metricData }) => {
    if (!metricData?.length) return;
    if (name === "total_connections_summary") {
      summaryValues[name] = metricData.reduce((acc, d) => acc + (d.maximum || 0), 0);
    } else {
      summaryValues[name] = metricData[metricData.length - 1].maximum;
    }
  });

  const activeVal = summaryValues["active_connections"] ?? 0;
  const totalVal  = summaryValues["total_connections_summary"] ?? 0;
  const activeExceedsTotal = activeVal > totalVal;
  const tableRows = chartData.slice(-8).reverse();

  const metricInfo = {
    total_connections_summary: "Sum of all connection counts across the selected time window.",
    active_connections: "Most recent active connection count (last data point).",
    active_transactions: "Most recent active transaction count (last data point).",
  };

  return (
    <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 4, overflow: "hidden" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px", borderBottom: `1px solid ${T.border}`, background: T.surface, minHeight: 36 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 3, height: 16, borderRadius: 2, background: T.blue, flexShrink: 0 }} />
          <span className="pulse-dot" style={{ background: T.blue }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: T.text }}>
            MySQL Connections — {data?.mysqlServer || ""}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {error && <span style={{ fontSize: 11, color: "#f2495c" }}>⚠ API Error</span>}
          <div style={{ display: "flex", background: T.surface, border: `1px solid ${T.border2}`, borderRadius: 3, overflow: "hidden" }}>
            {TIMESPAN_OPTIONS.map(({ label, value }) => (
              <button key={value} onClick={() => setTimespan(value)}
                style={{ padding: "3px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer", border: "none", background: timespan === value ? (isLight ? "rgba(26,79,170,0.15)" : "rgba(87,148,242,0.2)") : "transparent", color: timespan === value ? T.blue : T.muted, transition: "all 0.15s" }}>
                {label}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10, fontSize: 11 }}>
            {[["Normal","#73bf69"],["Warning","#f5a623"],["Critical","#f2495c"]].map(([l,c]) => (
              <span key={l} style={{ display: "flex", alignItems: "center", gap: 4, color: T.muted }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: c, display: "inline-block" }} />{l}
              </span>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 14 }}>
          {Array(3).fill(0).map((_, i) => <div key={i} className="gf-skeleton" style={{ height: 28, marginBottom: 6 }} />)}
        </div>
      ) : (
        <>
          {activeExceedsTotal && (
            <div style={{ margin: "10px 14px 0", padding: "8px 12px", borderRadius: 3, background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.25)", display: "flex", alignItems: "flex-start", gap: 8 }}>
              <span style={{ color: "#f5a623", fontSize: 13, marginTop: 1 }}>ℹ</span>
              <p style={{ fontSize: 11, color: "#f5a623", margin: 0, lineHeight: 1.5 }}>
                <strong>Active Connections ({activeVal}) &gt; Conn Pool Summary ({totalVal})</strong> — expected behavior.
              </p>
            </div>
          )}

          {/* Summary cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, padding: "10px 14px", borderBottom: `1px solid ${T.border}`, background: T.surface }}>
            {METRICS.map(({ key, label, warning, critical }) => {
              const val = summaryValues[key] ?? 0;
              const { label: badgeLabel, statusColor, badgeClass } = getBadge(val, warning, critical);
              const isSum = key === "total_connections_summary";
              return (
                <div key={key} style={{ background: T.panel, border: `1px solid ${statusColor}25`, borderRadius: 4, padding: "12px 14px", position: "relative", overflow: "hidden" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <span style={{ fontSize: 11, color: T.muted, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
                    <div style={{ position: "relative" }}>
                      <span style={{ fontSize: 11, color: T.dim, cursor: "help" }}
                        onMouseEnter={() => setTooltip(key)} onMouseLeave={() => setTooltip(null)}>ⓘ</span>
                      {tooltip === key && (
                        <div className="gf-tooltip" style={{ bottom: "100%", left: "50%", transform: "translateX(-50%)", marginBottom: 6, position: "absolute" }}>
                          {metricInfo[key]}
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: statusColor, lineHeight: 1, letterSpacing: "-0.02em" }}>
                    {val.toLocaleString()}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
                    <span className={`gf-badge ${badgeClass}`} style={{ fontSize: 10 }}>{badgeLabel}</span>
                    <span style={{ fontSize: 10, color: T.dim }}>{isSum ? "∑ sum" : "latest"}</span>
                  </div>
                  <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${statusColor}, transparent)`, opacity: 0.5 }} />
                </div>
              );
            })}
          </div>

          {/* Chart + Table */}
          <div style={{ display: "flex", borderTop: `1px solid ${T.border}` }}>
            <div style={{ flex: 1, padding: "12px 14px", borderRight: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 11, color: T.muted, marginBottom: 8, fontWeight: 500 }}>Trend ({timespan})</div>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="2 4" stroke={gridStroke} vertical={false} />
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: T.muted }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: T.muted }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: T.panel, border: `1px solid ${T.border2}`, borderRadius: 4, fontSize: 12 }} labelStyle={{ color: T.muted, fontSize: 11 }} />
                  <Legend wrapperStyle={{ fontSize: 11, color: T.muted }} />
                  {METRICS.map(({ label, color }) => (
                    <Line key={label} type="monotone" dataKey={label} isAnimationActive={false} stroke={color} strokeWidth={2} dot={false} activeDot={{ r: 3, fill: color, stroke: T.panel, strokeWidth: 2 }} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div style={{ flex: 1, padding: "12px 14px", overflowX: "auto" }}>
              <div style={{ fontSize: 11, color: T.muted, marginBottom: 8, fontWeight: 500 }}>Recent Snapshots</div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={{ padding: "7px 10px", textAlign: "left", fontSize: 11, fontWeight: 600, color: T.muted, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${T.border}`, background: T.surface }}>Time</th>
                    {METRICS.map(m => <th key={m.key} style={{ padding: "7px 10px", textAlign: "center", fontSize: 11, fontWeight: 600, color: T.muted, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${T.border}`, background: T.surface }}>{m.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((row, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? T.panel : T.surface }}>
                      <td style={{ padding: "6px 10px", fontFamily: "monospace", fontSize: 11, color: T.text, borderBottom: `1px solid ${T.border}` }}>{row.time}</td>
                      {METRICS.map(({ key, label, warning, critical }) => {
                        const val = row[label];
                        if (val === undefined || val === null) return <td key={key} style={{ textAlign: "center", color: T.dim, padding: "6px 10px", borderBottom: `1px solid ${T.border}` }}>—</td>;
                        const { badgeClass, label: badgeLabel } = getBadge(val, warning, critical);
                        return (
                          <td key={key} style={{ textAlign: "center", padding: "6px 10px", borderBottom: `1px solid ${T.border}` }}>
                            <span className={`gf-badge ${badgeClass}`} style={{ fontSize: 11 }}>{val}</span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default MySQLConnectionsCard;
