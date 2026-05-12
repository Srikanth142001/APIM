import { useEffect, useState, Component } from "react";
import axios from "axios";
import NodeCpuOverview from "../NodeCpuOverview";
import NodePoolChart from "../NodePoolChart";
import HealthScore from "../../components/ui/HealthScore";
import TopologyMap from "../../components/ui/TopologyMap";
import { API_ENDPOINTS } from "../../config/apiConfig";
import { useTheme } from "../../context/ThemeContext";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";

// ── Error boundary to prevent blank page on child crash ──────────────────────
class SafeRender extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: '20px 16px', color: '#f2495c', fontSize: 12, background: 'rgba(242,73,92,0.06)', border: '1px solid rgba(242,73,92,0.2)', borderRadius: 4 }}>
          Component error: {this.state.error?.message || 'Unknown error'}
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Node Pool Trend chart (standalone sub-component) ─────────────────────────
function NodePoolTrend() {
  const { T, themeKey } = useTheme();
  const isLight = themeKey === "light";
  const gridStroke = isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.04)";
  const TT = {
    contentStyle: { background: T.panel, border: `1px solid ${T.border2}`, borderRadius: 4, fontSize: 11 },
    labelStyle: { color: T.muted, fontSize: 10 },
  };

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(API_ENDPOINTS.nodePool("2h"))
      .then(r => setData(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const pools = [...new Set(data.map(d => d.poolName || d.name || "pool"))];
  const COLORS = ["#5794f2", "#73bf69", "#f5a623", "#f2495c", "#b877d9"];

  const timeMap = {};
  data.forEach(d => {
    const t = d.time || d.timestamp;
    if (!timeMap[t]) timeMap[t] = { time: t };
    timeMap[t][d.poolName || d.name || "pool"] = d.value || d.cpu || 0;
  });
  const chartData = Object.values(timeMap).sort((a, b) => a.time.localeCompare(b.time));

  return (
    <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 4, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderBottom: `1px solid ${T.border}`, background: T.surface, minHeight: 36 }}>
        <span style={{ width: 3, height: 16, borderRadius: 2, background: T.blue, flexShrink: 0 }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: T.text }}>Node Pool CPU Trend</span>
        <span style={{ fontSize: 10, color: T.muted, background: T.border, padding: "1px 7px", borderRadius: 3, border: `1px solid ${T.border2}` }}>Last 2h</span>
      </div>
      <div style={{ padding: "12px 14px" }}>
        {loading ? (
          <div className="gf-skeleton" style={{ height: 180, width: "100%" }} />
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                {pools.map((p, i) => (
                  <linearGradient key={p} id={`infraPoolGrad${i}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0.3} />
                    <stop offset="90%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0.02} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="2 4" stroke={gridStroke} vertical={false} />
              <XAxis dataKey="time" tick={{ fontSize: 9, fill: T.muted }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 9, fill: T.muted }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} width={32} domain={[0, 100]} />
              <Tooltip
                contentStyle={TT.contentStyle}
                labelStyle={TT.labelStyle}
                formatter={(v, n) => [`${v?.toFixed(1)}%`, n]}
              />
              {pools.map((p, i) => (
                <Area key={p} type="monotone" dataKey={p} stroke={COLORS[i % COLORS.length]} isAnimationActive={false} strokeWidth={2} fill={`url(#infraPoolGrad${i})`} dot={false} connectNulls />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

// ── Main InfrastructureTab ────────────────────────────────────────────────────
export default function InfrastructureTab({ overview, activeConnections, mysqlApiError }) {
  const { T } = useTheme();
  const [nodeCount, setNodeCount] = useState(0);
  const [readyNodes, setReadyNodes] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    axios.get(API_ENDPOINTS.nodeCpu)
      .then(res => {
        const table = res.data?.tables?.[0];
        if (!table) return;
        const cols = table.columns.map(c => c.name);
        const rows = table.rows.map(row => {
          const o = {};
          cols.forEach((c, i) => (o[c] = row[i]));
          return o;
        });
        setNodeCount(rows.length);
        setReadyNodes(rows.filter(n => n.NodeStatus === "Ready").length);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8 }}>
          <div className="gf-skeleton" style={{ height: 280, borderRadius: 4 }} />
          <div className="gf-skeleton" style={{ height: 280, borderRadius: 4 }} />
        </div>
        <div className="gf-skeleton" style={{ height: 320, borderRadius: 4 }} />
        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 8 }}>
          <div className="gf-skeleton" style={{ height: 240, borderRadius: 4 }} />
          <div className="gf-skeleton" style={{ height: 240, borderRadius: 4 }} />
        </div>
        <div className="gf-skeleton" style={{ height: 280, borderRadius: 4 }} />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>

      {/* ── Row 1: Health Score + Topology ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8 }}>
        <SafeRender>
          <HealthScore
            overview={overview}
            activeConnections={activeConnections}
            mysqlApiError={mysqlApiError}
            nodeCount={nodeCount}
            readyNodes={readyNodes}
          />
        </SafeRender>
        <SafeRender>
          <TopologyMap
            overview={overview}
            activeConnections={activeConnections}
            mysqlApiError={mysqlApiError}
            nodeCount={nodeCount}
            readyNodes={readyNodes}
          />
        </SafeRender>
      </div>

      {/* ── Row 2: Node CPU Overview ── */}
      <SafeRender><NodeCpuOverview /></SafeRender>

      {/* ── Row 3: Node Pool Trend + Summary Stats ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 8 }}>
        <NodePoolTrend />

        {/* Infrastructure Summary */}
        <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 4, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderBottom: `1px solid ${T.border}`, background: T.surface, minHeight: 36 }}>
            <span style={{ width: 3, height: 16, borderRadius: 2, background: T.green, flexShrink: 0 }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: T.text }}>Infrastructure Summary</span>
          </div>
          <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { label: "Total Nodes",       value: nodeCount,                                                                                    color: T.blue   },
              { label: "Ready Nodes",       value: readyNodes,                                                                                   color: T.green  },
              { label: "Not Ready",         value: nodeCount - readyNodes,                                                                       color: nodeCount - readyNodes > 0 ? T.red : T.green },
              { label: "Node Availability", value: nodeCount > 0 ? `${((readyNodes / nodeCount) * 100).toFixed(1)}%` : "N/A",                   color: nodeCount > 0 && readyNodes / nodeCount >= 0.9 ? T.green : T.orange },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 3 }}>
                <span style={{ fontSize: 12, color: T.muted }}>{label}</span>
                <span style={{ fontSize: 18, fontWeight: 700, color }}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Row 4: Full Node Pool Chart ── */}
      <NodePoolChart />
    </div>
  );
}
