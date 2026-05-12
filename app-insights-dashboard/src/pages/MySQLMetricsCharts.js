import { useEffect, useState, useRef } from "react";
import axios from "axios";
import { format } from "date-fns";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  Tooltip, CartesianGrid, ReferenceLine,
} from "recharts";
import { API_ENDPOINTS } from "../config/apiConfig";
import { useTheme } from "../context/ThemeContext";

// ─── Timespan options ────────────────────────────────────────────────────────
const TIMESPAN_OPTIONS = [
  { label: "Last 30 min",  value: "30m" },
  { label: "Last 1 hour",  value: "1h" },
  { label: "Last 3 hours", value: "3h" },
  { label: "Last 6 hours", value: "6h" },
  { label: "Last 12 hours",value: "12h" },
  { label: "Last 24 hours",value: "24h" },
  { label: "Last 2 days",  value: "2d" },
  { label: "Last 3 days",  value: "3d" },
  { label: "Last 7 days",  value: "7d" },
  { label: "Last 14 days", value: "14d" },
  { label: "Last 30 days", value: "30d" },
];

// ─── Chart definitions ────────────────────────────────────────────────────────
const CHARTS = [
  {
    key: "cpu_percent",
    title: "Host CPU %",
    unit: "%",
    warningLine: 70,
    criticalLine: 90,
    avgColor: "#38bdf8",
    maxColor: "#f43f5e",
    avgStop: "rgba(56,189,248,0.35)",
    maxStop: "rgba(244,63,94,0.25)",
  },
  {
    key: "memory_percent",
    title: "Memory %",
    unit: "%",
    warningLine: 70,
    criticalLine: 85,
    avgColor: "#34d399",
    maxColor: "#fb923c",
    avgStop: "rgba(52,211,153,0.35)",
    maxStop: "rgba(251,146,60,0.25)",
  },
  {
    key: "network_bytes_ingress",
    title: "Network Ingress",
    unit: "bytes",
    avgColor: "#a78bfa",
    maxColor: "#f472b6",
    avgStop: "rgba(167,139,250,0.35)",
    maxStop: "rgba(244,114,182,0.25)",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtBytes = (b) => {
  if (b >= 1_000_000_000) return `${(b / 1_000_000_000).toFixed(1)} GB`;
  if (b >= 1_000_000)     return `${(b / 1_000_000).toFixed(1)} MB`;
  if (b >= 1_000)         return `${(b / 1_000).toFixed(1)} KB`;
  return `${b} B`;
};

const fmtVal = (v, unit) =>
  unit === "bytes" ? fmtBytes(v) : `${Number(v).toFixed(2)}${unit}`;

// Smart time format: show date if range > 1 day
const fmtTime = (ts, showDate) =>
  showDate ? format(new Date(ts), "MM/dd HH:mm") : format(new Date(ts), "HH:mm");

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label, unit }) => {
  const { T, themeKey } = useTheme();
  const isLight = themeKey === "light";
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: isLight ? "rgba(240,242,250,0.97)" : "rgba(10,15,30,0.97)",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: 10,
      padding: "10px 14px",
      boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
      backdropFilter: "blur(12px)",
      minWidth: 160,
    }}>
      <p style={{ color: T.muted, fontSize: 11, marginBottom: 8, fontWeight: 500 }}>{label}</p>
      {payload.map((p) => (
        <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{
            width: 8, height: 8, borderRadius: "50%",
            backgroundColor: p.color,
            boxShadow: `0 0 8px ${p.color}`,
            flexShrink: 0,
          }} />
          <span style={{ color: T.text, fontSize: 11 }}>{p.name}:</span>
          <span style={{ color: p.color, fontWeight: 700, fontSize: 12, marginLeft: "auto" }}>
            {fmtVal(p.value, unit)}
          </span>
        </div>
      ))}
    </div>
  );
};

