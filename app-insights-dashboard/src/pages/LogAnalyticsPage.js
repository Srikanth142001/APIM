import { useState, useRef, useEffect, useCallback } from "react";
import axios from "axios";
import { useTheme } from "../context/ThemeContext";
import {
  FaClipboardList, FaPlay, FaChevronRight, FaDownload,
  FaDatabase, FaCog, FaSync, FaCheckCircle, FaTimesCircle,
  FaTerminal, FaSignInAlt, FaSignOutAlt, FaList,
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

// ── Azure Config Panel with interactive terminal ───────────────────────────────
function AzureConfigPanel({ T, token, onStatusChange, status }) {
  const [termLines, setTermLines]           = useState([{ type: "info", text: "Azure CLI terminal ready. Use the buttons below to connect your Azure account." }]);
  const [running, setRunning]               = useState(false);
  const [azStatus, setAzStatus]             = useState(null);
  const [subscriptions, setSubscriptions]   = useState([]);
  const [selectedSub, setSelectedSub]       = useState("");
  const [workspaceId, setWorkspaceId]       = useState(status?.workspaceId || "");
  const [step, setStep]                     = useState("idle"); // idle | login-pending | logged-in | sub-selected | done
  const termRef = useRef(null);

  useEffect(() => {
    if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight;
  }, [termLines]);

  useEffect(() => {
    checkAzStatus();
  }, []);

  const addLine = (type, text) => {
    setTermLines(prev => [...prev, { type, text }]);
  };

  // ── Poll backend via axios POST (replaces unreliable SSE/EventSource) ────────
  const runStream = async (cmdKey, label) => {
    if (running) return;
    setRunning(true);
    addLine("cmd", `$ ${label}`);
    try {
      const { data } = await axios.post(
        "/api/log-analytics/az-run",
        { cmd: cmdKey },
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 120000,
        }
      );
      if (data.output) {
        data.output.split("\n").filter(Boolean).forEach(line =>
          addLine(data.exitCode === 0 ? "stdout" : "stderr", line)
        );
      }
      addLine("info", `Exited with code ${data.exitCode}`);
    } catch (e) {
      addLine("error", e.response?.data?.message || e.message);
    } finally {
      setRunning(false);
      checkAzStatus();
      onStatusChange();
    }
  };

  // ── Check az login status ────────────────────────────────────────────────────
  const checkAzStatus = async () => {
    try {
      const { data } = await axios.get("/api/log-analytics/az-login-status", { headers: { Authorization: `Bearer ${token}` } });
      setAzStatus(data);
      if (data.loggedIn) {
        setStep("logged-in");
        loadSubscriptions();
      }
    } catch {}
  };

  const loadSubscriptions = async () => {
    try {
      const { data } = await axios.get("/api/log-analytics/subscriptions", { headers: { Authorization: `Bearer ${token}` } });
      if (data.success) {
        setSubscriptions(data.subscriptions);
        const def = data.subscriptions.find(s => s.isDefault);
        if (def) setSelectedSub(def.id);
      }
    } catch {}
  };

  const selectSubscription = async () => {
    if (!selectedSub) return;
    try {
      await axios.post("/api/log-analytics/az-set-subscription", { subscriptionId: selectedSub }, { headers: { Authorization: `Bearer ${token}` } });
      addLine("ok", `✓ Subscription set to: ${selectedSub}`);
      setStep("sub-selected");
    } catch (e) {
      addLine("error", e.response?.data?.message || e.message);
    }
  };

  const saveWorkspace = async () => {
    if (!workspaceId.trim()) return;
    addLine("info", `Workspace ID saved: ${workspaceId.trim()}`);
    addLine("info", "Running token refresh...");
    runStream("refresh-tokens", "refresh-tokens.sh");
    setStep("done");
  };

  // Token color map
  const lineColor = { cmd: "#7ec8e3", stdout: T.text, stderr: "#ffb347", error: "#f2495c", ok: "#39d353", info: T.muted };

  return (
    <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column", minHeight: 0 }}>

      {/* Step wizard */}
      <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${T.border}`, background: T.cardBg, padding: "0 16px", flexShrink: 0 }}>
        {[
          { key: "login",     label: "1. Connect Azure", icon: <FaSignInAlt /> },
          { key: "sub",       label: "2. Select Subscription", icon: <FaList /> },
          { key: "workspace", label: "3. Set Workspace ID", icon: <FaDatabase /> },
          { key: "tokens",    label: "4. Refresh Tokens", icon: <FaSync /> },
        ].map(({ key, label, icon }) => (
          <div key={key} style={{ padding: "10px 16px", fontSize: 12, color: T.muted, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11 }}>{icon}</span>{label}
          </div>
        ))}
      </div>

      <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>

        {/* Left: action panel */}
        <div style={{ width: 280, flexShrink: 0, borderRight: `1px solid ${T.border}`, padding: "16px", overflowY: "auto", background: T.cardBg }}>

          {/* ── Step 1: Login ── */}
          <Section T={T} label="Step 1: Azure Login" icon={<FaSignInAlt />}>
            {azStatus?.loggedIn ? (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, color: T.green, fontSize: 12 }}>
                  <FaCheckCircle /> Logged in as<br />
                  <span style={{ color: T.text, fontWeight: 600 }}>{azStatus.account?.user}</span>
                </div>
                <div style={{ fontSize: 11, color: T.muted, marginBottom: 10 }}>
                  Session persists for ~30 days. Tokens auto-refresh every 50 min.
                </div>
                <ActionBtn T={T} color="#f2495c" onClick={() => runStream("logout", "az logout")} disabled={running} icon={<FaSignOutAlt />} label="Sign Out" />
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 11, color: T.muted, marginBottom: 10 }}>
                  Opens a device-code login. A URL and code will appear in the terminal →
                  open the URL in your browser and enter the code to authenticate.
                </div>
                <ActionBtn T={T} color={T.blue} onClick={() => runStream("login", "az login --use-device-code")} disabled={running} icon={<FaSignInAlt />} label="Connect Azure Account" />
              </div>
            )}
          </Section>

          {/* ── Step 2: Subscription ── */}
          {azStatus?.loggedIn && (
            <Section T={T} label="Step 2: Select Subscription" icon={<FaList />}>
              {subscriptions.length === 0 ? (
                <ActionBtn T={T} color={T.blue} onClick={() => { loadSubscriptions(); runStream("account-list", "az account list"); }} disabled={running} icon={<FaList />} label="Load Subscriptions" />
              ) : (
                <>
                  <select value={selectedSub} onChange={e => setSelectedSub(e.target.value)}
                    style={{ width: "100%", padding: "6px 8px", fontSize: 12, background: T.bg, color: T.text, border: `1px solid ${T.border}`, borderRadius: 4, marginBottom: 8 }}>
                    <option value="">-- Select subscription --</option>
                    {subscriptions.map(s => (
                      <option key={s.id} value={s.id}>{s.name}{s.isDefault ? " (default)" : ""}</option>
                    ))}
                  </select>
                  <ActionBtn T={T} color={T.blue} onClick={selectSubscription} disabled={!selectedSub || running} icon={<FaCheckCircle />} label="Set Subscription" />
                </>
              )}
            </Section>
          )}

          {/* ── Step 3: Workspace ID ── */}
          {(step === "sub-selected" || step === "done" || (azStatus?.loggedIn && status?.workspaceId)) && (
            <Section T={T} label="Step 3: Log Analytics Workspace ID" icon={<FaDatabase />}>
              <div style={{ fontSize: 11, color: T.muted, marginBottom: 6 }}>
                Azure Portal → Log Analytics workspaces → your workspace → Overview → Workspace ID
              </div>
              <input value={workspaceId} onChange={e => setWorkspaceId(e.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                style={{ width: "100%", padding: "6px 8px", fontSize: 12, background: T.bg, color: T.text, border: `1px solid ${T.border}`, borderRadius: 4, marginBottom: 8, boxSizing: "border-box" }} />
              <ActionBtn T={T} color="#39d353" onClick={saveWorkspace} disabled={!workspaceId.trim() || running} icon={<FaSync />} label="Save & Refresh Tokens" />
            </Section>
          )}

          {/* ── Step 4: Manual refresh ── */}
          {step === "done" && (
            <Section T={T} label="Step 4: Token Status" icon={<FaSync />}>
              <div style={{ fontSize: 11, color: T.green, marginBottom: 8 }}>
                ✓ Tokens are being refreshed automatically every 50 minutes.
              </div>
              <ActionBtn T={T} color={T.blue} onClick={() => runStream("refresh-tokens", "refresh-tokens.sh")} disabled={running} icon={<FaSync />} label="Refresh Tokens Now" />
            </Section>
          )}
        </div>

        {/* Right: terminal output */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ padding: "6px 14px", borderBottom: `1px solid ${T.border}`, background: "#0d1117", flexShrink: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <FaTerminal style={{ color: "#39d353", fontSize: 12 }} />
            <span style={{ fontSize: 11, color: "#888", fontFamily: "monospace" }}>Azure CLI Output</span>
            {running && <span style={{ fontSize: 10, color: "#ffb347", marginLeft: "auto" }}>● Running...</span>}
            <button onClick={() => setTermLines([])} style={{ marginLeft: running ? 8 : "auto", fontSize: 10, background: "transparent", border: "none", color: "#555", cursor: "pointer" }}>Clear</button>
          </div>
          <div ref={termRef} style={{ flex: 1, overflow: "auto", background: "#0d1117", padding: "12px 16px", fontFamily: "'Cascadia Code','Fira Code','Courier New',monospace", fontSize: 12, lineHeight: 1.7 }}>
            {termLines.map((line, i) => (
              <div key={i} style={{ color: lineColor[line.type] || "#ccc", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                {line.type === "cmd" ? <span style={{ opacity: 0.5 }}>$ </span> : ""}
                {line.text}
              </div>
            ))}
            {running && <div style={{ color: "#39d353" }}>▋</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ T, label, icon, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 10, paddingBottom: 6, borderBottom: `1px solid ${T.border}` }}>
        <span style={{ color: T.blue }}>{icon}</span>{label}
      </div>
      {children}
    </div>
  );
}

function ActionBtn({ T, color, onClick, disabled, icon, label }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", fontSize: 12, fontWeight: 600, border: "none", borderRadius: 4, cursor: disabled ? "not-allowed" : "pointer", background: disabled ? T.dim : color, color: "#fff", opacity: disabled ? 0.6 : 1, width: "100%", justifyContent: "center" }}>
      <span style={{ fontSize: 11 }}>{icon}</span>{label}
    </button>
  );
}
