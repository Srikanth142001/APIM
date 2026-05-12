import { useNavigate } from "react-router-dom";
import { FaPlus, FaList, FaFileAlt, FaSync, FaDownload } from "react-icons/fa";
import { useTheme } from "../../context/ThemeContext";

export default function QuickActions({ onRefresh, loading, overview, range }) {
  const navigate = useNavigate();
  const { T } = useTheme();

  const exportCSV = () => {
    const rows = [
      ["Metric", "Value"],
      ["Avg Response Time (ms)", overview.avgResponseTime || 0],
      ["Total Requests", overview.totalRequests || 0],
      ["Total Failures", overview.totalFailures || 0],
      ["Error Rate (%)", overview.errorRate || 0],
      ["Total Success", (overview.totalRequests || 0) - (overview.totalFailures || 0)],
    ];
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `apim-metrics-${range}-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const actions = [
    { label: "New Outage", icon: FaPlus, color: T.red, onClick: () => navigate("/OutageForm") },
    { label: "View Outages", icon: FaList, color: T.blue, onClick: () => navigate("/outages") },
    { label: "Incident Report", icon: FaFileAlt, color: T.orange, onClick: () => navigate("/view-IncidentFormPage") },
    { label: "Export CSV", icon: FaDownload, color: T.green, onClick: exportCSV },
    { label: loading ? "Refreshing..." : "Refresh Now", icon: FaSync, color: T.muted, onClick: onRefresh, spin: loading },
  ];

  return (
    <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 4, padding: "10px 14px" }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: T.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Quick Actions</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {actions.map(({ label, icon: Icon, color, onClick, spin }) => (
          <button key={label} onClick={onClick}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", background: T.surface, border: `1px solid ${color}30`, borderRadius: 3, color, fontSize: 11, fontWeight: 600, cursor: "pointer", transition: "all 0.15s" }}
            onMouseEnter={e => { e.currentTarget.style.background = `${color}15`; e.currentTarget.style.borderColor = `${color}60`; }}
            onMouseLeave={e => { e.currentTarget.style.background = T.surface; e.currentTarget.style.borderColor = `${color}30`; }}
          >
            <Icon style={{ fontSize: 11, animation: spin ? "spin 1s linear infinite" : "none" }} />
            {label}
          </button>
        ))}
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
