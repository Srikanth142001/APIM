// Service Topology / Dependency Map — shows API → MySQL → Node relationships
import { useTheme } from "../../context/ThemeContext";

export default function TopologyMap({ overview, activeConnections, mysqlApiError, nodeCount, readyNodes }) {
  const { T } = useTheme();
  const errRate = overview.errorRate || 0;
  const rt = overview.avgResponseTime || 0;

  const apiStatus = errRate > 10 ? "critical" : errRate > 4 ? "warning" : "ok";
  const rtStatus = rt > 500 ? "critical" : rt > 400 ? "warning" : "ok";
  const mysqlStatus = mysqlApiError ? "warning" : activeConnections > 5000 ? "critical" : "ok";
  const infraStatus = nodeCount === 0 ? "unknown" : readyNodes / nodeCount < 0.7 ? "critical" : readyNodes / nodeCount < 0.9 ? "warning" : "ok";

  const STATUS = {
    ok:       { color: T.green,  label: "OK",      dot: T.green  },
    warning:  { color: T.orange, label: "WARN",    dot: T.orange },
    critical: { color: T.red,    label: "CRIT",    dot: T.red    },
    unknown:  { color: T.muted,  label: "UNKNOWN", dot: T.muted  },
  };

  const nodes = [
    { id: "client",  label: "Client",       sub: "External",          status: "ok",        x: 60,  y: 90,  icon: "👤" },
    { id: "apim",    label: "APIM Gateway", sub: `${(overview.totalRequests||0).toLocaleString()} req`, status: apiStatus, x: 200, y: 90, icon: "⚡" },
    { id: "backend", label: "App Backend",  sub: `${rt.toFixed(0)}ms avg`, status: rtStatus, x: 340, y: 40, icon: "🖥" },
    { id: "mysql",   label: "MySQL",        sub: `${activeConnections} conn`, status: mysqlStatus, x: 340, y: 140, icon: "🗄" },
    { id: "k8s",     label: "Kubernetes",   sub: `${readyNodes}/${nodeCount} nodes`, status: infraStatus, x: 480, y: 90, icon: "☸" },
  ];

  const edges = [
    { from: "client", to: "apim", label: "HTTPS" },
    { from: "apim", to: "backend", label: "REST" },
    { from: "apim", to: "mysql", label: "SQL" },
    { from: "backend", to: "k8s", label: "Pod" },
  ];

  const getNode = (id) => nodes.find(n => n.id === id);

  return (
    <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 4, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px", borderBottom: `1px solid ${T.border}`, background: T.surface, minHeight: 36 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 3, height: 16, borderRadius: 2, background: T.blue, flexShrink: 0 }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: T.text }}>Service Topology</span>
        </div>
        <span style={{ fontSize: 10, color: T.dim }}>Live dependency map</span>
      </div>
      <div style={{ padding: "16px 14px" }}>
        <svg width="100%" viewBox="0 0 560 200" style={{ overflow: "visible" }}>
          {/* Edges */}
          {edges.map(({ from, to, label }) => {
            const f = getNode(from), t = getNode(to);
            if (!f || !t) return null;
            const mx = (f.x + t.x) / 2, my = (f.y + t.y) / 2;
            const fStatus = STATUS[f.status];
            return (
              <g key={`${from}-${to}`}>
                <line x1={f.x + 28} y1={f.y + 16} x2={t.x - 4} y2={t.y + 16}
                  stroke={fStatus.color} strokeWidth={1.5} strokeDasharray="4 3" opacity={0.5} />
                <text x={mx} y={my + 4} textAnchor="middle" fontSize={9} fill={T.dim}>{label}</text>
              </g>
            );
          })}

          {/* Nodes */}
          {nodes.map(({ id, label, sub, status, x, y, icon }) => {
            const s = STATUS[status];
            return (
              <g key={id}>
                <rect x={x - 28} y={y} width={56} height={32} rx={4}
                  fill={T.surface} stroke={s.color} strokeWidth={1.5} opacity={0.9} />
                <text x={x} y={y + 12} textAnchor="middle" fontSize={11} fill={s.color}>{icon}</text>
                <text x={x} y={y + 22} textAnchor="middle" fontSize={9} fontWeight={600} fill={T.text}>{label}</text>
                <text x={x} y={y + 42} textAnchor="middle" fontSize={8} fill={T.muted}>{sub}</text>
                {/* Status dot */}
                <circle cx={x + 24} cy={y + 2} r={4} fill={s.color} />
              </g>
            );
          })}
        </svg>

        {/* Legend */}
        <div style={{ display: "flex", gap: 12, marginTop: 8, justifyContent: "center" }}>
          {Object.entries(STATUS).map(([key, { color, label }]) => (
            <span key={key} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: T.muted }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: color, display: "inline-block" }} />{label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
