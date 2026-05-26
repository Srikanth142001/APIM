import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import OutageForm from "./pages/OutageForm";
import Outages from "./pages/OutageListPage";
import OutageViewPage from "./pages/OutageViewPage";
import IncidentFormPage from "./pages/IncidentFormPage";
import FailuresPanel from "./pages/FailuresPanel";
import PerformancePanel from "./pages/PerfPanel";
import CustomDbQuery from "./pages/CustomDbQuery";
import Sidebar from "./components/ui/Sidebar";
import { isTokenValid } from "./config/axiosSetup";
import { ThemeProvider, useTheme } from "./context/ThemeContext";
import { FeaturesProvider } from "./context/FeaturesContext";

const ProtectedRoute = ({ children }) => {
  return isTokenValid() ? children : <Navigate to="/" />;
};

function AppLayout({ children }) {
  const { T, themeKey } = useTheme();
  return (
    <div
      data-theme={themeKey}
      data-theme-scope
      style={{ display: "flex", minHeight: "100vh", background: T.bg, transition: "background 0.2s, color 0.2s", color: T.text }}
    >
      <div data-sidebar style={{ flexShrink: 0 }}>
        <Sidebar />
      </div>
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
        <Route path="/dashboard" element={
          <ProtectedRoute><AppLayout><Dashboard /></AppLayout></ProtectedRoute>
        } />
        <Route path="/OutageForm" element={
          <ProtectedRoute><AppLayout><OutageForm /></AppLayout></ProtectedRoute>
        } />
        <Route path="/outages" element={
          <ProtectedRoute><AppLayout><Outages /></AppLayout></ProtectedRoute>
        } />
        <Route path="/edit-outage/:id" element={
          <ProtectedRoute><AppLayout><OutageForm /></AppLayout></ProtectedRoute>
        } />
        <Route path="/view-outage/:id" element={
          <ProtectedRoute><AppLayout><OutageViewPage /></AppLayout></ProtectedRoute>
        } />
        <Route path="/view-IncidentFormPage" element={
          <ProtectedRoute><AppLayout><IncidentFormPage /></AppLayout></ProtectedRoute>
        } />
        <Route path="/failures" element={
          <ProtectedRoute><AppLayout><FailuresPanel /></AppLayout></ProtectedRoute>
        } />
        <Route path="/performance" element={
          <ProtectedRoute><AppLayout><PerformancePanel /></AppLayout></ProtectedRoute>
        } />
        <Route path="/custom-db" element={
          <ProtectedRoute><AppLayout><CustomDbQuery /></AppLayout></ProtectedRoute>
        } />
      </Routes>
    </Router>
  );
}

function App() {
  return (
    <ThemeProvider>
      <FeaturesProvider>
        <AppRoutes />
      </FeaturesProvider>
    </ThemeProvider>
  );
}

export default App;
