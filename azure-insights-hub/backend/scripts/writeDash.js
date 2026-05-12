const fs = require('fs');
const dest = 'C:/Users/srikanth.reddy/app-insights-dashboard/azure-insights-hub/frontend/src/pages/Dashboard.js';
const code = `
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "../config/axiosSetup";
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell } from "recharts";
import { FaClock, FaCheckCircle, FaTimesCircle, FaExclamationTriangle, FaSync, FaSignOutAlt, FaShieldAlt, FaBolt, FaChartBar, FaFire, FaExclamationCircle } from "react-icons/fa";
import { getSessionRemainingSeconds } from "../config/axiosSetup";
import { API_ENDPOINTS } from "../config/apiConfig";
import { useTheme } from "../context/ThemeContext";

export default function Dashboard() {
  const { T } = useTheme();
  return (
    <div style={{ background: T.bg, minHeight: "100vh", color: T.text, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, sans-serif" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🚀</div>
        <div style={{ fontSize: 24, fontWeight: 700, color: T.text, marginBottom: 8 }}>Dashboard Loading...</div>
        <div style={{ fontSize: 14, color: T.muted }}>Azure Insights Hub - ACC-PROD-36235-CCMP</div>
      </div>
    </div>
  );
}
`;
fs.writeFileSync(dest, code.trim(), 'utf8');
console.log('Written:', fs.statSync(dest).size, 'bytes');