// ─── Single metric chart ──────────────────────────────────────────────────────
const MetricChart = ({ title, data, avgColor, maxColor, avgStop, maxStop, unit, warningLine, criticalLine, showDate }) => {
  const { T, themeKey } = useTheme();
  const isLight = themeKey === "light";
  const uid = title.replace(/\s+/g, "_");

  // Stat summary
  const avgVals = data.map(d => d.Average).filter(Boolean);
  const maxVals = data.map(d => d.Maximum).filter(Boolean);
  const currentAvg = avgVals.at(-1) ?? 0;
  const currentMax = maxVals.at(-1) ?? 0;
  const peakMax = Math.max(...maxVals, 0);

  const statusColor = criticalLine && currentMax >= criticalLine
    ? "#f43f5e"
    : warningLine && currentMax >= warningLine
    ? "#fbbf24"
    : "#34d399";

  return (
    <div style={{
      background: isLight
        ? "linear-gradient(145deg, #e8eaf2 0%, #f0f2fa 100%)"
        : "linear-gradient(145deg, #0d1117 0%, #161b27 100%)",
      border: isLight ? "1px solid #c8cce0" : "1px solid rgba(255,255,255,0.07)",
      borderRadius: 14,
      padding: "16px 18px",
      boxShadow: isLight
        ? "0 4px 24px rgba(0,0,0,0.08)"
        : `0 4px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)`,
    }}>
      {/* Chart header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            width: 3, height: 20, borderRadius: 2,
            background: `linear-gradient(180deg, ${avgColor}, ${maxColor})`,
            boxShadow: `0 0 10px ${avgColor}`,
            flexShrink: 0,
          }} />
          <span style={{ color: T.text, fontWeight: 600, fontSize: 13 }}>{title}</span>
          <span style={{
            width: 7, height: 7, borderRadius: "50%",
            backgroundColor: statusColor,
            boxShadow: `0 0 8px ${statusColor}`,
          }} />
        </div>
        {/* Mini stats */}
        <div style={{ display: "flex", gap: 12, fontSize: 11 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ color: T.muted }}>Current Avg</div>
            <div style={{ color: avgColor, fontWeight: 700 }}>{fmtVal(currentAvg, unit)}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ color: T.muted }}>Peak Max</div>
            <div style={{ color: maxColor, fontWeight: 700 }}>{fmtVal(peakMax, unit)}</div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 16, marginBottom: 10 }}>
        {[["Average", avgColor], ["Maximum", maxColor]].map(([name, color]) => (
          <span key={name} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: T.muted }}>
            <span style={{
              display: "inline-block", width: 20, height: 2, borderRadius: 1,
              backgroundColor: color, boxShadow: `0 0 6px ${color}`,
            }} />
            {name}
          </span>
        ))}
        {warningLine && (
          <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#fbbf24" }}>
            <span style={{ display: "inline-block", width: 20, height: 1.5, borderRadius: 1, backgroundColor: "#fbbf24", opacity: 0.7 }} />
            Warning ({warningLine}{unit !== "bytes" ? unit : ""})
          </span>
        )}
        {criticalLine && (
          <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#f87171" }}>
            <span style={{ display: "inline-block", width: 20, height: 1.5, borderRadius: 1, backgroundColor: "#f87171", opacity: 0.7 }} />
            Critical ({criticalLine}{unit !== "bytes" ? unit : ""})
          </span>
        )}
      </div>

      <ResponsiveContainer width="100%" height={210}>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`avg_${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={avgColor} stopOpacity={0.5} />
              <stop offset="85%" stopColor={avgColor} stopOpacity={0.03} />
            </linearGradient>
            <linearGradient id={`max_${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={maxColor} stopOpacity={0.35} />
              <stop offset="85%" stopColor={maxColor} stopOpacity={0.02} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="2 4" stroke={isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.04)"} vertical={false} />

          <XAxis
            dataKey="time"
            tick={{ fontSize: 10, fill: T.dim }}
            axisLine={{ stroke: isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)" }}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 10, fill: T.dim }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => fmtVal(v, unit)}
            width={unit === "bytes" ? 62 : 38}
          />

          <Tooltip content={<CustomTooltip unit={unit} />} />

          {warningLine && (
            <ReferenceLine y={warningLine} stroke="#fbbf24" strokeDasharray="6 3" strokeWidth={1.5}
              label={{ value: `${warningLine}${unit !== "bytes" ? unit : ""}`, fill: "#fbbf24", fontSize: 9, position: "insideTopRight" }} />
          )}
          {criticalLine && (
            <ReferenceLine y={criticalLine} stroke="#f87171" strokeDasharray="6 3" strokeWidth={1.5}
              label={{ value: `${criticalLine}${unit !== "bytes" ? unit : ""}`, fill: "#f87171", fontSize: 9, position: "insideTopRight" }} />
          )}

          <Area
            type="monotone" dataKey="Average" stroke={avgColor} strokeWidth={2.5}
            fill={`url(#avg_${uid})`} dot={false}
            activeDot={{ r: 5, fill: avgColor, stroke: T.bg, strokeWidth: 2 }}
          />
          <Area
            type="monotone" dataKey="Maximum" stroke={maxColor} strokeWidth={2}
            strokeDasharray="6 3" fill={`url(#max_${uid})`} dot={false}
            activeDot={{ r: 5, fill: maxColor, stroke: T.bg, strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────
const MySQLMetricsCharts = () => {
  const { T, themeKey } = useTheme();
  const isLight = themeKey === "light";
  const [timespan, setTimespan] = useState("1h");
  const [chartData, setChartData] = useState({});
  const [serverName, setServerName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const showDate = ["2d", "3d", "7d", "14d", "30d"].includes(timespan);

  const timespanRef = useRef(timespan);
  useEffect(() => { timespanRef.current = timespan; }, [timespan]);

  const load = (ts) => {
    const sd = ["2d", "3d", "7d", "14d", "30d"].includes(ts);
    setLoading(true);
    setError(false);
    axios.get(API_ENDPOINTS.mysqlMetrics(ts))
      .then((res) => {
        const values = res.data?.value || [];
        setServerName(res.data?.resourceregion || "");
        const parsed = {};
        values.forEach(({ name, timeseries }) => {
          const raw = timeseries?.[0]?.data || [];
          parsed[name.value] = raw.map((d) => ({
            time: sd ? format(new Date(d.timeStamp), "MM/dd HH:mm") : format(new Date(d.timeStamp), "HH:mm"),
            rawTs: d.timeStamp,
            Average: parseFloat((d.average ?? 0).toFixed(2)),
            Maximum: parseFloat((d.maximum ?? 0).toFixed(2)),
          }));
        });
        setChartData(parsed);
        setLastUpdated(new Date());
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load(timespan);
    const t = setInterval(() => load(timespanRef.current), 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [timespan]);

  const selectedLabel = TIMESPAN_OPTIONS.find(o => o.value === timespan)?.label || timespan;

  return (
    <div style={{
      background: isLight
        ? "linear-gradient(135deg, #e4e6f0 0%, #eceef8 100%)"
        : "linear-gradient(135deg, #080d14 0%, #0f1623 100%)",
      border: isLight ? "1px solid #c8cce0" : "1px solid rgba(255,255,255,0.07)",
      borderRadius: 16,
      overflow: "hidden",
    }}>
      {/* ── Header ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 20px",
        borderBottom: isLight ? "1px solid #c8cce0" : "1px solid rgba(255,255,255,0.06)",
        background: isLight
          ? "linear-gradient(90deg, rgba(26,79,170,0.06) 0%, rgba(167,139,250,0.04) 50%, transparent 100%)"
          : "linear-gradient(90deg, rgba(56,189,248,0.06) 0%, rgba(167,139,250,0.04) 50%, transparent 100%)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Colored dots */}
          <div style={{ display: "flex", gap: 5 }}>
            {["#38bdf8", "#34d399", "#a78bfa"].map((c, i) => (
              <span key={i} style={{
                width: 8, height: 8, borderRadius: "50%", backgroundColor: c,
                boxShadow: `0 0 10px ${c}`,
                animation: i === 0 ? "pulse 2s infinite" : "none",
              }} />
            ))}
          </div>
          <span style={{ color: T.text, fontWeight: 700, fontSize: 14 }}>MySQL Server Metrics</span>
          {serverName && (
            <span style={{
              color: T.muted, fontSize: 11, fontFamily: "monospace",
              background: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.04)", padding: "2px 8px", borderRadius: 6,
            }}>
              {serverName}
            </span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {lastUpdated && (
            <span style={{ color: T.dim, fontSize: 10 }}>
              Updated {format(lastUpdated, "HH:mm:ss")}
            </span>
          )}
          <span style={{ fontSize: 10, color: T.dim, background: T.surface, padding: "2px 8px", borderRadius: 4, border: `1px solid ${T.border}` }}>
            🕐 SAST (UTC+2)
          </span>
          {error && (
            <span style={{
              color: "#f87171", fontSize: 11,
              background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)",
              padding: "3px 10px", borderRadius: 20,
            }}>
              ⚠ API Error
            </span>
          )}

          {/* Dropdown */}
          <div style={{ position: "relative" }}>
            <select
              value={timespan}
              onChange={(e) => setTimespan(e.target.value)}
              className="gf-select"
              style={{ paddingRight: 28 }}
            >
              {TIMESPAN_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <span style={{
              position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
              color: T.muted, fontSize: 10, pointerEvents: "none",
            }}>▼</span>
          </div>
        </div>
      </div>

      {/* ── Charts ── */}
      {loading ? (
        <div style={{ padding: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="gf-skeleton" style={{
              gridColumn: i === 2 ? "1 / -1" : "auto",
              height: 260, borderRadius: 14,
            }} />
          ))}
        </div>
      ) : (
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {CHARTS.slice(0, 2).map((c) => (
              <MetricChart key={c.key} {...c} data={chartData[c.key] || []} showDate={showDate} />
            ))}
          </div>
          <MetricChart {...CHARTS[2]} data={chartData[CHARTS[2].key] || []} showDate={showDate} />
        </div>
      )}
    </div>
  );
};

export default MySQLMetricsCharts;
