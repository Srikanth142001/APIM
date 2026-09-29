import { useState, useRef, useEffect } from "react";
import axios from "axios";
import { useTheme } from "../context/ThemeContext";
import { FaClipboardList, FaPlay, FaChevronRight, FaDownload, FaDatabase } from "react-icons/fa";

// ── App Insights presets (requests, exceptions, etc.) ────────────────────────
const APP_INSIGHTS_PRESETS = [
  {
    category: "Requests",
    items: [
      { label: "Top failing operations",     kql: `requests\n| where timestamp > ago(1h)\n| where success == false\n| summarize failures=count() by operation_Name, resultCode\n| order by failures desc\n| take 20` },
      { label: "Response time by operation", kql: `requests\n| where timestamp > ago(1h)\n| summarize avg_ms=round(avg(duration),1), p95=round(percentile(duration,95),1), count=count() by operation_Name\n| order by avg_ms desc\n| take 20` },
      { label: "Request volume (6h)",        kql: `requests\n| where timestamp > ago(6h)\n| summarize count() by bin(timestamp, 15m)\n| order by timestamp asc` },
    ],
  },
  {
    category: "Exceptions",
    items: [
      { label: "Top exceptions (1h)",        kql: `exceptions\n| where timestamp > ago(1h)\n| summarize count() by type, outerMessage\n| order by count_ desc\n| take 20` },
      { label: "Exception timeline",         kql: `exceptions\n| where timestamp > ago(6h)\n| summarize count() by bin(timestamp, 15m)\n| order by timestamp asc` },
    ],
  },
  {
    category: "Dependencies",
    items: [
      { label: "Slow dependencies",          kql: `dependencies\n| where timestamp > ago(1h)\n| where duration > 500\n| summarize count(), avg_ms=round(avg(duration),1) by name, type\n| order by count_ desc\n| take 20` },
      { label: "Dependency failures",        kql: `dependencies\n| where timestamp > ago(1h)\n| where success == false\n| summarize count() by name, target, type\n| order by count_ desc` },
    ],
  },
];

// ── Log Analytics workspace presets (infra, containers, etc.) ─────────────────
const LOG_ANALYTICS_PRESETS = [
  {
    category: "Kubernetes / AKS",
    items: [
      { label: "Pod status summary",         kql: `KubePodInventory\n| where TimeGenerated > ago(1h)\n| summarize arg_max(TimeGenerated, *) by Name\n| summarize count() by PodStatus\n| order by count_ desc` },
      { label: "Pod restarts",               kql: `KubePodInventory\n| where TimeGenerated > ago(1h)\n| summarize arg_max(TimeGenerated, *) by Name\n| where PodRestartCount > 0\n| project Name, Namespace, PodStatus, PodRestartCount, ClusterName\n| order by PodRestartCount desc\n| take 30` },
      { label: "Node CPU usage",             kql: `Perf\n| where TimeGenerated > ago(1h)\n| where ObjectName == "K8SNode" and CounterName == "cpuUsageNanoCores"\n| summarize avg_cpu=avg(CounterValue/1000000) by Computer, bin(TimeGenerated, 5m)\n| order by TimeGenerated desc` },
      { label: "Node memory usage",          kql: `Perf\n| where TimeGenerated > ago(1h)\n| where ObjectName == "K8SNode" and CounterName == "memoryRssBytes"\n| summarize avg_mem_mb=avg(CounterValue/1048576) by Computer, bin(TimeGenerated, 5m)\n| order by TimeGenerated desc` },
      { label: "Kubernetes events (errors)", kql: `KubeEvents\n| where TimeGenerated > ago(1h)\n| where Level == "Warning" or Reason has_any ("Failed", "Error", "OOMKilling")\n| project TimeGenerated, Name, Namespace, Reason, Message\n| order by TimeGenerated desc\n| take 50` },
    ],
  },
  {
    category: "Container Logs",
    items: [
      { label: "Container errors (1h)",      kql: `ContainerLog\n| where TimeGenerated > ago(1h)\n| where LogEntry has_any ("error", "ERROR", "FATAL", "exception")\n| project TimeGenerated, ContainerName, LogEntry\n| order by TimeGenerated desc\n| take 50` },
      { label: "Container log volume",       kql: `ContainerLog\n| where TimeGenerated > ago(6h)\n| summarize count() by ContainerName, bin(TimeGenerated, 30m)\n| order by count_ desc` },
    ],
  },
  {
    category: "Azure Diagnostics",
    items: [
      { label: "Resource operations (1h)",   kql: `AzureDiagnostics\n| where TimeGenerated > ago(1h)\n| summarize count() by ResourceType, OperationName, ResultType\n| order by count_ desc\n| take 30` },
      { label: "Failed operations",          kql: `AzureDiagnostics\n| where TimeGenerated > ago(1h)\n| where ResultType != "Success"\n| project TimeGenerated, ResourceType, OperationName, ResultType, ResultDescription\n| order by TimeGenerated desc\n| take 30` },
    ],
  },
  {
    category: "Performance",
    items: [
      { label: "CPU by computer (1h)",       kql: `Perf\n| where TimeGenerated > ago(1h)\n| where CounterName == "% Processor Time" and InstanceName == "_Total"\n| summarize avg_cpu=round(avg(CounterValue),1) by Computer, bin(TimeGenerated, 5m)\n| order by TimeGenerated desc` },
      { label: "Memory available (1h)",      kql: `Perf\n| where TimeGenerated > ago(1h)\n| where CounterName == "Available MBytes"\n| summarize avg_mem=round(avg(CounterValue),0) by Computer, bin(TimeGenerated, 5m)\n| order by TimeGenerated desc` },
    ],
  },
];

