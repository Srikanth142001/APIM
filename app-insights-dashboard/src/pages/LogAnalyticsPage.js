import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { useTheme } from "../context/ThemeContext";
import {
  FaClipboardList, FaPlay, FaChevronRight, FaDownload,
  FaDatabase, FaCog,
} from "react-icons/fa";

// ── Preset queries ────────────────────────────────────────────────────────────
const APP_INSIGHTS_PRESETS = [
  { category: "Requests", items: [
    { label: "Top failing operations",     kql: "requests\n| where timestamp > ago(1h)\n| where success == false\n| summarize failures=count() by operation_Name, resultCode\n| order by failures desc\n| take 20" },
    { label: "Response time by operation", kql: "requests\n| where timestamp > ago(1h)\n| summarize avg_ms=round(avg(duration),1), p95=round(percentile(duration,95),1), count=count() by operation_Name\n| order by avg_ms desc\n| take 20" },
    { label: "Request volume (6h)",        kql: "requests\n| where timestamp > ago(6h)\n| summarize count() by bin(timestamp, 15m)\n| order by timestamp asc" },
  ]},
  { category: "Exceptions", items: [
    { label: "Top exceptions (1h)",        kql: "exceptions\n| where timestamp > ago(1h)\n| summarize count() by type, outerMessage\n| order by count_ desc\n| take 20" },
    { label: "Exception timeline",         kql: "exceptions\n| where timestamp > ago(6h)\n| summarize count() by bin(timestamp, 15m)\n| order by timestamp asc" },
  ]},
  { category: "Dependencies", items: [
    { label: "Slow dependencies",          kql: "dependencies\n| where timestamp > ago(1h)\n| where duration > 500\n| summarize count(), avg_ms=round(avg(duration),1) by name, type\n| order by count_ desc\n| take 20" },
    { label: "Dependency failures",        kql: "dependencies\n| where timestamp > ago(1h)\n| where success == false\n| summarize count() by name, target, type\n| order by count_ desc" },
  ]},
];

const LOG_ANALYTICS_PRESETS = [
  { category: "Kubernetes / AKS", items: [
    { label: "Pod status summary",        kql: "KubePodInventory\n| where TimeGenerated > ago(1h)\n| summarize arg_max(TimeGenerated, *) by Name\n| summarize count() by PodStatus\n| order by count_ desc" },
    { label: "Pod restarts",              kql: "KubePodInventory\n| where TimeGenerated > ago(1h)\n| summarize arg_max(TimeGenerated, *) by Name\n| where PodRestartCount > 0\n| project Name, Namespace, PodStatus, PodRestartCount, ClusterName\n| order by PodRestartCount desc\n| take 30" },
    { label: "Node CPU usage",            kql: "Perf\n| where TimeGenerated > ago(1h)\n| where ObjectName == \"K8SNode\" and CounterName == \"cpuUsageNanoCores\"\n| summarize avg_cpu=avg(CounterValue/1000000) by Computer, bin(TimeGenerated, 5m)\n| order by TimeGenerated desc" },
    { label: "Kubernetes warning events", kql: "KubeEvents\n| where TimeGenerated > ago(1h)\n| where Level == \"Warning\"\n| project TimeGenerated, Name, Namespace, Reason, Message\n| order by TimeGenerated desc\n| take 50" },
  ]},
  { category: "Container Logs", items: [
    { label: "Container errors (1h)",     kql: "ContainerLog\n| where TimeGenerated > ago(1h)\n| where LogEntry has_any (\"error\", \"ERROR\", \"FATAL\", \"exception\")\n| project TimeGenerated, ContainerName, LogEntry\n| order by TimeGenerated desc\n| take 50" },
    { label: "Log volume by container",   kql: "ContainerLog\n| where TimeGenerated > ago(6h)\n| summarize count() by ContainerName, bin(TimeGenerated, 30m)\n| order by count_ desc" },
  ]},
  { category: "Performance", items: [
    { label: "CPU by computer",           kql: "Perf\n| where TimeGenerated > ago(1h)\n| where CounterName == \"% Processor Time\" and InstanceName == \"_Total\"\n| summarize avg_cpu=round(avg(CounterValue),1) by Computer, bin(TimeGenerated, 5m)\n| order by TimeGenerated desc" },
    { label: "Memory available",          kql: "Perf\n| where TimeGenerated > ago(1h)\n| where CounterName == \"Available MBytes\"\n| summarize avg_mem=round(avg(CounterValue),0) by Computer, bin(TimeGenerated, 5m)\n| order by TimeGenerated desc" },
  ]},
  { category: "Azure Diagnostics", items: [
    { label: "Resource operations",       kql: "AzureDiagnostics\n| where TimeGenerated > ago(1h)\n| summarize count() by ResourceType, OperationName, ResultType\n| order by count_ desc\n| take 30" },
    { label: "Failed operations",         kql: "AzureDiagnostics\n| where TimeGenerated > ago(1h)\n| where ResultType != \"Success\"\n| project TimeGenerated, ResourceType, OperationName, ResultType, ResultDescription\n| order by TimeGenerated desc\n| take 30" },
  ]},
];

