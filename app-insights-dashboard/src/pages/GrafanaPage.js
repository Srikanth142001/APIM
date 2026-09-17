import { useState } from "react";
import { useTheme } from "../context/ThemeContext";
import { SiGrafana } from "react-icons/si";
import { FaExternalLinkAlt, FaLock, FaEye } from "react-icons/fa";

export default function GrafanaPage() {
  const { T } = useTheme();
  const role = localStorage.getItem("auth_role") || "viewer";
  const isAdmin = role === "admin";

  // For viewer: load Grafana anonymously — they can only VIEW dashboards
  // For admin:  load Grafana with the login page so they can sign in and manage
  const grafanaBase = "/grafana";
  const viewerUrl   = `${grafanaBase}/dashboards`;        // lands on dashboards list
  const adminUrl    = `${grafanaBase}/?forceLogin=true`;   // forces login prompt

  const iframeSrc = isAdmin ? adminUrl : viewerUrl;

  const [iframeKey, setIframeKey] = useState(0);

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100vh",
      background: T.bg,
      color: T.text,
    }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 20px",
        borderBottom: `1px solid ${T.border}`,
        background: T.cardBg,
        flexShrink: 0,
        gap: 12,
      }}>
        {/* Left: title + role badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <SiGrafana style={{ fontSize: 22, color: "#F46800" }} />
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.text, display: "flex", alignItems: "center", gap: 8 }}>
              Grafana
              {isAdmin ? (
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: "2px 7px",
                  background: "rgba(31,96,196,0.15)", color: T.blue,
                  border: `1px solid ${T.blue}44`, borderRadius: 3,
                  textTransform: "uppercase", letterSpacing: "0.05em",
                  display: "flex", alignItems: "center", gap: 4,
                }}>
                  <FaLock style={{ fontSize: 9 }} /> Admin
                </span>
              ) : (
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: "2px 7px",
                  background: "rgba(50,172,45,0.15)", color: "#39d353",
                  border: "1px solid rgba(50,172,45,0.3)", borderRadius: 3,
                  textTransform: "uppercase", letterSpacing: "0.05em",
                  display: "flex", alignItems: "center", gap: 4,
                }}>
                  <FaEye style={{ fontSize: 9 }} /> View Only
                </span>
              )}
            </div>
            <div style={{ fontSize: 11, color: T.muted }}>
              {isAdmin
                ? "Sign in to manage data sources, create and edit dashboards"
                : "View dashboards configured by admins — read-only access"}
            </div>
          </div>
        </div>

        {/* Right: actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {/* Admin-only: link to data sources page */}
          {isAdmin && (
            <a
              href={`${grafanaBase}/connections/datasources`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "6px 12px",
                background: "transparent",
                color: T.blue,
                border: `1px solid ${T.blue}55`,
                borderRadius: 4,
                textDecoration: "none",
                fontSize: 12, fontWeight: 500,
              }}
            >
              + Add Data Source
            </a>
          )}

          {/* Refresh iframe */}
          <button
            onClick={() => setIframeKey(k => k + 1)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "6px 12px",
              background: "transparent",
              color: T.muted,
              border: `1px solid ${T.border}`,
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            ↺ Reload
          </button>

          {/* Open in new tab */}
          <a
            href={window.location.origin + iframeSrc}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "6px 14px",
              background: "#F46800",
              color: "#fff",
              borderRadius: 4,
              textDecoration: "none",
              fontSize: 12, fontWeight: 600,
            }}
          >
            <FaExternalLinkAlt style={{ fontSize: 11 }} />
            Open in new tab
          </a>
        </div>
      </div>

      {/* ── Info bar for viewers ───────────────────────────────────────────── */}
      {!isAdmin && (
        <div style={{
          padding: "8px 20px",
          background: "rgba(50,172,45,0.08)",
          borderBottom: `1px solid rgba(50,172,45,0.2)`,
          fontSize: 12,
          color: T.muted,
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexShrink: 0,
        }}>
          <FaEye style={{ color: "#39d353", flexShrink: 0 }} />
          You have read-only access to Grafana dashboards. Contact an admin to add data sources or create dashboards.
        </div>
      )}

      {/* ── Grafana iframe ─────────────────────────────────────────────────── */}
      <iframe
        key={iframeKey}
        src={iframeSrc}
        title="Grafana"
        style={{
          flex: 1,
          width: "100%",
          border: "none",
          background: "#181b1f",
        }}
        allow="fullscreen"
      />
    </div>
  );
}