export default function LogAnalyticsPage() {
  const { T } = useTheme();

  // datasource: "appinsights" | "workspace"
  const [datasource, setDatasource]   = useState("appinsights");
  const [query, setQuery]             = useState(APP_INSIGHTS_PRESETS[0].items[0].kql);
  const [activePreset, setActivePreset] = useState("Requests:0");
  const [result, setResult]           = useState(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState(null);
  const [wsStatus, setWsStatus]       = useState(null); // workspace configured?

  const presets = datasource === "appinsights" ? APP_INSIGHTS_PRESETS : LOG_ANALYTICS_PRESETS;

  // Check Log Analytics workspace status on mount
  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    axios.get("/api/log-analytics/status", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => setWsStatus(r.data))
      .catch(() => setWsStatus(null));
  }, []);

  // Switch datasource — reset query to first preset of new datasource
  const switchDatasource = (ds) => {
    setDatasource(ds);
    setResult(null);
    setError(null);
    const p = ds === "appinsights" ? APP_INSIGHTS_PRESETS : LOG_ANALYTICS_PRESETS;
    setQuery(p[0].items[0].kql);
    setActivePreset(`${p[0].category}:0`);
  };

  const runQuery = async () => {
    if (!query.trim()) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const token = localStorage.getItem("auth_token");
      const endpoint = datasource === "appinsights"
        ? "/api/kql/query"
        : "/api/log-analytics/query";
      const { data } = await axios.post(
        endpoint,
        { query, timespan: "PT1H" },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (data.success) setResult(data);
      else setError(data.message || "Query failed");
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); runQuery(); }
  };

  const downloadCsv = () => {
    const table = result?.tables?.[0];
    if (!table) return;
    const header = table.columns.map(c => c.name).join(",");
    const rows   = table.rows.map(r => r.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","));
    const blob   = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "log_analytics.csv" });
    a.click(); URL.revokeObjectURL(a.href);
  };

  const table = result?.tables?.[0];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: T.bg, color: T.text, fontSize: 13 }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px", borderBottom: `1px solid ${T.border}`, background: T.cardBg, flexShrink: 0, gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <FaClipboardList style={{ color: T.blue, fontSize: 16 }} />
          <span style={{ fontWeight: 700, fontSize: 14, color: T.text }}>Log Analytics</span>
        </div>

        {/* Datasource toggle */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, background: `${T.border}66`, borderRadius: 6, padding: 3 }}>
          {[
            { key: "appinsights", label: "App Insights" },
            { key: "workspace",   label: "Log Analytics Workspace" },
          ].map(({ key, label }) => (
            <button key={key} onClick={() => switchDatasource(key)} style={{
              padding: "4px 12px", fontSize: 12, borderRadius: 4, cursor: "pointer",
              border: "none", fontWeight: datasource === key ? 600 : 400,
              background: datasource === key ? T.blue : "transparent",
              color:      datasource === key ? "#fff" : T.muted,
              transition: "all 0.15s",
            }}>
              {label}
              {key === "workspace" && wsStatus && !wsStatus.workspaceConfigured && (
                <span style={{ marginLeft: 5, fontSize: 10, opacity: 0.7 }}>⚠ not configured</span>
              )}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {table && (
            <button onClick={downloadCsv} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 11px", fontSize: 12, cursor: "pointer", border: `1px solid ${T.border}`, borderRadius: 4, background: "transparent", color: T.muted }}>
              <FaDownload style={{ fontSize: 10 }} /> CSV
            </button>
          )}
          <button onClick={runQuery} disabled={loading} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 14px", fontSize: 12, fontWeight: 600, border: "none", borderRadius: 4, cursor: loading ? "not-allowed" : "pointer", background: loading ? T.dim : T.blue, color: "#fff", opacity: loading ? 0.7 : 1 }}>
            <FaPlay style={{ fontSize: 10 }} />
            {loading ? "Running..." : "Run"}
            <span style={{ fontSize: 10, opacity: 0.6, fontWeight: 400 }}>Ctrl+↵</span>
          </button>
        </div>
      </div>

      {/* ── Workspace not configured warning ────────────────────────────────── */}
      {datasource === "workspace" && wsStatus && !wsStatus.workspaceConfigured && (
        <div style={{ padding: "8px 16px", background: "rgba(255,152,0,0.1)", borderBottom: `1px solid rgba(255,152,0,0.3)`, fontSize: 12, color: "#ff9800" }}>
          <strong>⚠ Log Analytics workspace not configured.</strong> Set <code>LOG_ANALYTICS_WORKSPACE_ID</code> and <code>LOG_ANALYTICS_AUTH_TOKEN</code> env vars to query infrastructure tables (KubePodInventory, Perf, ContainerLog, etc.)
        </div>
      )}

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>

        {/* Left: presets */}
        <div style={{ width: 215, flexShrink: 0, borderRight: `1px solid ${T.border}`, background: T.cardBg, overflowY: "auto", padding: "8px 0" }}>
          <div style={{ padding: "6px 12px 4px", fontSize: 10, fontWeight: 700, color: T.dim, letterSpacing: "0.08em" }}>
            <FaDatabase style={{ marginRight: 5, fontSize: 9 }} />
            {datasource === "appinsights" ? "APP INSIGHTS" : "LOG ANALYTICS"}
          </div>
          {presets.map(group => (
            <div key={group.category}>
              <div style={{ padding: "10px 12px 3px", fontSize: 10, fontWeight: 700, color: T.dim, letterSpacing: "0.06em" }}>{group.category.toUpperCase()}</div>
              {group.items.map((item, i) => {
                const key = `${group.category}:${i}`;
                const active = activePreset === key;
                return (
                  <button key={key} onClick={() => { setQuery(item.kql); setActivePreset(key); }} style={{
                    width: "100%", textAlign: "left", padding: "6px 12px",
                    background: active ? `${T.blue}18` : "transparent",
                    border: "none", borderLeft: active ? `2px solid ${T.blue}` : "2px solid transparent",
                    color: active ? T.blue : T.muted, cursor: "pointer", fontSize: 12,
                    display: "flex", alignItems: "center", gap: 6,
                  }}>
                    <FaChevronRight style={{ fontSize: 9, opacity: active ? 1 : 0.3 }} />
                    {item.label}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Right: editor + results */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
          <textarea
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            rows={6}
            style={{ flexShrink: 0, resize: "vertical", border: "none", borderBottom: `1px solid ${T.border}`, outline: "none", background: T.bg, color: T.text, fontFamily: "'Cascadia Code','Fira Code','Courier New',monospace", fontSize: 12.5, lineHeight: 1.6, padding: "12px 16px", boxSizing: "border-box", width: "100%" }}
            placeholder="// KQL query — Ctrl+Enter to run"
          />

          <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
            {loading && <div style={{ padding: 20, color: T.muted }}>⏳ Running query...</div>}

            {error && <div style={{ padding: "10px 16px", color: "#f2495c", background: "rgba(242,73,92,0.08)", borderBottom: `1px solid rgba(242,73,92,0.2)`, fontSize: 12 }}><strong>Error:</strong> {error}</div>}

            {table && !loading && (
              <>
                <div style={{ padding: "5px 14px", borderBottom: `1px solid ${T.border}`, background: T.cardBg, fontSize: 11, color: T.muted, display: "flex", gap: 14, flexShrink: 0 }}>
                  <span style={{ color: T.green, fontWeight: 600 }}>✓ Success</span>
                  <span>{table.rowCount} rows</span>
                  <span>{result.executionTime}ms</span>
                </div>
                <div style={{ overflow: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr>
                        {table.columns.map(col => (
                          <th key={col.name} style={{ padding: "6px 12px", textAlign: "left", fontWeight: 600, background: T.cardBg, color: T.muted, borderBottom: `2px solid ${T.border}`, whiteSpace: "nowrap", position: "sticky", top: 0 }}>
                            {col.name}
                            <span style={{ fontSize: 10, fontWeight: 400, opacity: 0.5, marginLeft: 4 }}>{col.type}</span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {table.rows.map((row, ri) => (
                        <tr key={ri} style={{ background: ri % 2 === 0 ? "transparent" : `${T.border}44` }}>
                          {row.map((cell, ci) => (
                            <td key={ci} style={{ padding: "5px 12px", borderBottom: `1px solid ${T.border}44`, color: T.text, whiteSpace: "nowrap", maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis" }}>
                              {cell === null ? <span style={{ color: T.dim }}>null</span> : String(cell)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {!loading && !error && !result && (
              <div style={{ padding: 20, color: T.dim, fontSize: 12 }}>
                Pick a preset query or write your own KQL. Press <kbd style={{ background: T.border, padding: "2px 5px", borderRadius: 3 }}>Ctrl+Enter</kbd> to run.
                {datasource === "workspace" && (
                  <div style={{ marginTop: 8, color: T.muted }}>
                    <strong>Log Analytics workspace</strong> tables: KubePodInventory, KubeEvents, KubeNodeInventory, ContainerLog, Perf, AzureDiagnostics, InsightsMetrics, ...
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
