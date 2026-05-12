import { useEffect, useState, useRef } from "react";
import axios from "axios";
import { format } from "date-fns";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  Tooltip, CartesianGrid, ReferenceLine, Legend,
} from "recharts";
import { API_ENDPOINTS } from "../config/apiConfig";
import { useTheme } from "../context/ThemeContext";

const TIMESPAN_OPTIONS = [
  { label: "Last 30 min",  value: "30m" },
  { label: "Last 1 hour",  value: "1h" },
  { label: "Last 2 hours", value: "2h" },
  { label: "Last 3 hours", value: "3h" },
  { label: "Last 6 hours", value: "6h" },
  { label: "Last 12 hours",value: "12h" },
  { label: "Last 24 hours",value: "24h" },
  { label: "Last 2 days",  value: "2d" },
  { label: "Last 3 days",  value: "3d" },
  { label: "Last 7 days",  value: "7d" },
];

// Pool → color + glow
const POOL_COLORS = {
  appusrpool:  { stroke: "#38bdf8", glow: "rgba(56,189,248,0.6)",  fill: "rgba(56,189,248,0.08)"  },
  systempool:  { stroke: "#34d399", glow: "rgba(52,211,153,0.6)",  fill: "rgba(52,211,153,0.08)"  },
};
const FALLBACK_COLORS = ["#a78bfa", "#fb923c", "#f472b6", "#facc15"];

const CustomTooltip = ({ active, payload, label }) => {
  const { T, themeKey } = useTheme();
  const isLight = themeKey === "light";
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: isLight ? "rgba(240,242,250,0.97)" : "rgba(8,13,22,0.97)",
      border: isLight ? "1px solid #c8cce0" : "1px solid rgba(255,255,255,0.09)",
      borderRadius: 10, padding: "10px 14px",
      boxShadow: isLight ? "0 8px 32px rgba(0,0,0,0.15)" : "0 8px 32px rgba(0,0,0,0.7)",
      backdropFilter: "blur(12px)", minWidth: 170,
    }}>
      <p style={{ color: T.muted, fontSize: 11, marginBottom: 8, fontWeight: 500 }}>{label}</p>
      {payload.map((p) => (
        <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{
            width: 8, height: 8, borderRadius: "50%",
            backgroundColor: p.color, boxShadow: `0 0 8px ${p.color}`, flexShrink: 0,
          }} />
          <span style={{ color: T.text, fontSize: 11 }}>{p.name}:</span>
          <span style={{ color: p.color, fontWeight: 700, fontSize: 12, marginLeft: "auto" }}>
            {Number(p.value).toFixed(2)}%
          </span>
        </div>
      ))}
    </div>
  );
};

