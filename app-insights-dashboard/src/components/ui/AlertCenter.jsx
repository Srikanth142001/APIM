import { useState } from "react";
import { FaTimes, FaExclamationCircle, FaExclamationTriangle, FaInfoCircle, FaCheckCircle } from "react-icons/fa";
import { useTheme } from "../../context/ThemeContext";

const SEVERITY = {
  critical: { color: "#f2495c", bg: "rgba(242,73,92,0.1)", border: "rgba(242,73,92,0.3)", icon: FaExclamationCircle, label: "CRITICAL" },
  warning:  { color: "#f5a623", bg: "rgba(245,166,35,0.1)",  border: "rgba(245,166,35,0.3)",  icon: FaExclamationTriangle, label: "WARNING" },
  info:     { color: "#5794f2", bg: "rgba(87,148,242,0.1)",  border: "rgba(87,148,242,0.3)",  icon: FaInfoCircle, label: "INFO" },
  ok:       { color: "#73bf69", bg: "rgba(115,191,105,0.1)", border: "rgba(115,191,105,0.3)", icon: FaCheckCircle, label: "OK" },
};

export function generateAlerts(overview, activeConnections, mysqlApiError) {
  const alerts = [];
  const now = new Date();

  if (overview.errorRate > 10)
    alerts.push({ id: "err-critical", severity: "critical", title: "High Error Rate", message: `Error rate is ${overview.errorRate?.toFixed(2)}% — exceeds critical threshold of 10%`, time: now, category: "API" });
  else if (overview.errorRate > 4)
    alerts.push({ id: "err-warning", severity: "warning", title: "Elevated Error Rate", message: `Error rate is ${overview.errorRate?.toFixed(2)}% — exceeds warning threshold of 4%`, time: now, category: "API" });

  if (overview.avgResponseTime > 500)
    alerts.push({ id: "rt-critical", severity: "critical", title: "High Response Time", message: `Avg response time is ${overview.avgResponseTime?.toFixed(0)}ms — exceeds 500ms threshold`, time: now, category: "Performance" });
  else if (overview.avgResponseTime > 400)
    alerts.push({ id: "rt-warning", severity: "warning", title: "Slow Response Time", message: `Avg response time is ${overview.avgResponseTime?.toFixed(0)}ms — exceeds 400ms threshold`, time: now, category: "Performance" });

  if (mysqlApiError)
    alerts.push({ id: "mysql-err", severity: "warning", title: "MySQL API Unavailable", message: "MySQL connections API is returning errors. Connection data may be stale.", time: now, category: "Database" });
  else if (activeConnections > 5000)
    alerts.push({ id: "mysql-conn", severity: "critical", title: "MySQL Connection Overload", message: `Active connections: ${activeConnections} — exceeds critical threshold of 5000`, time: now, category: "Database" });

  if (alerts.length === 0)
    alerts.push({ id: "all-ok", severity: "ok", title: "All Systems Operational", message: "No active alerts. All metrics within normal thresholds.", time: now, category: "System" });

  return alerts;
}

export default function AlertCenter({ alerts = [], onClose }) {
  const { T } = useTheme();
  const [dismissed, setDismissed] = useState(new Set());
  const visible = alerts.filter(a => !dismissed.has(a.id));

  return (
    <div style={{ position: "fixed", top: 56, right: 16, width: 360, zIndex: 200, display: "flex", flexDirection: "column", gap: 6 }}>
      {visible.map(alert => {
        const s = SEVERITY[alert.severity];
        const Icon = s.icon;
        return (
          <div key={alert.id} className="animate-fadeIn" style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 4, padding: "10px 12px", display: "flex", gap: 10, alignItems: "flex-start", boxShadow: "0 4px 20px rgba(0,0,0,0.5)" }}>
            <Icon style={{ color: s.color, fontSize: 14, marginTop: 2, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: s.color }}>{s.label}</span>
                <span style={{ fontSize: 10, color: T.dim, background: T.panel, padding: "1px 6px", borderRadius: 3 }}>{alert.category}</span>
                <span style={{ fontSize: 10, color: T.dim, marginLeft: "auto" }}>{alert.time.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.text, marginBottom: 2 }}>{alert.title}</div>
              <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.4 }}>{alert.message}</div>
            </div>
            <button onClick={() => setDismissed(s => new Set([...s, alert.id]))}
              style={{ background: "none", border: "none", color: T.dim, cursor: "pointer", padding: 2, flexShrink: 0 }}
              onMouseEnter={e => e.currentTarget.style.color = T.text}
              onMouseLeave={e => e.currentTarget.style.color = T.dim}
            ><FaTimes style={{ fontSize: 11 }} /></button>
          </div>
        );
      })}
    </div>
  );
}
