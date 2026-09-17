import { useState, useEffect, useRef } from "react";
import { useTheme } from "../context/ThemeContext";
import { SiGrafana } from "react-icons/si";
import { FaExternalLinkAlt, FaLock, FaEye, FaThLarge, FaCog } from "react-icons/fa";

// Grafana URL helpers
const BASE = "/grafana";

// Viewer sees dashboards list in kiosk mode — no Grafana chrome
const viewerDashboardsUrl = () =>
  `${BASE}/dashboards?kiosk`;

// Admin sees full Grafana UI to manage data sources / build dashboards
const adminUrl = () =>
  `${BASE}/?forceLogin=true`;

// CSS injected into the iframe to hide Grafana's own header/sidebar/footer
// so it looks like a native part of our app
const HIDE_GRAFANA_CHROME_CSS = `
  /* Hide Grafana top navbar */
  .navbar, .sidemenu, nav[class*="navbar"], [class*="PageToolbar"],
  [data-testid="NavToolbar"], [class*="grafana-app"] > div > nav,
  .page-toolbar, [class*="page-header"] { display: none !important; }
  /* Hide Grafana scrollbar gutter */
  body { overflow: hidden !important; }
  /* Push content to fill full space */
  .main-view, [class*="main-view"], .dashboard-container,
  [class*="dashboard-container"] { padding-top: 0 !important; margin-top: 0 !important; }
`;

export default function GrafanaPage() {
  const { T } = useTheme();
  const role = localStorage.getItem("auth_role") || "viewer";
  const isAdmin = role === "admin";

  const [mode, setMode] = useState(isAdmin ? "admin" : "dashboards");
  const [iframeKey, setIframeKey] = useState(0);
  const iframeRef = useRef(null);

  // Inject CSS into the Grafana iframe after it loads to hide Grafana's own chrome
  const injectHideChrome = () => {
    try {
      const iframe = iframeRef.current;
      if (!iframe) return;
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc) return;
      const existing = doc.getElementById("nexgen-hide-chrome");
      if (existing) return;
      const style = doc.createElement("style");
      style.id = "nexgen-hide-chrome";
      style.textContent = HIDE_GRAFANA_CHROME_CSS;
      doc.head?.appendChild(style);
    } catch {
      // Cross-origin — can't inject, kiosk param handles it
    }
  };

  // Compute iframe src based on current mode
  const getSrc = () => {
    if (mode === "admin") return adminUrl();
    // Viewer or admin in dashboard-view mode
    return viewerDashboardsUrl();
  };

  const iframeSrc = getSrc();

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: T.bg }}>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 16px", borderBottom: `1px solid ${T.border}`,
        background: T.cardBg, flexShrink: 0, gap: 10,
      }}>
        {/* Left: title */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <SiGrafana style={{ fontSize: 18, color: "#F46800" }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>
            Data Visualization
          </span>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 3,
            background: isAdmin ? `${T.blue}22` : "rgba(50,172,45,0.15)",
            color: isAdmin ? T.blue : "#39d353",
            border: `1px solid ${isAdmin ? T.blue + "44" : "rgba(50,172,45,0.3)"}`,
            textTransform: "uppercase", letterSpacing: "0.05em",
            display: "flex", alignItems: "center", gap: 3,
          }}>
            {isAdmin ? <FaLock style={{ fontSize: 8 }} /> : <FaEye style={{ fontSize: 8 }} />}
            {isAdmin ? "Admin" : "View Only"}
          </span>
        </div>

        {/* Right: mode tabs + actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>

          {/* Tab: Dashboards */}
          <button
            onClick={() => { setMode("dashboards"); setIframeKey(k => k + 1); }}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "5px 11px", borderRadius: 4, fontSize: 12, cursor: "pointer",
              border: `1px solid ${mode === "dashboards" ? T.blue : T.border}`,
              background: mode === "dashboards" ? `${T.blue}18` : "transparent",
              color: mode === "dashboards" ? T.blue : T.muted,
              fontWeight: mode === "dashboards" ? 600 : 400,
            }}
          >
            <FaThLarge style={{ fontSize: 11 }} /> Dashboards
          </button>

          {/* Admin-only tab: Manage (full Grafana UI) */}
          {isAdmin && (
            <button
              onClick={() => { setMode("admin"); setIframeKey(k => k + 1); }}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "5px 11px", borderRadius: 4, fontSize: 12, cursor: "pointer",
                border: `1px solid ${mode === "admin" ? "#F46800" : T.border}`,
                background: mode === "admin" ? "rgba(244,104,0,0.12)" : "transparent",
                color: mode === "admin" ? "#F46800" : T.muted,
                fontWeight: mode === "admin" ? 600 : 400,
              }}
            >
              <FaCog style={{ fontSize: 11 }} /> Manage
            </button>
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

          {/* Open in new tab */}
          <a
            href={window.location.origin + iframeSrc}
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

      {/* ── Viewer info bar ────────────────────────────────────────────────── */}
      {!isAdmin && (
        <div style={{
          padding: "6px 16px", fontSize: 11, color: T.muted,
          background: "rgba(50,172,45,0.06)", borderBottom: `1px solid rgba(50,172,45,0.15)`,
          display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
        }}>
          <FaEye style={{ color: "#39d353", flexShrink: 0 }} />
          Read-only view — contact an admin to add data sources or create dashboards.
        </div>
      )}

      {/* ── Grafana iframe — fills remaining height ────────────────────────── */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <iframe
          key={iframeKey}
          ref={iframeRef}
          src={iframeSrc}
          title="Data Visualization"
          onLoad={injectHideChrome}
          style={{ width: "100%", height: "100%", border: "none", background: "#161719" }}
          allow="fullscreen"
        />
      </div>
    </div>
  );
}