// ── Main component ────────────────────────────────────────────────────────────
export default function LogAnalyticsPage() {
  const { T } = useTheme();
  const role    = localStorage.getItem("auth_role") || "viewer";
  const isAdmin = role === "admin";
  const token   = localStorage.getItem("auth_token");

  const [pageTab, setPageTab]           = useState("query");
  const [datasource, setDatasource]     = useState("appinsights");
  const [query, setQuery]               = useState(APP_INSIGHTS_PRESETS[0].items[0].kql);
  const [activePreset, setActivePreset] = useState("Requests:0");
  const [result, setResult]             = useState(null);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState(null);
  const [status, setStatus]             = useState(null);

  const presets = datasource === "appinsights" ? APP_INSIGHTS_PRESETS : LOG_ANALYTICS_PRESETS;

  const fetchStatus = useCallback(() => {
    axios.get("/api/log-analytics/status", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => setStatus(r.data)).catch(() => {});
  }, [token]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const switchDatasource = (ds) => {
    setDatasource(ds); setResult(null); setError(null);
    const p = ds === "appinsights" ? APP_INSIGHTS_PRESETS : LOG_ANALYTICS_PRESETS;
    setQuery(p[0].items[0].kql);
    setActivePreset(`${p[0].category}:0`);
  };

  const runQuery = async () => {
    if (!query.trim()) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const ep = datasource === "appinsights" ? "/api/kql/query" : "/api/log-analytics/query";
      const { data } = await axios.post(ep, { query, timespan: "PT1H" }, { headers: { Authorization: `Bearer ${token}` } });
      if (data.success) setResult(data); else setError(data.message);
    } catch (e) { setError(e.response?.data?.message || e.message); }
    finally { setLoading(false); }
  };

  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); runQuery(); }
  };

  const downloadCsv = () => {
    const t = result?.tables?.[0]; if (!t) return;
    const header = t.columns.map(c => c.name).join(",");
    const rows   = t.rows.map(r => r.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","));
    const blob   = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "log_analytics.csv" });
    a.click(); URL.revokeObjectURL(a.href);
  };

  const table = result?.tables?.[0];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: T.bg, color: T.text, fontSize: 13 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px", borderBottom: `1px solid ${T.border}`, background: T.cardBg, flexShrink: 0, gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <FaClipboardList style={{ color: T.blue, fontSize: 16 }} />
          <span style={{ fontWeight: 700, fontSize: 14 }}>Log Analytics</span>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {["query", ...(isAdmin ? ["config"] : [])].map(tab => (
            <button key={tab} onClick={() => setPageTab(tab)} style={{ padding: "5px 14px", fontSize: 12, borderRadius: 4, cursor: "pointer", border: "none", background: pageTab === tab ? T.blue : "transparent", color: pageTab === tab ? "#fff" : T.muted, fontWeight: pageTab === tab ? 600 : 400 }}>
              {tab === "query" ? "Query" : <span style={{ display: "flex", alignItems: "center", gap: 4 }}><FaCog style={{ fontSize: 11 }} />Config</span>}
            </button>
          ))}
        </div>
        {pageTab === "query" && (
          <div style={{ display: "flex", gap: 6 }}>
            {table && <button onClick={downloadCsv} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 11px", fontSize: 12, cursor: "pointer", border: `1px solid ${T.border}`, borderRadius: 4, background: "transparent", color: T.muted }}><FaDownload style={{ fontSize: 10 }} /> CSV</button>}
            <button onClick={runQuery} disabled={loading} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 14px", fontSize: 12, fontWeight: 600, border: "none", borderRadius: 4, cursor: loading ? "not-allowed" : "pointer", background: loading ? T.dim : T.blue, color: "#fff", opacity: loading ? 0.7 : 1 }}>
              <FaPlay style={{ fontSize: 10 }} />{loading ? "Running..." : "Run"}<span style={{ fontSize: 10, opacity: 0.6, fontWeight: 400 }}>Ctrl+↵</span>
            </button>
          </div>
        )}
      </div>

      {/* ── QUERY TAB ─────────────────────────────────────────────────────────── */}
      {pageTab === "query" && (
        <>
          <div style={{ padding: "6px 16px", borderBottom: `1px solid ${T.border}`, background: T.cardBg, display: "flex", gap: 8, flexShrink: 0 }}>
            {[{ key: "appinsights", label: "App Insights" }, { key: "workspace", label: "Log Analytics Workspace" }].map(({ key, label }) => (
              <button key={key} onClick={() => switchDatasource(key)} style={{ padding: "4px 12px", fontSize: 12, borderRadius: 4, cursor: "pointer", border: `1px solid ${datasource === key ? T.blue : T.border}`, background: datasource === key ? `${T.blue}18` : "transparent", color: datasource === key ? T.blue : T.muted, fontWeight: datasource === key ? 600 : 400 }}>
                {label}{key === "workspace" && status && !status.workspaceConfigured && <span style={{ marginLeft: 5, color: "#ff9800" }}>⚠</span>}
              </button>
            ))}
          </div>
          {datasource === "workspace" && status && (!status.workspaceConfigured || !status.spConfigured) && (
            <div style={{ padding: "7px 16px", background: "rgba(255,152,0,0.09)", borderBottom: `1px solid rgba(255,152,0,0.25)`, fontSize: 12, color: "#ff9800" }}>
              ⚠ Workspace not fully configured. {isAdmin && <span style={{ cursor: "pointer", textDecoration: "underline" }} onClick={() => setPageTab("config")}>Go to Config →</span>}
            </div>
          )}
          <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>
            <div style={{ width: 215, flexShrink: 0, borderRight: `1px solid ${T.border}`, background: T.cardBg, overflowY: "auto", padding: "8px 0" }}>
              <div style={{ padding: "6px 12px 4px", fontSize: 10, fontWeight: 700, color: T.dim, letterSpacing: "0.08em", display: "flex", alignItems: "center", gap: 5 }}><FaDatabase style={{ fontSize: 9 }} />{datasource === "appinsights" ? "APP INSIGHTS" : "LOG ANALYTICS"}</div>
              {presets.map(group => (
                <div key={group.category}>
                  <div style={{ padding: "9px 12px 3px", fontSize: 10, fontWeight: 700, color: T.dim, letterSpacing: "0.06em" }}>{group.category.toUpperCase()}</div>
                  {group.items.map((item, i) => {
                    const k = `${group.category}:${i}`; const active = activePreset === k;
                    return (
                      <button key={k} onClick={() => { setQuery(item.kql); setActivePreset(k); }} style={{ width: "100%", textAlign: "left", padding: "6px 12px", background: active ? `${T.blue}18` : "transparent", border: "none", borderLeft: active ? `2px solid ${T.blue}` : "2px solid transparent", color: active ? T.blue : T.muted, cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
                        <FaChevronRight style={{ fontSize: 9, opacity: active ? 1 : 0.3 }} />{item.label}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <textarea value={query} onChange={e => setQuery(e.target.value)} onKeyDown={handleKeyDown} spellCheck={false} rows={6}
                style={{ flexShrink: 0, resize: "vertical", border: "none", borderBottom: `1px solid ${T.border}`, outline: "none", background: T.bg, color: T.text, fontFamily: "'Cascadia Code','Fira Code','Courier New',monospace", fontSize: 12.5, lineHeight: 1.6, padding: "12px 16px", boxSizing: "border-box", width: "100%" }}
                placeholder="// KQL — Ctrl+Enter to run" />
              <div style={{ flex: 1, overflow: "auto" }}>
                {loading && <div style={{ padding: 20, color: T.muted }}>⏳ Running query...</div>}
                {error   && <div style={{ padding: "10px 16px", color: "#f2495c", background: "rgba(242,73,92,0.08)", fontSize: 12 }}><strong>Error:</strong> {error}</div>}
                {table && !loading && (
                  <>
                    <div style={{ padding: "5px 14px", borderBottom: `1px solid ${T.border}`, background: T.cardBg, fontSize: 11, color: T.muted, display: "flex", gap: 14 }}>
                      <span style={{ color: T.green, fontWeight: 600 }}>✓ Success</span>
                      <span>{table.rowCount} rows</span>
                      <span>{result.executionTime}ms</span>
                    </div>
                    <div style={{ overflow: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                        <thead><tr>{table.columns.map(col => (
                          <th key={col.name} style={{ padding: "6px 12px", textAlign: "left", fontWeight: 600, background: T.cardBg, color: T.muted, borderBottom: `2px solid ${T.border}`, whiteSpace: "nowrap", position: "sticky", top: 0 }}>
                            {col.name}<span style={{ fontSize: 10, fontWeight: 400, opacity: 0.5, marginLeft: 4 }}>{col.type}</span>
                          </th>
                        ))}</tr></thead>
                        <tbody>{table.rows.map((row, ri) => (
                          <tr key={ri} style={{ background: ri % 2 === 0 ? "transparent" : `${T.border}44` }}>
                            {row.map((cell, ci) => (
                              <td key={ci} style={{ padding: "5px 12px", borderBottom: `1px solid ${T.border}44`, color: T.text, whiteSpace: "nowrap", maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis" }}>
                                {cell === null ? <span style={{ color: T.dim }}>null</span> : String(cell)}
                              </td>
                            ))}
                          </tr>
                        ))}</tbody>
                      </table>
                    </div>
                  </>
                )}
                {!loading && !error && !result && (
                  <div style={{ padding: 20, color: T.dim, fontSize: 12 }}>
                    Pick a preset or write KQL. Press <kbd style={{ background: T.border, padding: "2px 5px", borderRadius: 3 }}>Ctrl+Enter</kbd> to run.
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── CONFIG TAB ────────────────────────────────────────────────────────── */}
      {pageTab === "config" && isAdmin && (
        <AzureConfigPanel T={T} token={token} onStatusChange={fetchStatus} status={status} />
      )}
    </div>
  );
}

// ── Azure Config Panel — fully interactive wizard ────────────────────────────
function AzureConfigPanel({ T, token, onStatusChange, status }) {
  const [step, setStep]                   = useState("idle"); // idle | waiting-code | logged-in | done
  const [deviceUrl, setDeviceUrl]         = useState("");
  const [deviceCode, setDeviceCode]       = useState("");
  const [loginMsg, setLoginMsg]           = useState("");
  const [loginPollTimer, setLoginPollTimer] = useState(null);
  const [loggedInAs, setLoggedInAs]       = useState(null);
  const [subscriptions, setSubscriptions] = useState([]);
  const [selectedSub, setSelectedSub]     = useState("");
  const [workspaceId, setWorkspaceId]     = useState(status?.workspaceId || "");
  const [busy, setBusy]                   = useState(false);
  const [msg, setMsg]                     = useState({ type: "", text: "" });
  const [grafanaProvisioned, setGrafanaProvisioned] = useState(false);
  const [tokenStatus, setTokenStatus]     = useState(null);

  // Check login state on mount
  useEffect(() => {
    checkLogin();
    return () => { if (loginPollTimer) clearInterval(loginPollTimer); };
  }, []); // eslint-disable-line

  const info  = (text) => setMsg({ type: "info", text });
  const ok    = (text) => setMsg({ type: "ok",   text });
  const err   = (text) => setMsg({ type: "err",  text });

  const checkLogin = async () => {
    try {
      const { data } = await axios.get("/api/log-analytics/az-login-status", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (data.loggedIn) {
        setLoggedInAs(data.account);
        setStep("logged-in");
        loadSubscriptions();
        loadTokenStatus();
      }
    } catch {}
  };

  const loadSubscriptions = async () => {
    try {
      const { data } = await axios.get("/api/log-analytics/subscriptions", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (data.success && data.subscriptions?.length) {
        setSubscriptions(data.subscriptions);
        const def = data.subscriptions.find(s => s.isDefault);
        if (def) setSelectedSub(def.id);
      }
    } catch {}
  };

  const loadTokenStatus = async () => {
    try {
      const { data } = await axios.get("/api/log-analytics/status", {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTokenStatus(data);
      if (data.workspaceId) setWorkspaceId(data.workspaceId);
    } catch {}
  };

  // ── Step 1: Start az login ────────────────────────────────────────────────
  const startLogin = async () => {
    if (busy) return;
    setBusy(true);
    setDeviceUrl(""); setDeviceCode(""); setLoginMsg("");
    info("Requesting device login code from Azure...");
    try {
      const { data } = await axios.post(
        "/api/log-analytics/az-run",
        { cmd: "login" },
        { headers: { Authorization: `Bearer ${token}` }, timeout: 60000 }
      );

      if (data.pending && data.deviceUrl) {
        setDeviceUrl(data.deviceUrl);
        setDeviceCode(data.deviceCode || "");
        setStep("waiting-code");
        info("Waiting for browser authentication...");

        // Poll login status every 5s
        const timer = setInterval(async () => {
          try {
            const { data: st } = await axios.get("/api/log-analytics/az-login-status", {
              headers: { Authorization: `Bearer ${token}` }
            });
            if (st.loggedIn) {
              clearInterval(timer);
              setLoginPollTimer(null);
              setLoggedInAs(st.account);
              setStep("logged-in");
              ok(`✓ Signed in as: ${st.account?.user || "Azure user"}`);
              loadSubscriptions();
              loadTokenStatus();
              onStatusChange();
            }
          } catch {}
        }, 5000);
        setLoginPollTimer(timer);

      } else if (!data.success) {
        err(data.output || "Login failed. Please wait a few seconds and try again.");
        setStep("idle");
      }
    } catch (e) {
      err(e.response?.data?.message || e.message);
      setStep("idle");
    } finally {
      setBusy(false);
    }
  };

  // ── Logout ────────────────────────────────────────────────────────────────
  const doLogout = async () => {
    setBusy(true);
    try {
      await axios.post("/api/log-analytics/az-run", { cmd: "logout" }, { headers: { Authorization: `Bearer ${token}` } });
      setStep("idle"); setLoggedInAs(null); setSubscriptions([]);
      setSelectedSub(""); ok("Signed out.");
    } catch {}
    setBusy(false);
  };

  // ── Step 2: Set subscription ─────────────────────────────────────────────
  const setSubscription = async () => {
    if (!selectedSub || busy) return;
    setBusy(true);
    try {
      await axios.post(
        "/api/log-analytics/az-set-subscription",
        { subscriptionId: selectedSub },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      ok(`✓ Subscription set: ${subscriptions.find(s => s.id === selectedSub)?.name || selectedSub}`);
    } catch (e) {
      err(e.response?.data?.message || e.message);
    }
    setBusy(false);
  };

  // ── Step 3: Save workspace + refresh tokens ───────────────────────────────
  const saveAndRefresh = async () => {
    if (!workspaceId.trim() || busy) return;
    setBusy(true);
    info("Refreshing tokens...");
    try {
      const { data } = await axios.post(
        "/api/log-analytics/az-run",
        { cmd: "refresh-tokens" },
        { headers: { Authorization: `Bearer ${token}` }, timeout: 60000 }
      );
      if (data.exitCode === 0) {
        ok("✓ Tokens refreshed. Log Analytics queries are now active.");
        loadTokenStatus();
        onStatusChange();
      } else {
        err("Token refresh failed: " + (data.output || "unknown error"));
      }
    } catch (e) {
      err(e.message);
    }
    setBusy(false);
  };

  // ── Step 4: Provision Grafana datasource ─────────────────────────────────
  const provisionGrafana = async () => {
    if (busy) return;
    setBusy(true);
    info("Provisioning Azure Monitor datasource in Grafana...");
    try {
      const { data } = await axios.post(
        "/api/log-analytics/grafana-provision",
        { workspaceId: workspaceId.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (data.success) {
        setGrafanaProvisioned(true);
        ok(`✓ ${data.message}`);
      } else {
        err(data.message);
      }
    } catch (e) {
      err(e.response?.data?.message || e.message);
    }
    setBusy(false);
  };

  const msgColor = { ok: "#39d353", err: "#f2495c", info: "#7ec8e3" };

  const subName = subscriptions.find(s => s.id === selectedSub)?.name || "";

  return (
    <div style={{ flex: 1, overflow: "auto", padding: "20px 24px", maxWidth: 720 }}>

      {/* ── Global status message ── */}
      {msg.text && (
        <div style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 6, fontSize: 12,
          background: msg.type === "ok" ? "rgba(57,211,83,0.1)" : msg.type === "err" ? "rgba(242,73,92,0.1)" : "rgba(126,200,227,0.1)",
          border: `1px solid ${msg.type === "ok" ? "#39d35340" : msg.type === "err" ? "#f2495c40" : "#7ec8e340"}`,
          color: msgColor[msg.type] || T.text }}>
          {msg.text}
        </div>
      )}

      {/* ══ STEP 1: Azure Login ══ */}
      <WizardStep num={1} title="Connect Azure Account" done={step === "logged-in" || step === "done"} T={T}>
        {step === "idle" && (
          <div>
            <p style={{ fontSize: 12, color: T.muted, margin: "0 0 12px" }}>
              Click below to start a device-code login. A URL + code will appear — open the URL
              in your browser and paste the code to authenticate.
            </p>
            <WizardBtn T={T} color={T.blue} onClick={startLogin} busy={busy} label="Connect Azure Account" icon="🔑" />
          </div>
        )}

        {step === "waiting-code" && deviceUrl && (
          <div>
            <div style={{ marginBottom: 12, padding: "14px 16px", background: "#0d1117", borderRadius: 6, border: "1px solid #39d35360" }}>
              <div style={{ fontSize: 11, color: "#888", marginBottom: 6 }}>STEP 1 — Open this URL in your browser:</div>
              <a href={deviceUrl} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 13, fontWeight: 700, color: "#39d353", wordBreak: "break-all" }}>
                {deviceUrl}
              </a>
              {deviceCode && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>STEP 2 — Enter this code:</div>
                  <div style={{ display: "inline-block", padding: "6px 16px", background: "#1c2128", border: "2px solid #F46800",
                    borderRadius: 6, fontSize: 20, fontWeight: 800, letterSpacing: "0.25em", color: "#F46800", fontFamily: "monospace" }}>
                    {deviceCode}
                  </div>
                  <button onClick={() => navigator.clipboard?.writeText(deviceCode)}
                    style={{ marginLeft: 10, padding: "4px 10px", fontSize: 11, cursor: "pointer",
                      background: "transparent", border: `1px solid ${T.border}`, borderRadius: 4, color: T.muted }}>
                    Copy
                  </button>
                </div>
              )}
              <div style={{ marginTop: 10, fontSize: 12, color: "#ffb347" }}>
                ⏳ Waiting for you to authenticate in your browser...
              </div>
            </div>
          </div>
        )}

        {(step === "logged-in" || step === "done") && loggedInAs && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px",
            background: "rgba(57,211,83,0.08)", borderRadius: 6, border: "1px solid #39d35330" }}>
            <div>
              <div style={{ fontSize: 12, color: "#39d353", fontWeight: 700 }}>✓ Connected</div>
              <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{loggedInAs.user || loggedInAs.name}</div>
            </div>
            <button onClick={doLogout} disabled={busy}
              style={{ padding: "5px 12px", fontSize: 11, cursor: busy ? "not-allowed" : "pointer",
                background: "rgba(242,73,92,0.12)", border: "1px solid #f2495c50", borderRadius: 4, color: "#f2495c" }}>
              Sign Out
            </button>
          </div>
        )}
      </WizardStep>

      {/* ══ STEP 2: Select Subscription ══ */}
      {(step === "logged-in" || step === "done") && (
        <WizardStep num={2} title="Select Subscription" done={!!selectedSub} T={T}>
          {subscriptions.length === 0 ? (
            <WizardBtn T={T} color={T.blue} onClick={loadSubscriptions} busy={busy} label="Load Subscriptions" icon="🔄" />
          ) : (
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
              <select value={selectedSub} onChange={e => setSelectedSub(e.target.value)}
                style={{ flex: 1, minWidth: 200, padding: "8px 10px", fontSize: 12, background: T.bg, color: T.text,
                  border: `1px solid ${T.border}`, borderRadius: 4 }}>
                <option value="">— Select subscription —</option>
                {subscriptions.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name}{s.isDefault ? " ★ default" : ""}{s.state !== "Enabled" ? ` (${s.state})` : ""}
                  </option>
                ))}
              </select>
              <WizardBtn T={T} color="#39d353" onClick={setSubscription} busy={busy || !selectedSub}
                label="Set" icon="✓" small />
            </div>
          )}
          {selectedSub && subName && (
            <div style={{ marginTop: 8, fontSize: 11, color: T.muted }}>
              ID: <code style={{ background: T.border, padding: "1px 5px", borderRadius: 3 }}>{selectedSub}</code>
            </div>
          )}
        </WizardStep>
      )}

      {/* ══ STEP 3: Log Analytics Workspace ID ══ */}
      {(step === "logged-in" || step === "done") && (
        <WizardStep num={3} title="Log Analytics Workspace ID" done={!!tokenStatus?.workspaceConfigured} T={T}>
          <div style={{ fontSize: 11, color: T.muted, marginBottom: 8 }}>
            Azure Portal → Log Analytics workspaces → your workspace → Overview → <strong style={{ color: T.text }}>Workspace ID</strong>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input value={workspaceId} onChange={e => setWorkspaceId(e.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              style={{ flex: 1, padding: "8px 10px", fontSize: 12, background: T.bg, color: T.text,
                border: `1px solid ${T.border}`, borderRadius: 4 }} />
            <WizardBtn T={T} color={T.blue} onClick={saveAndRefresh} busy={busy || !workspaceId.trim()}
              label="Save & Refresh Tokens" icon="🔄" small />
          </div>
          {tokenStatus?.tokens?.logAnalytics?.status === "ok" && (
            <div style={{ marginTop: 8, fontSize: 11, color: "#39d353" }}>
              ✓ Tokens active — auto-refreshes every 50 min
            </div>
          )}
        </WizardStep>
      )}

      {/* ══ STEP 4: Provision Grafana Datasource ══ */}
      {(step === "logged-in" || step === "done") && (
        <WizardStep num={4} title="Add Azure Monitor to Grafana" done={grafanaProvisioned} T={T}>
          <p style={{ fontSize: 12, color: T.muted, margin: "0 0 12px" }}>
            Provisions an <strong style={{ color: T.text }}>Azure Monitor</strong> datasource in Grafana using your current login.
            This enables App Insights queries, Log Analytics queries, and metric alerts directly inside Grafana dashboards.
          </p>
          <div style={{ marginBottom: 12, padding: "10px 14px", background: T.bg,
            border: `1px solid ${T.border}`, borderRadius: 6, fontSize: 11, color: T.muted }}>
            <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: "4px 8px" }}>
              <span>Subscription:</span><span style={{ color: T.text }}>{subName || selectedSub || "—"}</span>
              <span>App Insights:</span><span style={{ color: T.text }}>{process.env.REACT_APP_APP_INSIGHTS_ID || "from env"}</span>
              <span>Workspace ID:</span><span style={{ color: T.text }}>{workspaceId || "—"}</span>
            </div>
          </div>
          <WizardBtn T={T} color="#F46800" onClick={provisionGrafana} busy={busy || !selectedSub}
            label={grafanaProvisioned ? "Re-provision Grafana" : "Provision Grafana Datasource"} icon="📊" />
          {grafanaProvisioned && (
            <div style={{ marginTop: 10, fontSize: 12, color: "#39d353" }}>
              ✓ Done! Go to <strong>Data Visualization → Data Sources</strong> to verify.
              Use the <strong>Azure Monitor</strong> datasource when creating dashboards and alerts.
            </div>
          )}
        </WizardStep>
      )}
    </div>
  );
}

// ── Wizard step card ───────────────────────────────────────────────────────────
function WizardStep({ num, title, done, T, children }) {
  return (
    <div style={{ marginBottom: 20, padding: "16px 18px", borderRadius: 8,
      border: `1px solid ${done ? "#39d35340" : T.border}`,
      background: done ? "rgba(57,211,83,0.04)" : T.cardBg }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div style={{ width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center",
          justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0,
          background: done ? "#39d353" : T.blue, color: "#fff" }}>
          {done ? "✓" : num}
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

// ── Wizard button ──────────────────────────────────────────────────────────────
function WizardBtn({ T, color, onClick, busy, label, icon, small }) {
  return (
    <button onClick={onClick} disabled={busy}
      style={{ display: "inline-flex", alignItems: "center", gap: 6,
        padding: small ? "6px 14px" : "9px 20px",
        fontSize: small ? 12 : 13, fontWeight: 600,
        border: "none", borderRadius: 5, cursor: busy ? "not-allowed" : "pointer",
        background: busy ? "#444" : color, color: "#fff", opacity: busy ? 0.7 : 1,
        transition: "opacity 0.15s" }}>
      {busy ? "⏳" : icon} {label}
    </button>
  );
}
