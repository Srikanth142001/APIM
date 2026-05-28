import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  FaTachometerAlt, FaServer, FaDatabase, FaExclamationTriangle,
  FaClipboardList, FaFileAlt, FaChevronLeft, FaChevronRight,
  FaSignOutAlt, FaBell, FaNetworkWired, FaChartBar, FaTimesCircle,
  FaSun, FaMoon, FaChartLine,
} from "react-icons/fa";
import { useTheme } from "../../context/ThemeContext";
import { useFeatures } from "../../context/FeaturesContext";

const ALL_NAV = [
  { label: "Dashboard",       icon: FaTachometerAlt,       path: "/dashboard",               section: "monitoring", feature: null },
  { label: "API Analytics",   icon: FaChartBar,            path: "/dashboard?tab=analytics", section: "monitoring", feature: null },
  { label: "Failures Panel",  icon: FaTimesCircle,         path: "/failures",                section: "monitoring", feature: null },
  { label: "Performance",     icon: FaTachometerAlt,       path: "/performance",             section: "monitoring", feature: null },
  { label: "Infrastructure",  icon: FaServer,              path: "/dashboard?tab=infra",     section: "monitoring", feature: "infrastructure" },
  { label: "MySQL",           icon: FaDatabase,            path: "/dashboard?tab=mysql",     section: "monitoring", feature: "mysql" },
  { label: "Custom DB Query", icon: FaDatabase,            path: "/custom-db",               section: "monitoring", feature: null },
  { label: "KQL Dashboard",   icon: FaChartLine,           path: "/kql-dashboard",           section: "monitoring", feature: null },
  { label: "Alerts",          icon: FaBell,                path: "/dashboard?tab=alerts",    section: "monitoring", feature: null },
  { label: "ML Alerts",       icon: FaNetworkWired,        path: "/dashboard?tab=ml-alerts", section: "monitoring", feature: null },
  { label: "Outages",         icon: FaExclamationTriangle, path: "/outages",                 section: "incidents",  feature: null },
  { label: "New Outage",      icon: FaClipboardList,       path: "/OutageForm",              section: "incidents",  feature: null },
  { label: "Incident Report", icon: FaFileAlt,             path: "/view-IncidentFormPage",   section: "incidents",  feature: null },
];

const SECTIONS = [
  { key: "monitoring", label: "MONITORING" },
  { key: "incidents",  label: "INCIDENTS" },
];

