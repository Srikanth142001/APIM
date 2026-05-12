import { useEffect, useState } from "react";
import axios from "axios";
import { format } from "date-fns";
import { API_ENDPOINTS } from "../config/apiConfig";
import { useTheme } from "../context/ThemeContext";

const getColorClass = (value, thresholds) => {
  if (value >= thresholds.critical) return { barColor: "#f2495c", textColor: "#f2495c" };
  if (value >= thresholds.warning)  return { barColor: "#f5a623", textColor: "#f5a623" };
  return                                   { barColor: "#73bf69", textColor: "#73bf69" };
};

const MiniBar = ({ value, max = 100, color, T }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
    <div style={{ flex: 1, background: T.border, borderRadius: 2, height: 4, overflow: "hidden" }}>
      <div style={{ height: "100%", borderRadius: 2, background: color, width: `${Math.min((value / max) * 100, 100)}%`, transition: "width 0.4s ease" }} />
    </div>
    <span style={{ fontSize: 11, color, fontWeight: 600, minWidth: 36, textAlign: "right" }}>{value}%</span>
  </div>
);

const NodeCpuOverview = () => {
  const { T } = useTheme();
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: "CPU", dir: "desc" });
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    const fetchData = () => {
      axios.get(API_ENDPOINTS.nodeCpu)
        .then((res) => {
          const table = res.data?.tables?.[0];
          if (!table) return;
          const cols = table.columns.map((c) => c.name);
          const parsed = table.rows.map((row) => {
            const obj = {};
            cols.forEach((col, i) => (obj[col] = row[i]));
            return obj;
          });
          setNodes(parsed);
          setError(false);
          setLastUpdated(new Date());
        })
        .catch(() => setError(true))
        .finally(() => setLoading(false));
    };
    fetchData();
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const sorted = [...nodes].sort((a, b) => {
    const aVal = a[sortConfig.key];
    const bVal = b[sortConfig.key];
    return sortConfig.dir === "asc" ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
  });

  const handleSort = (key) => {
    setSortConfig((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }
    );
  };

  const SortIcon = ({ col }) => {
    if (sortConfig.key !== col) return <span style={{ color: T.dim, fontSize: 10 }}>↕</span>;
    return <span style={{ color: T.blue, fontSize: 10 }}>{sortConfig.dir === "asc" ? "↑" : "↓"}</span>;
  };

  if (loading) return (
    <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 4, padding: 14 }}>
      <div className="gf-skeleton" style={{ height: 11, width: "30%", marginBottom: 12 }} />
      {Array(5).fill(0).map((_, i) => <div key={i} className="gf-skeleton" style={{ height: 28, marginBottom: 4 }} />)}
    </div>
  );

  return (
    <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 4, overflow: "hidden" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px", borderBottom: `1px solid ${T.border}`, background: T.surface, minHeight: 36 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 3, height: 16, borderRadius: 2, background: "#73bf69", flexShrink: 0 }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: T.text }}>Pod Monitoring — Node Overview</span>
          <span className="pulse-dot" style={{ background: "#73bf69" }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 11 }}>
          {[["Normal","#73bf69"],["Warning","#f5a623"],["Critical","#f2495c"]].map(([l,c]) => (
            <span key={l} style={{ display: "flex", alignItems: "center", gap: 4, color: T.muted }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: c, display: "inline-block" }} />{l}
            </span>
          ))}
          {lastUpdated && <span style={{ color: T.dim }}>Updated {format(lastUpdated, "HH:mm:ss")}</span>}
          {error && <span style={{ color: "#f2495c" }}>⚠ API Error</span>}
        </div>
      </div>

      {/* Summary badges */}
      <div style={{ display: "flex", gap: 6, padding: "8px 14px", borderBottom: `1px solid ${T.border}`, background: T.surface, flexWrap: "wrap" }}>
        {[
          { label: "Total Nodes", value: nodes.length, color: T.blue },
          { label: "Ready", value: nodes.filter(n => n.NodeStatus === "Ready").length, color: "#73bf69" },
          { label: "CPU > 20%", value: nodes.filter(n => n.CPU >= 20).length, color: "#f5a623" },
          { label: "CPU > 30%", value: nodes.filter(n => n.CPU >= 30).length, color: "#f2495c" },
          { label: "Pods > 100%", value: nodes.filter(n => n.PodPercent > 100).length, color: "#f2495c" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 10px", background: T.panel, border: `1px solid ${T.border}`, borderRadius: 3, fontSize: 11 }}>
            <span style={{ color: T.muted }}>{label}:</span>
            <span style={{ fontWeight: 700, color }}>{value}</span>
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr>
              {[
                { label: "Node Name", key: "NodeName", align: "left" },
                { label: "Status", key: null, align: "center" },
                { label: "CPU %", key: "CPU", align: "left" },
                { label: "Memory %", key: "Memory", align: "left" },
                { label: "Disk %", key: "Disk", align: "left" },
                { label: "Pod %", key: "PodPercent", align: "left" },
                { label: "Pod Count", key: "PodCount", align: "center" },
              ].map(({ label, key, align }) => (
                <th key={label}
                  onClick={() => key && handleSort(key)}
                  style={{ padding: "7px 10px", textAlign: align, fontSize: 11, fontWeight: 600, color: T.muted, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${T.border}`, background: T.surface, cursor: key ? "pointer" : "default", userSelect: "none", whiteSpace: "nowrap" }}>
                  {label} {key && <SortIcon col={key} />}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((node, i) => {
              const cpu  = getColorClass(node.CPU,        { warning: 20, critical: 30 });
              const mem  = getColorClass(node.Memory,     { warning: 50, critical: 80 });
              const disk = getColorClass(node.Disk,       { warning: 60, critical: 85 });
              const pod  = getColorClass(node.PodPercent, { warning: 90, critical: 100 });
              const isReady = node.NodeStatus === "Ready";
              return (
                <tr key={i} style={{ background: i % 2 === 0 ? T.panel : T.surface }}>
                  <td style={{ padding: "6px 10px", fontFamily: "monospace", fontSize: 11, color: T.text, borderBottom: `1px solid ${T.border}`, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={node.NodeName}>
                    {node.NodeName}
                  </td>
                  <td style={{ padding: "6px 10px", textAlign: "center", borderBottom: `1px solid ${T.border}` }}>
                    <span className={`gf-badge ${isReady ? "gf-badge-green" : "gf-badge-red"}`}>
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: isReady ? "#73bf69" : "#f2495c", display: "inline-block" }} />
                      {node.NodeStatus}
                    </span>
                  </td>
                  <td style={{ padding: "6px 10px", borderBottom: `1px solid ${T.border}` }}><MiniBar value={node.CPU} color={cpu.barColor} T={T} /></td>
                  <td style={{ padding: "6px 10px", borderBottom: `1px solid ${T.border}` }}><MiniBar value={node.Memory} color={mem.barColor} T={T} /></td>
                  <td style={{ padding: "6px 10px", borderBottom: `1px solid ${T.border}` }}><MiniBar value={node.Disk} color={disk.barColor} T={T} /></td>
                  <td style={{ padding: "6px 10px", borderBottom: `1px solid ${T.border}` }}><MiniBar value={node.PodPercent} color={pod.barColor} T={T} /></td>
                  <td style={{ padding: "6px 10px", textAlign: "center", fontWeight: 600, color: pod.textColor, borderBottom: `1px solid ${T.border}` }}>{node.PodCount}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default NodeCpuOverview;
