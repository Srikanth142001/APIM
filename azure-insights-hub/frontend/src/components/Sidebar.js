import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  FaTachometerAlt, FaServer, FaDatabase, FaExclamationTriangle,
  FaChevronLeft, FaChevronRight, FaSignOutAlt, FaBell,
  FaChartBar, FaTimesCircle, FaSun, FaMoon, FaCog, FaCloud,
} from "react-icons/fa";
import { useTheme } from "../context/ThemeContext";

const NAV = [
  { label: "Dashboard",       icon: FaTachometerAlt, path: "/dashboard",   section: "monitoring" },
  { label: "API Analytics",   icon: FaChartBar,      path: "/analytics",   section: "monitoring" },
  { label: "Performance",     icon: FaTachometerAlt, path: "/performance", section: "monitoring" },
  { label: "Failures Panel",  icon: FaTimesCircle,   path: "/failures",    section: "monitoring" },
  { label: "Alerts",          icon: FaBell,          path: "/alerts",      section: "monitoring" },
  { label: "Environments",    icon: FaCog,           path: "/setup",       section: "settings" },
];

const SECTIONS = [
  { key: "monitoring", label: "MONITORING" },
  { key: "settings",   label: "SETTINGS" },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [activeEnvName, setActiveEnvName] = useState(null);
  const navigate  = useNavigate();
  const location  = useLocation();
  const { T, themeKey, toggleTheme } = useTheme();
  const isLight = themeKey === "light";

  // Read active environment name from localStorage
  useEffect(() => {
    const envName = localStorage.getItem("active_env_name");
    setActiveEnvName(envName || null);

    // Listen for storage changes (when env is switched in Dashboard)
    const handler = () => {
      setActiveEnvName(localStorage.getItem("active_env_name") || null);
    };
    window.addEventListener("storage", handler);
    // Also poll every 2s for same-tab changes
    const interval = setInterval(handler, 2000);
    return () => {
      window.removeEventListener("storage", handler);
      clearInterval(interval);
    };
  }, []);

  const logout = () => {
    localStorage.removeItem("auth");
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_expires");
    localStorage.removeItem("auth_user");
    navigate("/");
  };

  const currentTab = new URLSearchParams(location.search).get("tab") || "overview";

  const isActive = (path) => location.pathname === path;

  return (
    <div
      style={{
        width: collapsed ? 52 : 210,
        minHeight: "100vh",
        background: T.sidebarBg,
        borderRight: `1px solid ${T.sidebarBorder}`,
        display: "flex",
        flexDirection: "column",
        transition: "width 0.2s ease, background 0.2s",
        flexShrink: 0,
        position: "relative",
        zIndex: 40,
      }}
    >
      {/* Logo */}
      <div
        style={{
          padding: "14px 12px",
          borderBottom: `1px solid ${T.sidebarBorder}`,
          display: "flex",
          alignItems: "center",
          gap: 10,
          minHeight: 52,
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            background: "linear-gradient(135deg, #1f60c4, #5794f2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            fontWeight: 800,
            color: "#fff",
            flexShrink: 0,
            letterSpacing: "-0.02em",
          }}
        >
          AIH
        </div>
        {!collapsed && (
          <div style={{ overflow: "hidden" }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: T.text,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              Azure Insights Hub
            </div>
            {activeEnvName && (
              <div
                style={{
                  fontSize: 10,
                  color: T.blue,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  marginTop: 1,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <FaCloud style={{ fontSize: 9 }} />
                {activeEnvName}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Nav */}
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
        {SECTIONS.map(({ key, label }) => (
          <div key={key}>
            {!collapsed && (
              <div
                style={{
                  padding: "10px 12px 4px",
                  fontSize: 10,
                  fontWeight: 700,
                  color: T.dim,
                  letterSpacing: "0.08em",
                }}
              >
                {label}
              </div>
            )}
            {NAV.filter((n) => n.section === key).map(({ label: lbl, icon: Icon, path }) => {
              const active = isActive(path);
              return (
                <button
                  key={path}
                  onClick={() => navigate(path)}
                  title={collapsed ? lbl : undefined}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: collapsed ? "9px 12px" : "8px 12px",
                    background: active
                      ? isLight
                        ? "rgba(26,79,170,0.12)"
                        : "rgba(87,148,242,0.15)"
                      : "transparent",
                    border: "none",
                    borderLeft: active
                      ? `2px solid ${T.blue}`
                      : "2px solid transparent",
                    color: active ? T.blue : T.muted,
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: active ? 600 : 400,
                    transition: "all 0.15s",
                    textAlign: "left",
                  }}
                  onMouseEnter={(e) => {
                    if (!active)
                      e.currentTarget.style.background = isLight
                        ? "rgba(0,0,0,0.06)"
                        : "rgba(255,255,255,0.05)";
                  }}
                  onMouseLeave={(e) => {
                    if (!active) e.currentTarget.style.background = "transparent";
                  }}
                >
                  <Icon style={{ fontSize: 14, flexShrink: 0 }} />
                  {!collapsed && (
                    <span
                      style={{
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {lbl}
                    </span>
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
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 12px",
            background: "transparent",
            border: "none",
            color: T.muted,
            cursor: "pointer",
            fontSize: 12,
            transition: "color 0.15s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = T.text)}
          onMouseLeave={(e) => (e.currentTarget.style.color = T.muted)}
        >
          {isLight ? (
            <FaMoon style={{ fontSize: 14, flexShrink: 0 }} />
          ) : (
            <FaSun style={{ fontSize: 14, flexShrink: 0 }} />
          )}
          {!collapsed && <span>{isLight ? "Dark Mode" : "Light Mode"}</span>}
        </button>

        {/* Logout */}
        <button
          onClick={logout}
          title="Logout"
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 12px",
            background: "transparent",
            border: "none",
            color: T.muted,
            cursor: "pointer",
            fontSize: 12,
            transition: "color 0.15s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#f2495c")}
          onMouseLeave={(e) => (e.currentTarget.style.color = T.muted)}
        >
          <FaSignOutAlt style={{ fontSize: 14, flexShrink: 0 }} />
          {!collapsed && <span>Logout</span>}
        </button>

        {/* Collapse */}
        <button
          onClick={() => setCollapsed((v) => !v)}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 12px",
            background: "transparent",
            border: "none",
            color: T.dim,
            cursor: "pointer",
            fontSize: 12,
            transition: "color 0.15s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = T.text)}
          onMouseLeave={(e) => (e.currentTarget.style.color = T.dim)}
        >
          {collapsed ? (
            <FaChevronRight style={{ fontSize: 12 }} />
          ) : (
            <>
              <FaChevronLeft style={{ fontSize: 12 }} />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