export default function Sidebar({ alertCount = 0 }) {
  const [collapsed, setCollapsed] = useState(false);
  const navigate  = useNavigate();
  const location  = useLocation();
  const { T, themeKey, toggleTheme } = useTheme();
  const features  = useFeatures();

  // Filter nav items based on enabled features
  const NAV = ALL_NAV.filter(item =>
    !item.feature || features[item.feature] !== false
  );

  const logout = () => {
    localStorage.removeItem("auth");
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_expires");
    localStorage.removeItem("auth_user");
    localStorage.removeItem("auth_role");
    navigate("/");
  };

  const currentTab = new URLSearchParams(location.search).get("tab") || "overview";

  const isActive = (path) => {
    const [basePath, tabParam] = path.split("?tab=");
    if (basePath !== location.pathname) return false;
    if (tabParam) return currentTab === tabParam;
    return location.pathname === "/dashboard" && !new URLSearchParams(location.search).get("tab");
  };

  const isLight = themeKey === "light";

  return (
    <div style={{
      width: collapsed ? 52 : 200,
      minHeight: "100vh",
      background: T.sidebarBg,
      borderRight: `1px solid ${T.sidebarBorder}`,
      display: "flex",
      flexDirection: "column",
      transition: "width 0.2s ease, background 0.2s",
      flexShrink: 0,
      position: "relative",
      zIndex: 40,
    }}>

      {/* Logo */}
      <div style={{ padding: "14px 12px", borderBottom: `1px solid ${T.sidebarBorder}`, display: "flex", alignItems: "center", gap: 10, minHeight: 48 }}>
        <div style={{ width: 28, height: 28, borderRadius: 4, background: "linear-gradient(135deg, #1f60c4, #5794f2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "#fff", flexShrink: 0 }}>N</div>
        {!collapsed && (
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.text, whiteSpace: "nowrap", overflow: "hidden" }}>NexGen APIM</div>
            {(() => {
              const role = localStorage.getItem("auth_role") || "viewer";
              const user = localStorage.getItem("auth_user") || "";
              return (
                <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 1 }}>
                  <span style={{ fontSize: 10, color: T.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 80 }}>{user}</span>
                  <span style={{
                    fontSize: 9, fontWeight: 700, padding: "1px 5px",
                    background: role === "admin" ? `${T.blue}22` : `${T.green}22`,
                    color: role === "admin" ? T.blue : T.green,
                    border: `1px solid ${role === "admin" ? T.blue + "44" : T.green + "44"}`,
                    letterSpacing: "0.04em", textTransform: "uppercase", flexShrink: 0,
                  }}>
                    {role}
                  </span>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* Nav */}
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
        {SECTIONS.map(({ key, label }) => (
          <div key={key}>
            {!collapsed && (
              <div style={{ padding: "10px 12px 4px", fontSize: 10, fontWeight: 700, color: T.dim, letterSpacing: "0.08em" }}>{label}</div>
            )}
            {NAV.filter(n => n.section === key).map(({ label: lbl, icon: Icon, path }) => {
              const active = isActive(path);
              return (
                <button key={path} onClick={() => navigate(path)}
                  title={collapsed ? lbl : undefined}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 10,
                    padding: collapsed ? "9px 12px" : "8px 12px",
                    background: active
                      ? (isLight ? "rgba(26,79,170,0.12)" : "rgba(87,148,242,0.15)")
                      : "transparent",
                    border: "none",
                    borderLeft: active
                      ? `2px solid ${T.blue}`
                      : "2px solid transparent",
                    color: active ? T.blue : T.muted,
                    cursor: "pointer", fontSize: 12, fontWeight: active ? 600 : 400,
                    transition: "all 0.15s", textAlign: "left",
                  }}
                  onMouseEnter={e => {
                    if (!active) e.currentTarget.style.background = isLight
                      ? "rgba(0,0,0,0.06)"
                      : "rgba(255,255,255,0.05)";
                  }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
                >
                  <Icon style={{ fontSize: 14, flexShrink: 0 }} />
                  {!collapsed && <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{lbl}</span>}
                  {!collapsed && lbl === "Alerts" && alertCount > 0 && (
                    <span style={{ marginLeft: "auto", background: "#f2495c", color: "#fff", borderRadius: 10, fontSize: 10, fontWeight: 700, padding: "1px 6px", minWidth: 18, textAlign: "center" }}>{alertCount}</span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Bottom controls */}
      <div style={{ borderTop: `1px solid ${T.sidebarBorder}`, padding: "8px 0" }}>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          title={isLight ? "Switch to Dark Mode" : "Switch to Light Mode"}
          style={{
            width: "100%", display: "flex", alignItems: "center", gap: 10,
            padding: "8px 12px", background: "transparent", border: "none",
            color: T.muted, cursor: "pointer", fontSize: 12, transition: "color 0.15s",
          }}
          onMouseEnter={e => e.currentTarget.style.color = T.text}
          onMouseLeave={e => e.currentTarget.style.color = T.muted}
        >
          {isLight
            ? <FaMoon style={{ fontSize: 14, flexShrink: 0 }} />
            : <FaSun  style={{ fontSize: 14, flexShrink: 0 }} />}
          {!collapsed && <span>{isLight ? "Dark Mode" : "Light Mode"}</span>}
        </button>

        {/* Logout */}
        <button onClick={logout} title="Logout"
          style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "transparent", border: "none", color: T.muted, cursor: "pointer", fontSize: 12, transition: "color 0.15s" }}
          onMouseEnter={e => e.currentTarget.style.color = "#f2495c"}
          onMouseLeave={e => e.currentTarget.style.color = T.muted}
        >
          <FaSignOutAlt style={{ fontSize: 14, flexShrink: 0 }} />
          {!collapsed && <span>Logout</span>}
        </button>

        {/* Collapse */}
        <button onClick={() => setCollapsed(v => !v)}
          style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "transparent", border: "none", color: T.dim, cursor: "pointer", fontSize: 12, transition: "color 0.15s" }}
          onMouseEnter={e => e.currentTarget.style.color = T.text}
          onMouseLeave={e => e.currentTarget.style.color = T.dim}
        >
          {collapsed
            ? <FaChevronRight style={{ fontSize: 12 }} />
            : <><FaChevronLeft style={{ fontSize: 12 }} /><span>Collapse</span></>}
        </button>
      </div>
    </div>
  );
}
