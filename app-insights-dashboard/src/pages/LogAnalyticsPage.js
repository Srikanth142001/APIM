import { useState, useRef } from "react";
import axios from "axios";
import { useTheme } from "../context/ThemeContext";
import { FaClipboardList, FaPlay, FaChevronRight, FaTable, FaDownload } from "react-icons/fa";

// ── Preset queries ────────────────────────────────────────────────────────────
const PRESETS = [
  {
    category: "Requests",
    items: [
      { label: "Top failing operations",    kql: `requests\n| where timestamp > ago(1h)\n| where success == false\n| summarize failures=count() by operation_Name, resultCode\n| order by failures desc\n| take 20` },
      { label: "Response time by operation", kql: `requests\n| where timestamp > ago(1h)\n| summarize avg_ms=round(avg(duration),1), p95_ms=round(percentile(duration,95),1), count=count() by operation_Name\n| order by avg_ms desc\n| take 20` },
      { label: "Request volume over time",  kql: `requests\n| where timestamp > ago(6h)\n| summarize count() by bin(timestamp, 15m)\n| order by timestamp asc` },
    ]
  },
  {
    category: "Exceptions",
    items: [
      { label: "Top exceptions (1h)",       kql: `exceptions\n| where timestamp > ago(1h)\n| summarize count() by type, outerMessage\n| order by count_ desc\n| take 20` },
      { label: "Exception timeline",        kql: `exceptions\n| where timestamp > ago(6h)\n| summarize count() by bin(timestamp, 15m)\n| order by timestamp asc` },
    ]
  },
  {
    category: "Dependencies",
    items: [
      { label: "Slow dependencies",         kql: `dependencies\n| where timestamp > ago(1h)\n| where duration > 500\n| summarize count(), avg_ms=round(avg(duration),1) by name, type\n| order by count_ desc\n| take 20` },
      { label: "Dependency failures",       kql: `dependencies\n| where timestamp > ago(1h)\n| where success == false\n| summarize count() by name, target, type\n| order by count_ desc` },
    ]
  },
  {
    category: "Custom Events",
    items: [
      { label: "Custom events summary",     kql: `customEvents\n| where timestamp > ago(1h)\n| summarize count() by name\n| order by count_ desc` },
    ]
  },
];

