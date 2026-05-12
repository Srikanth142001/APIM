import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { API_ENDPOINTS } from "../../config/apiConfig";
import OutageDetectionPanel from "../OutageDetectionPanel";
import { generateAlerts } from "../../components/ui/AlertCenter";
import { useTheme } from "../../context/ThemeContext";
import {
  FaExclamationCircle, FaExclamationTriangle, FaInfoCircle, FaCheckCircle,
  FaSync, FaHistory, FaWhatsapp, FaTelegram,
} from "react-icons/fa";

// ── WhatsApp Configuration Panel ─────────────────────────────────────────────
function WhatsAppConfigPanel() {
  const { T } = useTheme();
  const [status, setStatus] = useState(null);
  const [config, setConfig] = useState({ token: "", phoneId: "", recipients: "" });
  const [testNumber, setTestNumber] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [showConfig, setShowConfig] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);

  useEffect(() => {
    axios.get(API_ENDPOINTS.whatsappStatus)
      .then(r => setStatus(r.data))
      .catch(() => {});
  }, []);

  const saveConfig = async () => {
    setSaving(true);
    try {
      const { data } = await axios.post(API_ENDPOINTS.whatsappConfig, {
        token:      config.token      || undefined,
        phoneId:    config.phoneId    || undefined,
        recipients: config.recipients || undefined,
      });
      setStatus({
        configured: data.configured,
        recipients: config.recipients.split(",").map(n => n.trim()).filter(Boolean).map(n => n.replace(/(\+\d{2})\d+(\d{4})/, "$1****$2")),
      });
      setSaveMsg(data.message || "Configuration saved!");
      setShowConfig(false);
    } catch (err) {
      setSaveMsg("❌ Failed: " + (err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    if (!testNumber) return alert("Enter a phone number");
    setTesting(true);
    setTestResult(null);
    try {
      await axios.post(API_ENDPOINTS.whatsappTest, { number: testNumber });
      setTestResult({ success: true, msg: `✅ Test message sent to ${testNumber}` });
    } catch (err) {
      setTestResult({ success: false, msg: `❌ ${err.response?.data?.error || err.message}` });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 4, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px", borderBottom: `1px solid ${T.border}`, background: T.surface, minHeight: 36 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <FaWhatsapp style={{ color: "#25D366", fontSize: 16 }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: T.text }}>WhatsApp Alerts</span>
          {status && (
            <span style={{ fontSize: 10, padding: "1px 8px", borderRadius: 3, fontWeight: 700, background: status.configured ? "rgba(37,211,102,0.15)" : "rgba(107,114,128,0.15)", color: status.configured ? "#25D366" : T.muted }}>
              {status.configured ? "✓ CONNECTED" : "NOT CONFIGURED"}
            </span>
          )}
        </div>
        <button onClick={() => setShowConfig(v => !v)}
          style={{ padding: "4px 10px", background: "transparent", border: `1px solid ${T.border2}`, borderRadius: 3, color: T.muted, fontSize: 11, cursor: "pointer" }}>
          {showConfig ? "Hide" : "Configure"}
        </button>
      </div>

      {status?.configured && !showConfig && (
        <div style={{ padding: "8px 14px", display: "flex", alignItems: "center", gap: 12, fontSize: 11 }}>
          <span style={{ color: T.muted }}>Recipients:</span>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {(status.recipients || []).map((n, i) => (
              <span key={i} style={{ padding: "1px 8px", background: "rgba(37,211,102,0.1)", border: "1px solid rgba(37,211,102,0.2)", borderRadius: 3, color: "#25D366", fontFamily: "monospace" }}>{n}</span>
            ))}
          </div>
          <span style={{ color: T.dim, marginLeft: "auto" }}>Auto-sends on CRITICAL alerts</span>
        </div>
      )}

      {showConfig && (
        <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ padding: "10px 12px", background: "rgba(37,211,102,0.06)", border: "1px solid rgba(37,211,102,0.2)", borderRadius: 3, fontSize: 11, color: T.muted, lineHeight: 1.6 }}>
            <div style={{ fontWeight: 700, color: "#25D366", marginBottom: 4 }}>📱 Setup Guide</div>
            <div>1. Go to <span style={{ color: T.blue }}>developers.facebook.com</span> → Create App → Business</div>
            <div>2. Add WhatsApp product → Get Phone Number ID + Access Token</div>
            <div>3. Add recipient numbers to test contacts (sandbox) or verify business account</div>
            <div>4. Recipients must have WhatsApp and send a message to your business number first (sandbox)</div>
          </div>

          {[
            { label: "Access Token", key: "token", placeholder: "EAAxxxxxxx... (permanent token from Meta)", type: "password" },
            { label: "Phone Number ID", key: "phoneId", placeholder: "123456789012345 (from WhatsApp dashboard)" },
            { label: "Recipients", key: "recipients", placeholder: "+1234567890,+0987654321 (comma-separated)" },
          ].map(({ label, key, placeholder, type }) => (
            <div key={key}>
              <label style={{ fontSize: 11, color: T.muted, display: "block", marginBottom: 5 }}>{label}</label>
              <input
                type={type || "text"}
                value={config[key]}
                onChange={e => setConfig(c => ({ ...c, [key]: e.target.value }))}
                placeholder={placeholder}
                style={{ width: "100%", background: T.inputBg, border: `1px solid ${T.border2}`, borderRadius: 3, color: T.text, fontSize: 12, padding: "7px 10px", outline: "none", boxSizing: "border-box" }}
                onFocus={e => e.target.style.borderColor = "#25D366"}
                onBlur={e => e.target.style.borderColor = T.border2}
              />
            </div>
          ))}

          <button onClick={saveConfig} disabled={saving}
            style={{ padding: "8px 0", background: "#25D366", border: "none", borderRadius: 3, color: "#fff", fontSize: 12, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <FaWhatsapp style={{ fontSize: 13 }} />
            {saving ? "Saving..." : "Save WhatsApp Configuration"}
          </button>

          {saveMsg && (
            <div style={{ padding: "8px 12px", background: saveMsg.startsWith("❌") ? "rgba(242,73,92,0.1)" : "rgba(37,211,102,0.1)", border: `1px solid ${saveMsg.startsWith("❌") ? "rgba(242,73,92,0.3)" : "rgba(37,211,102,0.3)"}`, borderRadius: 3, fontSize: 11, color: saveMsg.startsWith("❌") ? "#f2495c" : "#25D366", lineHeight: 1.5 }}>
              {saveMsg}
            </div>
          )}

          <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 12 }}>
            <div style={{ fontSize: 11, color: T.muted, marginBottom: 8 }}>Send a test message</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="text"
                value={testNumber}
                onChange={e => setTestNumber(e.target.value)}
                placeholder="+1234567890"
                style={{ flex: 1, background: T.inputBg, border: `1px solid ${T.border2}`, borderRadius: 3, color: T.text, fontSize: 12, padding: "6px 10px", outline: "none" }}
              />
              <button onClick={sendTest} disabled={testing}
                style={{ padding: "6px 14px", background: "rgba(37,211,102,0.1)", border: "1px solid rgba(37,211,102,0.3)", borderRadius: 3, color: "#25D366", fontSize: 11, fontWeight: 600, cursor: testing ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}>
                {testing ? "Sending..." : "📱 Send Test"}
              </button>
            </div>
            {testResult && (
              <div style={{ marginTop: 8, fontSize: 11, color: testResult.success ? "#25D366" : "#f2495c" }}>
                {testResult.msg}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const SEVERITY_CONFIG = {
  critical: { color: "#f2495c", bg: "rgba(242,73,92,0.1)", border: "rgba(242,73,92,0.3)", icon: FaExclamationCircle, label: "CRITICAL" },
  warning:  { color: "#f5a623", bg: "rgba(245,166,35,0.1)",  border: "rgba(245,166,35,0.3)",  icon: FaExclamationTriangle, label: "WARNING" },
  info:     { color: "#5794f2", bg: "rgba(87,148,242,0.1)",  border: "rgba(87,148,242,0.3)",  icon: FaInfoCircle, label: "INFO" },
  ok:       { color: "#73bf69", bg: "rgba(115,191,105,0.1)", border: "rgba(115,191,105,0.3)", icon: FaCheckCircle, label: "OK" },
};

function AlertCard({ alert }) {
  const { T } = useTheme();
  const s = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.info;
  const Icon = s.icon;
  return (
    <div className="animate-fadeIn" style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 4, padding: "12px 14px", display: "flex", gap: 12, alignItems: "flex-start" }}>
      <Icon style={{ color: s.color, fontSize: 16, marginTop: 2, flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: s.color, background: `${s.color}20`, padding: "1px 7px", borderRadius: 3 }}>{s.label}</span>
          <span style={{ fontSize: 10, color: T.dim, background: T.panel, padding: "1px 6px", borderRadius: 3, border: `1px solid ${T.border}` }}>{alert.category}</span>
          <span style={{ fontSize: 10, color: T.dim, marginLeft: "auto" }}>
            {alert.time instanceof Date ? alert.time.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : alert.time}
          </span>
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 3 }}>{alert.title}</div>
        <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.5 }}>{alert.message}</div>
      </div>
    </div>
  );
}

function SpikeAlertFeed({ overview, activeConnections, mysqlApiError }) {
  const { T } = useTheme();
  const [spikeData, setSpikeData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastCheck, setLastCheck] = useState(null);

  const check = useCallback(() => {
    setLoading(true);
    axios.get(API_ENDPOINTS.spikeDetector)
      .then(r => { setSpikeData(r.data); setLastCheck(new Date()); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { check(); const t = setInterval(check, 60 * 1000); return () => clearInterval(t); }, [check]);

  // Combine static alerts + spike alerts
  const staticAlerts = generateAlerts(overview, activeConnections, mysqlApiError);
  const spikeAlerts = (spikeData?.spikes || []).map(s => ({
    id: `spike-${s.type}`,
    severity: s.severity,
    title: s.title,
    message: s.message,
    time: new Date(),
    category: s.type === "ERROR_SPIKE" ? "API" : s.type === "TRAFFIC_DROP" ? "Traffic" : "Performance",
  }));

  const allAlerts = [...spikeAlerts, ...staticAlerts.filter(a => a.severity !== "ok")];

  const critCount = allAlerts.filter(a => a.severity === "critical").length;
  const warnCount = allAlerts.filter(a => a.severity === "warning").length;

  return (
    <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 4, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px", borderBottom: `1px solid ${T.border}`, background: T.surface, minHeight: 36 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 3, height: 16, borderRadius: 2, background: critCount > 0 ? "#f2495c" : warnCount > 0 ? "#f5a623" : "#73bf69", flexShrink: 0 }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: T.text }}>Active Alerts</span>
          {critCount > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: "#f2495c", background: "rgba(242,73,92,0.15)", padding: "1px 7px", borderRadius: 3 }}>{critCount} CRITICAL</span>}
          {warnCount > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: "#f5a623", background: "rgba(245,166,35,0.15)", padding: "1px 7px", borderRadius: 3 }}>{warnCount} WARNING</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {lastCheck && <span style={{ fontSize: 10, color: T.dim, display: "flex", alignItems: "center", gap: 4 }}><FaHistory style={{ fontSize: 9 }} />Checked {lastCheck.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>}
          <button onClick={check} style={{ background: "none", border: `1px solid ${T.border2}`, borderRadius: 3, color: T.muted, cursor: "pointer", padding: "3px 8px", fontSize: 10, display: "flex", alignItems: "center", gap: 4 }}>
            <FaSync style={{ fontSize: 9, animation: loading ? "spin 1s linear infinite" : "none" }} />Refresh
          </button>
        </div>
      </div>
      <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
        {allAlerts.length === 0 ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: "rgba(115,191,105,0.08)", border: "1px solid rgba(115,191,105,0.2)", borderRadius: 4 }}>
            <FaCheckCircle style={{ color: "#73bf69", fontSize: 18 }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#73bf69" }}>All Systems Operational</div>
              <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>No active alerts. All metrics within normal thresholds.</div>
            </div>
          </div>
        ) : (
          allAlerts.map((alert, i) => <AlertCard key={alert.id || i} alert={alert} />)
        )}
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function AlertHistory() {
  const { T } = useTheme();
  const history = [
    { time: "10 min ago", severity: "warning", title: "Error Rate Elevated", message: "Error rate was 6.2% for 3 minutes", resolved: true },
    { time: "25 min ago", severity: "info", title: "Traffic Spike", message: "Request volume increased 40% above baseline", resolved: true },
    { time: "1h ago", severity: "critical", title: "Response Time Spike", message: "Avg response time exceeded 800ms for 5 minutes", resolved: true },
    { time: "2h ago", severity: "warning", title: "MySQL Connection Warning", message: "Active connections reached 85% of threshold", resolved: true },
  ];

  return (
    <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 4, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderBottom: `1px solid ${T.border}`, background: T.surface, minHeight: 36 }}>
        <span style={{ width: 3, height: 16, borderRadius: 2, background: T.muted, flexShrink: 0 }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: T.text }}>Alert History</span>
        <span style={{ fontSize: 10, color: T.muted, background: T.border, padding: "1px 7px", borderRadius: 3, border: `1px solid ${T.border2}` }}>Last 2 hours</span>
      </div>
      <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
        {history.map((h, i) => {
          const s = SEVERITY_CONFIG[h.severity];
          const Icon = s.icon;
          return (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 10px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 3, opacity: 0.8 }}>
              <Icon style={{ color: s.color, fontSize: 13, marginTop: 2, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: T.text }}>{h.title}</span>
                  <span style={{ marginLeft: "auto", fontSize: 10, color: T.dim }}>{h.time}</span>
                  {h.resolved && <span style={{ fontSize: 9, color: "#73bf69", background: "rgba(115,191,105,0.1)", padding: "1px 5px", borderRadius: 3 }}>RESOLVED</span>}
                </div>
                <div style={{ fontSize: 11, color: T.muted }}>{h.message}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TelegramConfigPanel() {
  const { T } = useTheme();
  const [status, setStatus]       = useState(null);
  const [config, setConfig]       = useState({ botToken: "", chatId: "", minSeverity: "critical", enabled: true });
  const [showConfig, setShowConfig] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [schedulerStatus, setSchedulerStatus] = useState(null);

  useEffect(() => {
    axios.get(API_ENDPOINTS.telegramConfig)
      .then(r => { setStatus(r.data); if (r.data.chatId) setConfig(c => ({ ...c, chatId: r.data.chatId, minSeverity: r.data.minSeverity || "critical", enabled: r.data.enabled !== false })); })
      .catch(() => {});
    
    // Fetch scheduler status
    axios.get(API_ENDPOINTS.mlSchedulerStatus)
      .then(r => setSchedulerStatus(r.data))
      .catch(() => {});
  }, []);

  const saveConfig = async () => {
    setSaving(true);
    try {
      const { data } = await axios.post(API_ENDPOINTS.telegramConfig, config);
      setStatus(prev => ({ ...prev, configured: data.configured }));
      setTestResult({ success: true, msg: "✅ Configuration saved" });
    } catch (err) {
      setTestResult({ success: false, msg: "❌ " + (err.response?.data?.error || err.message) });
    } finally { setSaving(false); }
  };

  const sendTest = async () => {
    setTestResult(null);
    try {
      const { data } = await axios.post(API_ENDPOINTS.telegramTest);
      setTestResult({ success: true, msg: data.message });
    } catch (err) {
      setTestResult({ success: false, msg: "❌ " + (err.response?.data?.error || err.message) });
    }
  };

  return (
    <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 4, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px", borderBottom: `1px solid ${T.border}`, background: T.surface, minHeight: 36 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <FaTelegram style={{ color: "#2AABEE", fontSize: 16 }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: T.text }}>Telegram Alerts</span>
          {status && (
            <span style={{ fontSize: 10, padding: "1px 8px", borderRadius: 3, fontWeight: 700, background: status.configured ? "rgba(42,171,238,0.15)" : "rgba(107,114,128,0.15)", color: status.configured ? "#2AABEE" : T.muted }}>
              {status.configured ? "✓ CONNECTED" : "NOT CONFIGURED"}
            </span>
          )}
          <span style={{ fontSize: 10, color: T.dim, background: T.border, padding: "1px 7px", borderRadius: 3 }}>
            Sends rich alerts for 100% confidence critical APIs
          </span>
        </div>
        <button onClick={() => setShowConfig(v => !v)}
          style={{ padding: "4px 10px", background: "transparent", border: `1px solid ${T.border2}`, borderRadius: 3, color: T.muted, fontSize: 11, cursor: "pointer" }}>
          {showConfig ? "Hide" : "Configure"}
        </button>
      </div>

      {status?.configured && !showConfig && (
        <div style={{ padding: "8px 14px", display: "flex", alignItems: "center", gap: 12, fontSize: 11 }}>
          <span style={{ color: T.muted }}>Chat ID: <span style={{ color: "#2AABEE" }}>{status.chatId}</span></span>
          <span style={{ color: T.muted }}>Min severity: <span style={{ color: "#f5a623" }}>{status.minSeverity?.toUpperCase()}</span></span>
          <span style={{ color: T.muted }}>Status: <span style={{ color: status.enabled ? "#73bf69" : "#f2495c" }}>{status.enabled ? "ENABLED" : "DISABLED"}</span></span>
          {schedulerStatus && (
            <>
              <div style={{ width: 1, height: 14, background: T.border2, margin: "0 4px" }} />
              <span style={{ color: T.muted }}>🤖 ML Scheduler: <span style={{ color: schedulerStatus.running ? "#73bf69" : "#f2495c", fontWeight: 700 }}>{schedulerStatus.running ? "RUNNING" : "STOPPED"}</span></span>
              {schedulerStatus.running && <span style={{ color: T.dim }}>({schedulerStatus.intervalMinutes} min cycle · ≥{schedulerStatus.minConfidence}% conf)</span>}
            </>
          )}
        </div>
      )}

      {showConfig && (
        <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ padding: "10px 12px", background: "rgba(42,171,238,0.06)", border: "1px solid rgba(42,171,238,0.2)", borderRadius: 3, fontSize: 11, color: T.muted }}>
            <div style={{ fontWeight: 700, color: "#2AABEE", marginBottom: 4 }}>📱 Setup Guide</div>
            <div>1. Open Telegram → search <span style={{ color: "#2AABEE" }}>@BotFather</span> → /newbot → copy the token</div>
            <div>2. Add your bot to a channel/group, or start a chat with it</div>
            <div>3. Get your Chat ID: message <span style={{ color: "#2AABEE" }}>@userinfobot</span> or use the API</div>
            <div>4. Paste token + chat ID below and click Save</div>
          </div>

          {[
            { label: "Bot Token", key: "botToken", placeholder: "1234567890:AAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", type: "password" },
            { label: "Chat ID", key: "chatId", placeholder: "-1001234567890 (group) or 123456789 (user)" },
          ].map(({ label, key, placeholder, type }) => (
            <div key={key}>
              <label style={{ fontSize: 11, color: T.muted, display: "block", marginBottom: 5 }}>{label}</label>
              <input type={type || "text"} value={config[key]} onChange={e => setConfig(c => ({ ...c, [key]: e.target.value }))}
                placeholder={placeholder}
                style={{ width: "100%", background: T.inputBg, border: `1px solid ${T.border2}`, borderRadius: 3, color: T.text, fontSize: 12, padding: "7px 10px", outline: "none", boxSizing: "border-box" }}
                onFocus={e => e.target.style.borderColor = "#2AABEE"}
                onBlur={e => e.target.style.borderColor = T.border2} />
            </div>
          ))}

          <div>
            <label style={{ fontSize: 11, color: T.muted, display: "block", marginBottom: 5 }}>Minimum Alert Severity</label>
            <div style={{ display: "flex", gap: 6 }}>
              {["critical", "warning"].map(sev => (
                <button key={sev} onClick={() => setConfig(c => ({ ...c, minSeverity: sev }))}
                  style={{ padding: "5px 14px", background: config.minSeverity === sev ? "rgba(42,171,238,0.15)" : "transparent", border: `1px solid ${config.minSeverity === sev ? "rgba(42,171,238,0.4)" : T.border2}`, borderRadius: 3, color: config.minSeverity === sev ? "#2AABEE" : T.muted, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                  {sev.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={saveConfig} disabled={saving}
              style={{ flex: 1, padding: "8px 0", background: "#2AABEE", border: "none", borderRadius: 3, color: "#fff", fontSize: 12, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <FaTelegram style={{ fontSize: 13 }} />
              {saving ? "Saving..." : "Save Telegram Configuration"}
            </button>
            <button onClick={sendTest}
              style={{ padding: "8px 16px", background: "rgba(42,171,238,0.1)", border: "1px solid rgba(42,171,238,0.3)", borderRadius: 3, color: "#2AABEE", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              Test
            </button>
          </div>

          {testResult && (
            <div style={{ padding: "8px 12px", background: testResult.success ? "rgba(115,191,105,0.1)" : "rgba(242,73,92,0.1)", border: `1px solid ${testResult.success ? "rgba(115,191,105,0.3)" : "rgba(242,73,92,0.3)"}`, borderRadius: 3, fontSize: 12, color: testResult.success ? "#73bf69" : "#f2495c" }}>
              {testResult.msg}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AlertsTab({ overview, activeConnections, mysqlApiError, range, startDate, endDate }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* ── WhatsApp Configuration ── */}
      <WhatsAppConfigPanel />

      {/* ── Telegram Configuration ── */}
      <TelegramConfigPanel />

      {/* ── Active Alerts ── */}
      <SpikeAlertFeed overview={overview} activeConnections={activeConnections} mysqlApiError={mysqlApiError} />

      {/* ── Alert History ── */}
      <AlertHistory />

      {/* ── Full Outage Detection Zone ── */}
      <OutageDetectionPanel range={range} startDate={startDate} endDate={endDate} />
    </div>
  );
}
