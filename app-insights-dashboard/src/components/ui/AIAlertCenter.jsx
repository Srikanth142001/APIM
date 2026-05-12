/**
 * AI Alert Center
 * - Browser push notification registration
 * - Real-time ML anomaly feed
 * - Notification configuration (Teams, Email)
 * - Alert log with history
 */
import { useEffect, useState, useCallback, useRef } from "react";
import axios from "axios";
import { API_ENDPOINTS } from "../../config/apiConfig";
import { useTheme } from "../../context/ThemeContext";
import {
  FaBell, FaBellSlash, FaRobot, FaCheckCircle, FaExclamationCircle,
  FaExclamationTriangle, FaInfoCircle, FaCog, FaHistory, FaPlay,
  FaEnvelope, FaSlack, FaSync,
} from "react-icons/fa";

// ── Severity config ───────────────────────────────────────────────────────────
const SEV = {
  critical: { color: "#f2495c", bg: "rgba(242,73,92,0.1)",  border: "rgba(242,73,92,0.3)",  icon: FaExclamationCircle,  label: "CRITICAL" },
  warning:  { color: "#f5a623", bg: "rgba(245,166,35,0.1)", border: "rgba(245,166,35,0.3)", icon: FaExclamationTriangle, label: "WARNING" },
  info:     { color: "#5794f2", bg: "rgba(87,148,242,0.1)", border: "rgba(87,148,242,0.3)", icon: FaInfoCircle,          label: "INFO" },
  ok:       { color: "#73bf69", bg: "rgba(115,191,105,0.1)",border: "rgba(115,191,105,0.3)",icon: FaCheckCircle,         label: "OK" },
};

// ── Register Service Worker + Push ───────────────────────────────────────────
async function registerPushNotifications() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return { error: "Push notifications not supported in this browser" };
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { error: "Notification permission denied" };
  }

  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;

  const { data } = await axios.get(API_ENDPOINTS.alertVapidKey);
  const vapidKey = data.publicKey;

  const urlBase64ToUint8Array = (base64String) => {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = window.atob(base64);
    return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
  };

  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidKey),
  });

  await axios.post(API_ENDPOINTS.alertSubscribe, subscription.toJSON());
  return { success: true, subscription };
}