export default function LogAnalyticsPage() {
  const { T } = useTheme();
  const [query, setQuery]   = useState(PRESETS[0].items[0].kql);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState(null);
  const [activePreset, setActivePreset] = useState(`${PRESETS[0].category}:0`);
  const textareaRef = useRef(null);

  const runQuery = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const token = localStorage.getItem("auth_token");
      const { data } = await axios.post(
        "/api/kql/query",
        { query, timespan: "PT1H" },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (data.success) {
        setResult(data);
      } else {
        setError(data.message || "Query failed");
      }
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    // Ctrl+Enter or Cmd+Enter to run
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      runQuery();
    }
  };

  const downloadCsv = () => {
    if (!result?.tables?.[0]) return;
    const table = result.tables[0];
    const header = table.columns.map(c => c.name).join(",");
    const rows = table.rows.map(r => r.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","));
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "log_analytics_result.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const table = result?.tables?.[0];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: T.bg, color: T.text, fontSize: 13 }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "9px 16px", borderBottom: `1px solid ${T.border}`,
        background: T.cardBg, flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <FaClipboardList style={{ color: T.blue, fontSize: 16 }} />
          <span style={{ fontWeight: 700, fontSize: 14, color: T.text }}>Log Analytics</span>
          <span style={{ fontSize: 11, color: T.muted }}>— Azure Application Insights KQL</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {table && (
            <button onClick={downloadCsv} style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "5px 11px", fontSize: 12, cursor: "pointer",
              border: `1px solid ${T.border}`, borderRadius: 4,
              background: "transparent", color: T.muted,
            }}>
              <FaDownload style={{ fontSize: 10 }} /> Export CSV
            </button>
          )}
          <button onClick={runQuery} disabled={loading} style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "6px 16px", fontSize: 12, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer",
            border: "none", borderRadius: 4,
            background: loading ? T.dim : T.blue, color: "#fff",
            opacity: loading ? 0.7 : 1,
          }}>
            <FaPlay style={{ fontSize: 10 }} />
            {loading ? "Running..." : "Run Query"}
            <span style={{ fontSize: 10, opacity: 0.75, fontWeight: 400 }}>Ctrl+↵</span>
          </button>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>

        {/* Left sidebar: preset queries */}
        <div style={{
          width: 210, flexShrink: 0, borderRight: `1px solid ${T.border}`,
          background: T.cardBg, overflowY: "auto", padding: "8px 0",
        }}>
          {PRESETS.map(group => (
            <div key={group.category}>
              <div style={{ padding: "10px 12px 4px", fontSize: 10, fontWeight: 700, color: T.dim, letterSpacing: "0.08em" }}>
                {group.category.toUpperCase()}
              </div>
              {group.items.map((item, i) => {
                const key = `${group.category}:${i}`;
                const active = activePreset === key;
                return (
                  <button key={key}
                    onClick={() => { setQuery(item.kql); setActivePreset(key); }}
                    style={{
                      width: "100%", textAlign: "left", padding: "7px 12px",
                      background: active ? `${T.blue}18` : "transparent",
                      border: "none",
                      borderLeft: active ? `2px solid ${T.blue}` : "2px solid transparent",
                      color: active ? T.blue : T.muted,
                      cursor: "pointer", fontSize: 12,
                      display: "flex", alignItems: "center", gap: 6,
                    }}
                  >
                    <FaChevronRight style={{ fontSize: 9, opacity: active ? 1 : 0.4 }} />
                    {item.label}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Right: editor + results */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>

          {/* KQL editor */}
          <div style={{ flexShrink: 0, borderBottom: `1px solid ${T.border}`, position: "relative" }}>
            <textarea
              ref={textareaRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              spellCheck={false}
              rows={7}
              style={{
                width: "100%", resize: "vertical", border: "none", outline: "none",
                background: T.bg, color: T.text,
                fontFamily: "'Cascadia Code', 'Fira Code', 'Courier New', monospace",
                fontSize: 12.5, lineHeight: 1.6, padding: "12px 16px",
                boxSizing: "border-box",
              }}
              placeholder="// Enter KQL query here... Press Ctrl+Enter to run"
            />
          </div>

          {/* Results area */}
          <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
            {loading && (
              <div style={{ padding: 24, color: T.muted, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 18 }}>⏳</span> Running query against Application Insights...
              </div>
            )}

            {error && (
              <div style={{ padding: "12px 16px", color: "#f2495c", background: "rgba(242,73,92,0.08)", borderBottom: `1px solid rgba(242,73,92,0.2)`, fontSize: 12 }}>
                <strong>Error:</strong> {error}
              </div>
            )}

            {table && !loading && (
              <>
                {/* Stats bar */}
                <div style={{
                  padding: "6px 16px", borderBottom: `1px solid ${T.border}`,
                  background: T.cardBg, display: "flex", alignItems: "center", gap: 16,
                  fontSize: 11, color: T.muted, flexShrink: 0,
                }}>
                  <span style={{ color: T.green, fontWeight: 600 }}>✓ Success</span>
                  <span><FaTable style={{ fontSize: 10, marginRight: 4 }} />{table.rowCount} row{table.rowCount !== 1 ? "s" : ""}</span>
                  <span>{result.executionTime}ms</span>
                </div>

                {/* Table */}
                <div style={{ overflow: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr>
                        {table.columns.map(col => (
                          <th key={col.name} style={{
                            padding: "7px 12px", textAlign: "left", fontWeight: 600,
                            background: T.cardBg, color: T.muted,
                            borderBottom: `2px solid ${T.border}`,
                            whiteSpace: "nowrap", position: "sticky", top: 0,
                          }}>
                            {col.name}
                            <span style={{ fontSize: 10, fontWeight: 400, opacity: 0.6, marginLeft: 4 }}>
                              {col.type}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {table.rows.map((row, ri) => (
                        <tr key={ri} style={{ background: ri % 2 === 0 ? "transparent" : `${T.border}44` }}>
                          {row.map((cell, ci) => (
                            <td key={ci} style={{
                              padding: "6px 12px", borderBottom: `1px solid ${T.border}55`,
                              color: T.text, whiteSpace: "nowrap", maxWidth: 320,
                              overflow: "hidden", textOverflow: "ellipsis",
                            }}>
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
              <div style={{ padding: 24, color: T.dim, fontSize: 12 }}>
                Select a preset query from the left or write your own KQL, then press <kbd style={{ background: T.border, padding: "2px 5px", borderRadius: 3 }}>Ctrl+Enter</kbd> or click Run Query.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
