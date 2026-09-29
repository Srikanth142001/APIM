import { useState, useRef } from "react";
import { useTheme } from "../context/ThemeContext";
import { SiGrafana } from "react-icons/si";
import { FaExternalLinkAlt, FaThLarge, FaCog, FaDatabase } from "react-icons/fa";

const BASE = "/grafana";

export default function GrafanaPage() {
  const { T } = useTheme();
  const role = localStorage.getItem("auth_role") || "viewer";
  const isAdmin = role === "admin";

  // Modes: dashboards (everyone) | datasources (admin) | newdashboard (admin)
  const [mode, setMode] = useState("dashboards");
  const [iframeKey, setIframeKey] = useState(0);
  const iframeRef = useRef(null);

  const getSrc = () => {
    switch (mode) {
      case "datasources": return `${BASE}/connections/datasources`;
      case "newdashboard": return `${BASE}/dashboard/new`;
      default:            return `${BASE}/dashboards?kiosk`;
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: T.bg }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 16px", borderBottom: `1px solid ${T.border}`,
        background: T.cardBg, flexShrink: 0, gap: 10,
      }}>
        {/* Title */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <SiGrafana style={{ fontSize: 18, color: "#F46800" }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>
            Data Visualization
          </span>
        </div>

        {/* Tabs + actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>

          {/* Dashboards tab — visible to everyone */}
          <Tab
            active={mode === "dashboards"}
            onClick={() => { setMode("dashboards"); setIframeKey(k => k + 1); }}
            icon={<FaThLarge style={{ fontSize: 11 }} />}
            label="Dashboards"
            activeColor={T.blue}
          />

          {/* Admin-only tabs */}
          {isAdmin && (
            <>
              <Tab
                active={mode === "datasources"}
                onClick={() => { setMode("datasources"); setIframeKey(k => k + 1); }}
                icon={<FaDatabase style={{ fontSize: 11 }} />}
                label="Data Sources"
                activeColor="#F46800"
              />
              <Tab
                active={mode === "newdashboard"}
                onClick={() => { setMode("newdashboard"); setIframeKey(k => k + 1); }}
                icon={<FaCog style={{ fontSize: 11 }} />}
                label="New Dashboard"
                activeColor="#F46800"
              />
            </>
          )}

          {/* Reload */}
          <button
            onClick={() => setIframeKey(k => k + 1)}
            title="Reload"
            style={{
              padding: "5px 9px", borderRadius: 4, fontSize: 12, cursor: "pointer",
              border: `1px solid ${T.border}`, background: "transparent", color: T.muted,
            }}
          >↺</button>

          {/* Open full page */}
          <a
            href={window.location.origin + getSrc()}
            target="_blank" rel="noopener noreferrer"
            style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "5px 11px", background: "#F46800", color: "#fff",
              borderRadius: 4, textDecoration: "none", fontSize: 12, fontWeight: 600,
            }}
          >
            <FaExternalLinkAlt style={{ fontSize: 10 }} /> Open
          </a>
        </div>
      </div>

      {/* ── iframe ──────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <iframe
          key={iframeKey}
          ref={iframeRef}
          src={getSrc()}
          title="Data Visualization"
          style={{ width: "100%", height: "100%", border: "none", background: "#161719" }}
          allow="fullscreen"
        />
      </div>
    </div>
  );
}

// Reusable tab button
function Tab({ active, onClick, icon, label, activeColor }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 5,
        padding: "5px 11px", borderRadius: 4, fontSize: 12, cursor: "pointer",
        border: `1px solid ${active ? activeColor : "transparent"}`,
        background: active ? `${activeColor}18` : "transparent",
        color: active ? activeColor : "#888",
        fontWeight: active ? 600 : 400,
        transition: "all 0.15s",
      }}
    >
      {icon} {label}
    </button>
  );
}