// ── Anomaly Card ──────────────────────────────────────────────────────────────
function AnomalyCard({ anomaly, T }) {
  const s = SEV[anomaly.severity] || SEV.info;
  const Icon = s.icon;
  const time = anomaly.timestamp ? new Date(anomaly.timestamp).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "";

  return (
    <div className="animate-fadeIn" style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 4, padding: "12px 14px", display: "flex", gap: 12 }}>
      <Icon style={{ color: s.color, fontSize: 16, marginTop: 2, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: s.color, background: `${s.color}20`, padding: "1px 7px", borderRadius: 3 }}>{s.label}</span>
          <span style={{ fontSize: 10, color: T.dim, background: T.panel, padding: "1px 6px", borderRadius: 3, border: `1px solid ${T.border}` }}>{anomaly.type?.replace(/_/g, " ")}</span>
          {anomaly.confidence && <span style={{ fontSize: 10, color: "#73bf69", background: "rgba(115,191,105,0.1)", padding: "1px 6px", borderRadius: 3 }}>🤖 {anomaly.confidence} confidence</span>}
          <span style={{ fontSize: 10, color: T.dim, marginLeft: "auto" }}>{time}</span>
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 4 }}>{anomaly.title}</div>
        <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.5, marginBottom: 6 }}>{anomaly.message}</div>
        {/* ML Stats */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {[
            { label: "Value", value: anomaly.value },
            { label: "Z-Score", value: anomaly.zScore },
            { label: "Baseline", value: anomaly.baseline },
            { label: "Trend", value: anomaly.trend },
          ].filter(d => d.value !== undefined && d.value !== "N/A").map(({ label, value }) => (
            <div key={label} style={{ fontSize: 10, color: T.dim }}>
              <span>{label}: </span>
              <span style={{ color: T.text, fontWeight: 600 }}>{String(value)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function AIAlertCenter() {
  const { T } = useTheme();
  const [pushStatus, setPushStatus] = useState("idle");
  const [mlStatus, setMlStatus] = useState(null);
  const [alertLog, setAlertLog] = useState([]);
  const [config, setConfig] = useState({ teamsWebhookUrl: "", alertEmailTo: "", minSeverity: "warning", enabled: true });
  const [activeSection, setActiveSection] = useState("live");
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const pollRef = useRef(null);

  useEffect(() => {
    if ("Notification" in window) {
      if (Notification.permission === "granted") setPushStatus("granted");
      else if (Notification.permission === "denied") setPushStatus("denied");
    }
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const [statusRes, logRes, configRes] = await Promise.allSettled([
        axios.get(API_ENDPOINTS.alertStatus),
        axios.get(`${API_ENDPOINTS.alertLog}?limit=30`),
        axios.get(API_ENDPOINTS.alertConfig),
      ]);
      if (statusRes.status === "fulfilled") setMlStatus(statusRes.value.data);
      if (logRes.status === "fulfilled") setAlertLog(logRes.value.data || []);
      if (configRes.status === "fulfilled") setConfig(prev => ({ ...prev, ...configRes.value.data }));
      setLastRefresh(new Date());
    } catch (err) {
      console.error("Alert status fetch failed:", err.message);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    pollRef.current = setInterval(fetchStatus, 30 * 1000);
    return () => clearInterval(pollRef.current);
  }, [fetchStatus]);

  const handleEnablePush = async () => {
    setPushStatus("requesting");
    try {
      const result = await registerPushNotifications();
      if (result.success) {
        setPushStatus("granted");
        fetchStatus();
      } else {
        setPushStatus("error");
        console.error("Push registration failed:", result.error);
      }
    } catch (err) {
      setPushStatus("error");
      console.error("Push error:", err.message);
    }
  };

  const handleRunML = async () => {
    setLoading(true);
    try {
      await axios.get(API_ENDPOINTS.alertRun);
      await fetchStatus();
    } catch (err) {
      console.error("ML run failed:", err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    try {
      await axios.post(API_ENDPOINTS.alertConfig, config);
      alert("Configuration saved!");
    } catch (err) {
      alert("Failed to save config: " + err.message);
    }
  };

  const handleTestNotification = async () => {
    setTestResult(null);
    try {
      const { data } = await axios.post(API_ENDPOINTS.alertTest, { severity: "warning" });
      setTestResult(data);
    } catch (err) {
      setTestResult({ error: err.message });
    }
  };

  const currentAnomalies = mlStatus?.lastAnalysis?.anomalies || [];
  const critCount = currentAnomalies.filter(a => a.severity === "critical").length;
  const warnCount = currentAnomalies.filter(a => a.severity === "warning").length;

  return (
    <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 4, overflow: "hidden" }}>
      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px", borderBottom: `1px solid ${T.border}`, background: T.surface, minHeight: 40 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <FaRobot style={{ color: T.blue, fontSize: 14 }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: T.text }}>AI Anomaly Detection Engine</span>
          {critCount > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: "#f2495c", background: "rgba(242,73,92,0.15)", padding: "1px 7px", borderRadius: 3 }}>{critCount} CRITICAL</span>}
          {warnCount > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: "#f5a623", background: "rgba(245,166,35,0.15)", padding: "1px 7px", borderRadius: 3 }}>{warnCount} WARNING</span>}
          {currentAnomalies.length === 0 && mlStatus && <span style={{ fontSize: 10, color: "#73bf69", background: "rgba(115,191,105,0.1)", padding: "1px 7px", borderRadius: 3 }}>✓ All Clear</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {lastRefresh && <span style={{ fontSize: 10, color: T.dim }}>Updated {lastRefresh.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>}
          <button onClick={pushStatus === "granted" ? undefined : handleEnablePush}
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", background: pushStatus === "granted" ? "rgba(115,191,105,0.1)" : "rgba(87,148,242,0.1)", border: `1px solid ${pushStatus === "granted" ? "rgba(115,191,105,0.3)" : "rgba(87,148,242,0.3)"}`, borderRadius: 3, color: pushStatus === "granted" ? "#73bf69" : T.blue, fontSize: 11, cursor: pushStatus === "granted" ? "default" : "pointer", fontWeight: 600 }}>
            {pushStatus === "granted" ? <FaBell style={{ fontSize: 11 }} /> : <FaBellSlash style={{ fontSize: 11 }} />}
            {pushStatus === "granted" ? "Push ON" : pushStatus === "requesting" ? "Enabling..." : pushStatus === "denied" ? "Blocked" : "Enable Push"}
          </button>
          <button onClick={handleRunML} disabled={loading}
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", background: "rgba(87,148,242,0.1)", border: "1px solid rgba(87,148,242,0.3)", borderRadius: 3, color: T.blue, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
            <FaSync style={{ fontSize: 10, animation: loading ? "spin 1s linear infinite" : "none" }} />
            Run ML Now
          </button>
        </div>
      </div>

      {/* ── ML Baseline Stats Bar ── */}
      {mlStatus?.baseline && (
        <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${T.border}`, background: T.bg, overflowX: "auto" }}>
          {[
            { label: "Error Rate Baseline", key: "errorRate", unit: "%" },
            { label: "Avg RT Baseline", key: "avgRt", unit: "ms" },
            { label: "Request Baseline", key: "requestCount", unit: "req" },
            { label: "Failure Baseline", key: "failureCount", unit: "" },
          ].map(({ label, key, unit }) => {
            const stat = mlStatus.baseline[key] || {};
            return (
              <div key={key} style={{ flex: 1, padding: "6px 12px", borderRight: `1px solid ${T.border}`, minWidth: 120 }}>
                <div style={{ fontSize: 9, color: T.dim, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>{label}</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{stat.mean}{unit}</span>
                  <span style={{ fontSize: 10, color: T.dim }}>±{stat.std}{unit}</span>
                </div>
                <div style={{ fontSize: 9, color: T.dim }}>{stat.samples} samples</div>
              </div>
            );
          })}
          <div style={{ flex: 1, padding: "6px 12px", minWidth: 100 }}>
            <div style={{ fontSize: 9, color: T.dim, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>Subscribers</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.blue }}>{mlStatus.subscribers || 0}</div>
            <div style={{ fontSize: 9, color: T.dim }}>push devices</div>
          </div>
        </div>
      )}

      {/* ── Section Tabs ── */}
      <div style={{ display: "flex", background: T.surface, borderBottom: `1px solid ${T.border}` }}>
        {[
          { id: "live",   label: "Live Anomalies", icon: FaRobot,   count: currentAnomalies.length },
          { id: "log",    label: "Alert Log",      icon: FaHistory, count: alertLog.length },
          { id: "config", label: "Configuration",  icon: FaCog },
        ].map(({ id, label, icon: Icon, count }) => (
          <button key={id} onClick={() => setActiveSection(id)}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "transparent", border: "none", borderBottom: activeSection === id ? `2px solid ${T.blue}` : "2px solid transparent", color: activeSection === id ? T.blue : T.muted, fontSize: 11, fontWeight: activeSection === id ? 600 : 400, cursor: "pointer", transition: "all 0.15s", marginBottom: -1 }}>
            <Icon style={{ fontSize: 11 }} />
            {label}
            {count !== undefined && count > 0 && <span style={{ background: id === "live" && critCount > 0 ? "#f2495c" : T.border, color: id === "live" && critCount > 0 ? "#fff" : T.muted, borderRadius: 10, fontSize: 9, fontWeight: 700, padding: "0 5px", minWidth: 16, textAlign: "center" }}>{count}</span>}
          </button>
        ))}
      </div>

      {/* ── Live Anomalies ── */}
      {activeSection === "live" && (
        <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
          {currentAnomalies.length === 0 ? (
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 14px", background: "rgba(115,191,105,0.08)", border: "1px solid rgba(115,191,105,0.2)", borderRadius: 4 }}>
              <FaCheckCircle style={{ color: "#73bf69", fontSize: 20, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#73bf69" }}>All Systems Normal</div>
                <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>
                  ML engine has analyzed {mlStatus?.lastAnalysis?.baselineSize || 0} data points. No anomalies detected.
                  {mlStatus?.lastAnalysis?.timestamp && ` Last check: ${new Date(mlStatus.lastAnalysis.timestamp).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`}
                </div>
              </div>
            </div>
          ) : (
            currentAnomalies.map((a, i) => <AnomalyCard key={a.id || i} anomaly={a} T={T} />)
          )}
        </div>
      )}

      {/* ── Alert Log ── */}
      {activeSection === "log" && (
        <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 6, maxHeight: 400, overflowY: "auto" }}>
          {alertLog.length === 0 ? (
            <div style={{ color: T.dim, fontSize: 12, textAlign: "center", padding: "20px 0" }}>No alerts logged yet. ML engine runs every 2 minutes.</div>
          ) : (
            alertLog.map((a, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 10px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 3 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: SEV[a.severity]?.color || T.muted, marginTop: 5, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.title}</span>
                    <span style={{ marginLeft: "auto", fontSize: 10, color: T.dim, flexShrink: 0 }}>
                      {a.loggedAt ? new Date(a.loggedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : ""}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: T.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.message}</div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Configuration ── */}
      {activeSection === "config" && (
        <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Enable/Disable */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 3 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.text }}>AI Alert Engine</div>
              <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>Enable/disable automatic ML anomaly detection and notifications</div>
            </div>
            <button onClick={() => setConfig(c => ({ ...c, enabled: !c.enabled }))}
              style={{ padding: "5px 14px", background: config.enabled ? "rgba(115,191,105,0.15)" : "rgba(242,73,92,0.1)", border: `1px solid ${config.enabled ? "rgba(115,191,105,0.3)" : "rgba(242,73,92,0.3)"}`, borderRadius: 3, color: config.enabled ? "#73bf69" : "#f2495c", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
              {config.enabled ? "ENABLED" : "DISABLED"}
            </button>
          </div>

          {/* Min Severity */}
          <div>
            <label style={{ fontSize: 11, color: T.muted, display: "block", marginBottom: 6 }}>Minimum Alert Severity</label>
            <div style={{ display: "flex", gap: 6 }}>
              {["warning", "critical"].map(sev => (
                <button key={sev} onClick={() => setConfig(c => ({ ...c, minSeverity: sev }))}
                  style={{ padding: "5px 14px", background: config.minSeverity === sev ? `${SEV[sev].bg}` : "transparent", border: `1px solid ${config.minSeverity === sev ? SEV[sev].border : T.border2}`, borderRadius: 3, color: config.minSeverity === sev ? SEV[sev].color : T.muted, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                  {sev.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Teams Webhook */}
          <div>
            <label style={{ fontSize: 11, color: T.muted, display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
              <FaSlack style={{ fontSize: 11 }} /> Microsoft Teams Webhook URL
            </label>
            <input
              type="text"
              value={config.teamsWebhookUrl}
              onChange={e => setConfig(c => ({ ...c, teamsWebhookUrl: e.target.value }))}
              placeholder="https://outlook.office.com/webhook/..."
              style={{ width: "100%", background: T.inputBg, border: `1px solid ${T.border2}`, borderRadius: 3, color: T.text, fontSize: 12, padding: "7px 10px", outline: "none", boxSizing: "border-box" }}
              onFocus={e => e.target.style.borderColor = T.blue}
              onBlur={e => e.target.style.borderColor = T.border2}
            />
            <div style={{ fontSize: 10, color: T.dim, marginTop: 4 }}>Alerts will be posted to this Teams channel when anomalies are detected</div>
          </div>

          {/* Email */}
          <div>
            <label style={{ fontSize: 11, color: T.muted, display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
              <FaEnvelope style={{ fontSize: 11 }} /> Alert Email Recipients
            </label>
            <input
              type="text"
              value={config.alertEmailTo}
              onChange={e => setConfig(c => ({ ...c, alertEmailTo: e.target.value }))}
              placeholder="ops-team@company.com, manager@company.com"
              style={{ width: "100%", background: T.inputBg, border: `1px solid ${T.border2}`, borderRadius: 3, color: T.text, fontSize: 12, padding: "7px 10px", outline: "none", boxSizing: "border-box" }}
              onFocus={e => e.target.style.borderColor = T.blue}
              onBlur={e => e.target.style.borderColor = T.border2}
            />
            <div style={{ fontSize: 10, color: T.dim, marginTop: 4 }}>Requires SMTP_HOST, SMTP_USER, SMTP_PASS in backend .env</div>
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 8, paddingTop: 4 }}>
            <button onClick={handleSaveConfig}
              style={{ flex: 1, padding: "8px 0", background: "#1f60c4", border: "none", borderRadius: 3, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              Save Configuration
            </button>
            <button onClick={handleTestNotification}
              style={{ padding: "8px 16px", background: "rgba(87,148,242,0.1)", border: "1px solid rgba(87,148,242,0.3)", borderRadius: 3, color: T.blue, fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
              <FaPlay style={{ fontSize: 10 }} /> Test
            </button>
          </div>

          {/* Test result */}
          {testResult && (
            <div style={{ padding: "10px 12px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 3, fontSize: 11 }}>
              <div style={{ fontWeight: 600, color: T.text, marginBottom: 6 }}>Test Result:</div>
              {Object.entries(testResult).map(([channel, result]) => (
                <div key={channel} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                  <span style={{ color: T.muted, width: 50 }}>{channel}:</span>
                  <span style={{ color: result?.sent || result?.success ? "#73bf69" : result?.skipped ? "#f5a623" : "#f2495c" }}>
                    {result?.sent || result?.success ? "✓ Sent" : result?.skipped ? `⚠ ${result.skipped}` : `✗ ${result?.error || "Failed"}`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