const NodePoolChart = () => {
  const { T, themeKey } = useTheme();
  const isLight = themeKey === "light";
  const [timespan, setTimespan] = useState("2h");
  const [chartData, setChartData] = useState([]);
  const [pools, setPools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const showDate = ["2d", "3d", "7d"].includes(timespan);

  const timespanRef = useRef(timespan);
  useEffect(() => { timespanRef.current = timespan; }, [timespan]);

  const load = (ts) => {
    const sd = ["2d", "3d", "7d"].includes(ts);
    setLoading(true);
    setError(false);
    axios.get(API_ENDPOINTS.nodePool(ts))
      .then((res) => {
        const rows = res.data?.tables?.[0]?.rows || [];
        const map = {};
        const poolSet = new Set();
        rows.forEach(([pool, ts, cpu]) => {
          const label = sd
            ? format(new Date(ts), "MM/dd HH:mm")
            : format(new Date(ts), "HH:mm");
          if (!map[label]) map[label] = { time: label };
          map[label][pool] = parseFloat(cpu.toFixed(2));
          poolSet.add(pool);
        });
        const sorted = Object.values(map).sort((a, b) => a.time.localeCompare(b.time));
        setChartData(sorted);
        setPools([...poolSet]);
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

  // Latest + peak per pool
  const stats = pools.map((pool) => {
    const vals = chartData.map(d => d[pool]).filter(v => v != null);
    return {
      pool,
      current: vals.at(-1) ?? 0,
      peak: Math.max(...vals, 0),
      color: POOL_COLORS[pool]?.stroke || FALLBACK_COLORS[pools.indexOf(pool) % FALLBACK_COLORS.length],
    };
  });

  return (
    <div style={{
      background: isLight
        ? "linear-gradient(135deg, #e4e6f0 0%, #eceef8 100%)"
        : "linear-gradient(135deg, #080d14 0%, #0f1623 100%)",
      border: isLight ? "1px solid #c8cce0" : "1px solid rgba(255,255,255,0.07)",
      borderRadius: 16, overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 20px",
        borderBottom: isLight ? "1px solid #c8cce0" : "1px solid rgba(255,255,255,0.06)",
        background: isLight
          ? "linear-gradient(90deg, rgba(26,79,170,0.06) 0%, rgba(52,211,153,0.04) 50%, transparent 100%)"
          : "linear-gradient(90deg, rgba(56,189,248,0.06) 0%, rgba(52,211,153,0.04) 50%, transparent 100%)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", gap: 5 }}>
            {["#38bdf8", "#34d399"].map((c, i) => (
              <span key={i} style={{
                width: 8, height: 8, borderRadius: "50%",
                backgroundColor: c, boxShadow: `0 0 10px ${c}`,
              }} />
            ))}
          </div>
          <span style={{ color: T.text, fontWeight: 700, fontSize: 14 }}>
            Node Pool CPU Usage
          </span>
          <span style={{
            color: T.muted, fontSize: 11, fontFamily: "monospace",
            background: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.04)", padding: "2px 8px", borderRadius: 6,
          }}>
            Max CPU % per Pool
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {lastUpdated && (
            <span style={{ color: T.dim, fontSize: 10 }}>
              Updated {format(lastUpdated, "HH:mm:ss")}
            </span>
          )}
          {error && (
            <span style={{
              color: "#f87171", fontSize: 11,
              background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)",
              padding: "3px 10px", borderRadius: 20,
            }}>⚠ API Error</span>
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

      {/* Stat cards */}
      {!loading && stats.length > 0 && (
        <div style={{ display: "flex", gap: 12, padding: "12px 20px 0", flexWrap: "wrap" }}>
          {stats.map(({ pool, current, peak, color }) => (
            <div key={pool} style={{
              background: isLight ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.03)",
              border: `1px solid ${color}30`,
              borderRadius: 10, padding: "10px 16px", minWidth: 160,
              boxShadow: `0 0 16px ${color}15`,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: color, boxShadow: `0 0 8px ${color}` }} />
                <span style={{ color: T.muted, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>
                  {pool}
                </span>
              </div>
              <div style={{ display: "flex", gap: 20 }}>
                <div>
                  <div style={{ color: T.muted, fontSize: 10 }}>Current</div>
                  <div style={{ color, fontWeight: 700, fontSize: 18 }}>{current.toFixed(1)}%</div>
                </div>
                <div>
                  <div style={{ color: T.muted, fontSize: 10 }}>Peak</div>
                  <div style={{ color: "#f87171", fontWeight: 700, fontSize: 18 }}>{peak.toFixed(1)}%</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Chart */}
      <div style={{ padding: "16px 20px 20px" }}>
        {loading ? (
          <div className="gf-skeleton" style={{ height: 280, borderRadius: 12 }} />
        ) : (
          <div style={{
            background: isLight
              ? "linear-gradient(145deg, #e8eaf2 0%, #f0f2fa 100%)"
              : "linear-gradient(145deg, #0d1117 0%, #161b27 100%)",
            border: isLight ? "1px solid #c8cce0" : "1px solid rgba(255,255,255,0.06)",
            borderRadius: 14, padding: "16px 12px 8px",
            boxShadow: isLight
              ? "0 4px 24px rgba(0,0,0,0.08)"
              : "0 4px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)",
          }}>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
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
                  axisLine={false} tickLine={false}
                  tickFormatter={(v) => `${v}%`}
                  domain={[0, 100]}
                  width={36}
                />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={80} stroke="#fbbf24" strokeDasharray="5 3" strokeWidth={1.5}
                  label={{ value: "80%", fill: "#fbbf24", fontSize: 9, position: "insideTopRight" }} />
                <ReferenceLine y={90} stroke="#f87171" strokeDasharray="5 3" strokeWidth={1.5}
                  label={{ value: "90%", fill: "#f87171", fontSize: 9, position: "insideTopRight" }} />
                <Legend
                  wrapperStyle={{ paddingTop: 12, fontSize: 11 }}
                  formatter={(value) => (
                    <span style={{ color: T.muted }}>{value}</span>
                  )}
                />
                {pools.map((pool, idx) => {
                  const c = POOL_COLORS[pool]?.stroke || FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
                  const glow = POOL_COLORS[pool]?.glow || c;
                  return (
                    <Line
                      key={pool}
                      type="monotone"
                      dataKey={pool}
                      stroke={c}
                      strokeWidth={2.5}
                      dot={false}
                      isAnimationActive={false}
                      activeDot={{ r: 5, fill: c, stroke: T.bg, strokeWidth: 2, style: { filter: `drop-shadow(0 0 6px ${glow})` } }}
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
};

export default NodePoolChart;
