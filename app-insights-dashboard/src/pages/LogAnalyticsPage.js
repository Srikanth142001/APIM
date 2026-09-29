import { useState } from "react";
import { useTheme } from "../context/ThemeContext";
import { FaClipboardList, FaExternalLinkAlt, FaSearch, FaTable, FaChartBar } from "react-icons/fa";

const AZURE_PORTAL_LOG_ANALYTICS = "https://portal.azure.com/#blade/Microsoft_Azure_Monitoring/AzureMonitoringBrowseBlade/logs";

// Preset KQL queries for common log analytics use cases
const PRESET_QUERIES = [
  {
    label: "App Exceptions (last 1h)",
    icon: <FaSearch />,
    query: `exceptions\n| where timestamp > ago(1h)\n| summarize count() by type, outerMessage\n| order by count_ desc\n| take 50`,
  },
  {
    label: "Request failures by URL",
    icon: <FaTable />,
    query: `requests\n| where timestamp > ago(1h)\n| where success == false\n| summarize failures=count() by name, resultCode\n| order by failures desc`,
  },
  {
    label: "Average response time by operation",
    icon: <FaChartBar />,
    query: `requests\n| where timestamp > ago(1h)\n| summarize avg_ms=avg(duration), count() by operation_Name\n| order by avg_ms desc`,
  },
  {
    label: "Dependency failures",
    icon: <FaSearch />,
    query: `dependencies\n| where timestamp > ago(1h)\n| where success == false\n| summarize count() by name, target, type\n| order by count_ desc`,
  },
  {
    label: "Custom events",
    icon: <FaTable />,
    query: `customEvents\n| where timestamp > ago(1h)\n| summarize count() by name\n| order by count_ desc`,
  },
];

export default function LogAnalyticsPage() {
  const { T } = useTheme();
  const [query, setQuery] = useState(PRESET_QUERIES[0].query);
  const [copied, setCopied] = useState(false);

  const workspaceId = window.ENV_CONFIG?.LOG_ANALYTICS_WORKSPACE_ID || "";

  const copyQuery = () => {
    navigator.clipboard.writeText(query).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Build deep link to Azure Log Analytics with the query pre-filled
  const openInAzure = () => {
    const encoded = encodeURIComponent(query);
    const url = workspaceId
      ? `https://portal.azure.com/#@/resource/subscriptions/placeholder/resourceGroups/placeholder/providers/Microsoft.OperationalInsights/workspaces/${workspaceId}/logs?query=${encoded}`
      : AZURE_PORTAL_LOG_ANALYTICS;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: T.bg, color: T.text }}>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 20px", borderBottom: `1px solid ${T.border}`,
        background: T.cardBg, flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <FaClipboardList style={{ fontSize: 18, color: T.blue }} />
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>Log Analytics</div>
            <div style={{ fontSize: 11, color: T.muted }}>Azure Monitor — KQL query builder & log explorer</div>
          </div>
        </div>
        <button
          onClick={openInAzure}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "7px 14px", background: T.blue, color: "#fff",
            border: "none", borderRadius: 4, cursor: "pointer",
            fontSize: 12, fontWeight: 600,
          }}
        >
          <FaExternalLinkAlt style={{ fontSize: 11 }} />
          Open in Azure Portal
        </button>
      </div>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* Left: preset queries */}
        <div style={{
          width: 220, flexShrink: 0, borderRight: `1px solid ${T.border}`,
          background: T.cardBg, padding: "12px 0", overflowY: "auto",
        }}>
          <div style={{ padding: "4px 14px 10px", fontSize: 10, fontWeight: 700, color: T.dim, letterSpacing: "0.08em" }}>
            PRESET QUERIES
          </div>
          {PRESET_QUERIES.map((p, i) => (
            <button
              key={i}
              onClick={() => setQuery(p.query)}
              style={{
                width: "100%", textAlign: "left", padding: "8px 14px",
                background: query === p.query ? `${T.blue}18` : "transparent",
                border: "none",
                borderLeft: query === p.query ? `2px solid ${T.blue}` : "2px solid transparent",
                color: query === p.query ? T.blue : T.muted,
                cursor: "pointer", fontSize: 12,
                display: "flex", alignItems: "center", gap: 8,
              }}
            >
              <span style={{ fontSize: 11, flexShrink: 0 }}>{p.icon}</span>
              <span style={{ lineHeight: 1.3 }}>{p.label}</span>
            </button>
          ))}
        </div>

        {/* Right: query editor */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Toolbar */}
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "8px 16px", borderBottom: `1px solid ${T.border}`,
            background: T.cardBg, flexShrink: 0,
          }}>
            <span style={{ fontSize: 12, color: T.muted, flex: 1 }}>
              Edit the query below, then open in Azure Portal to run it against your workspace.
            </span>
            <button
              onClick={copyQuery}
              style={{
                padding: "5px 12px", fontSize: 12, cursor: "pointer",
                border: `1px solid ${T.border}`, borderRadius: 4,
                background: copied ? `${T.green}22` : "transparent",
                color: copied ? T.green : T.muted,
              }}
            >
              {copied ? "✓ Copied!" : "Copy Query"}
            </button>
            <button
              onClick={openInAzure}
              style={{
                padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer",
                border: "none", borderRadius: 4,
                background: T.blue, color: "#fff",
                display: "flex", alignItems: "center", gap: 5,
              }}
            >
              <FaExternalLinkAlt style={{ fontSize: 10 }} /> Run in Azure
            </button>
          </div>

          {/* KQL editor */}
          <textarea
            value={query}
            onChange={e => setQuery(e.target.value)}
            spellCheck={false}
            style={{
              flex: 1, resize: "none", border: "none", outline: "none",
              background: T.bg, color: T.text,
              fontFamily: "'Cascadia Code', 'Fira Code', 'Courier New', monospace",
              fontSize: 13, lineHeight: 1.6,
              padding: "16px 20px",
            }}
            placeholder="// Enter your KQL query here..."
          />

          {/* Footer hint */}
          <div style={{
            padding: "6px 16px", borderTop: `1px solid ${T.border}`,
            fontSize: 11, color: T.dim, background: T.cardBg,
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <FaClipboardList style={{ fontSize: 11 }} />
            Queries run in Azure Log Analytics workspace. Click "Run in Azure" to execute.
            {workspaceId && (
              <span style={{ marginLeft: "auto", color: T.green }}>
                ✓ Workspace ID configured
              </span>
            )}
            {!workspaceId && (
              <span style={{ marginLeft: "auto", color: T.muted }}>
                Set LOG_ANALYTICS_WORKSPACE_ID env var to deep-link to your workspace
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
