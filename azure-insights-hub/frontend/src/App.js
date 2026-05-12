import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider, useTheme } from "./context/ThemeContext";
import { isTokenValid } from "./config/axiosSetup";
import Login from "./pages/Login";
import Setup from "./pages/Setup";
import Dashboard from "./pages/Dashboard";
import PerformancePanel from "./pages/PerformancePanel";
import FailuresPanel from "./pages/FailuresPanel";
import ApiAnalyticsPage from "./pages/ApiAnalyticsPage";
import Sidebar from "./components/Sidebar";
import "./App.css";

const ProtectedRoute = ({ children }) => isTokenValid() ? children : <Navigate to="/" />;

function AppLayout({ children }) {
  const { T, themeKey } = useTheme();
  return (
    <div data-theme={themeKey} data-theme-scope
      style={{ display: "flex", minHeight: "100vh", background: T.bg, color: T.text, transition: "background 0.2s, color 0.2s" }}>
      <div style={{ flexShrink: 0 }}><Sidebar /></div>
      <div style={{ flex: 1, overflow: "auto", minWidth: 0, background: T.bg, transition: "background 0.2s" }}>
        {children}
      </div>
    </div>
  );
}

function AppRoutes() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/setup" element={<ProtectedRoute><AppLayout><Setup /></AppLayout></ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><AppLayout><Dashboard /></AppLayout></ProtectedRoute>} />
        <Route path="/performance" element={<ProtectedRoute><AppLayout><PerformancePanel /></AppLayout></ProtectedRoute>} />
        <Route path="/failures" element={<ProtectedRoute><AppLayout><FailuresPanel /></AppLayout></ProtectedRoute>} />
        <Route path="/analytics" element={<ProtectedRoute><AppLayout><ApiAnalyticsPage /></AppLayout></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default function App() {
  return <ThemeProvider><AppRoutes /></ThemeProvider>;
}
