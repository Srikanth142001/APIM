import MySQLConnectionsCard from "../MySQLConnectionsCard";
import MySQLMetricsCharts from "../MySQLMetricsCharts";
import SLATracker from "../../components/ui/SLATracker";
import { useEffect, useState } from "react";
import axios from "axios";
import { API_ENDPOINTS } from "../../config/apiConfig";
import { useTheme } from "../../context/ThemeContext";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";
import { format } from "date-fns";

// ── Lifted outside MySQLTab so they are stable component references ──────────

const MySQLSummaryStats = () => {
  const { T } = useTheme();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API_ENDPOINTS.mysqlConn}?timespan=2h`)
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
      {Array(3).fill(0).map((_, i) => <div key={i} className="gf-skeleton" style={{ height: 80, borderRadius: 4 }} />)}
    </div>
  );

  const results = data?.results || [];
  const getLatest = (name) => {
    const r = results.find(r => r.name === name);
    return r?.metricData?.at(-1)?.maximum || 0;
  };
  const getSum = (name) => {
    const r = results.find(r => r.name === name);
    return r?.metricData?.reduce((s, d) => s + (d.maximum || 0), 0) || 0;
  };

  const activeConn  = getLatest("active_connections");
  const activeTrans = getLatest("active_transactions");
  const totalSum    = getSum("total_connections_summary");

  const stats = [
    { label: "Active Connections",  value: activeConn,  color: activeConn  > 150 ? "#f2495c" : activeConn  > 80 ? "#f5a623" : "#73bf69", sub: "Current live connections"   },
    { label: "Active Transactions", value: activeTrans, color: activeTrans > 20  ? "#f2495c" : activeTrans > 10 ? "#f5a623" : "#73bf69", sub: "In-progress transactions"  },
    { label: "Conn Pool (2h Sum)",  value: totalSum,    color: "#5794f2",                                                                  sub: "Aggregated pool summary"   },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
      {stats.map(({ label, value, color, sub }) => (
        <div key={label} style={{ background: T.panel, border: `1px solid ${color}25`, borderRadius: 4, padding: "14px 16px", position: "relative", overflow: "hidden" }}>
          <div style={{ fontSize: 11, color: T.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>{label}</div>
          <div style={{ fontSize: 28, fontWeight: 800, color, letterSpacing: "-0.02em", lineHeight: 1 }}>{value.toLocaleString()}</div>
          <div style={{ fontSize: 10, color: T.dim, marginTop: 6 }}>{sub}</div>
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${color}, transparent)`, opacity: 0.5 }} />
        </div>
      ))}
    </div>
  );
};

const MySQLTrendChart = () => {
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
    axios.get(`${API_ENDPOINTS.mysqlConn}?timespan=6h`)
      .then(r => {
        const results = r.data?.results || [];
        const chartMap = {};
        results.forEach(({ name, metricData }) => {
          const label = name === "active_connections" ? "Active Conn" : name === "active_transactions" ? "Transactions" : "Pool Summary";
          (metricData || []).forEach(({ timeStamp, maximum }) => {
            const t = format(new Date(timeStamp), "HH:mm");
            if (!chartMap[t]) chartMap[t] = { time: t };
            chartMap[t][label] = maximum;
          });
        });
        setData(Object.values(chartMap).sort((a, b) => a.time.localeCompare(b.time)));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 4, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderBottom: `1px solid ${T.border}`, background: T.surface, minHeight: 36 }}>
        <span style={{ width: 3, height: 16, borderRadius: 2, background: T.blue, flexShrink: 0 }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: T.text }}>MySQL Connection Trends</span>
        <span style={{ fontSize: 10, color: T.muted, background: T.border, padding: "1px 7px", borderRadius: 3, border: `1px solid ${T.border2}` }}>Last 6 hours</span>
      </div>
      <div style={{ padding: "12px 14px" }}>
        {loading ? (
          <div className="gf-skeleton" style={{ height: 200, borderRadius: 4 }} />
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="2 4" stroke={gridStroke} vertical={false} />
              <XAxis dataKey="time" tick={{ fontSize: 9, fill: T.muted }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 9, fill: T.muted }} axisLine={false} tickLine={false} width={36} />
              <Tooltip {...TT} />
              <Legend wrapperStyle={{ fontSize: 10, color: T.muted }} />
              <Line type="monotone" dataKey="Active Conn"  stroke="#34d399" strokeWidth={2}   dot={false} activeDot={{ r: 3 }} isAnimationActive={false} />
              <Line type="monotone" dataKey="Transactions" stroke="#fb923c" strokeWidth={2}   dot={false} activeDot={{ r: 3 }} isAnimationActive={false} />
              <Line type="monotone" dataKey="Pool Summary" stroke="#38bdf8" strokeWidth={1.5} strokeDasharray="4 2" dot={false} activeDot={{ r: 3 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

// ── Main MySQLTab ─────────────────────────────────────────────────────────────
export default function MySQLTab({ overview }) {
  const { T } = useTheme();
  const [tabReady, setTabReady] = useState(false);

  // Small delay to let the tab paint its container before heavy components mount
  useEffect(() => {
    const id = requestAnimationFrame(() => setTabReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  if (!tabReady) return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        {Array(3).fill(0).map((_, i) => <div key={i} className="gf-skeleton" style={{ height: 80, borderRadius: 4 }} />)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 8 }}>
        <div className="gf-skeleton" style={{ height: 260, borderRadius: 4 }} />
        <div className="gf-skeleton" style={{ height: 260, borderRadius: 4 }} />
      </div>
      <div className="gf-skeleton" style={{ height: 320, borderRadius: 4 }} />
      <div className="gf-skeleton" style={{ height: 400, borderRadius: 4 }} />
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <MySQLSummaryStats />
      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 8 }}>
        <MySQLTrendChart />
        <SLATracker overview={overview} />
      </div>
      <MySQLConnectionsCard />
      <MySQLMetricsCharts />
    </div>
  );
}
