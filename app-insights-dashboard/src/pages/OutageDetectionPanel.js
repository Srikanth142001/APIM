/**
 * OutageDetectionPanel — the most important panel for fast outage capture
 * Combines: Spike Detector, Error Burst Timeline, DrillDownPanel, Percentile Heatmap, Top Failing URLs
 */
import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  Tooltip, CartesianGrid, ReferenceLine, ReferenceArea,
} from "recharts";
import { API_ENDPOINTS } from "../config/apiConfig";
import { useTheme } from "../config/../context/ThemeContext";

// ── Panel wrapper ─────────────────────────────────────────────────────────────
const Panel = ({ title, color = "#5794f2", badge, children, loading, error }) => {
  const { T } = useTheme();
  return (
    <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 4, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px", borderBottom: `1px solid ${T.border}`, background: T.surface, minHeight: 36 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 3, height: 16, borderRadius: 2, background: color, flexShrink: 0 }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: T.text }}>{title}</span>
          {badge && <span style={{ fontSize: 10, color: T.muted, background: T.border, padding: "1px 7px", borderRadius: 3, border: `1px solid ${T.border2}` }}>{badge}</span>}
        </div>
        {error && <span style={{ fontSize: 10, color: "#f2495c" }}>⚠ API Error</span>}
      </div>
      <div style={{ padding: "10px 14px" }}>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[80, 60, 90, 50].map((w, i) => (
              <div key={i} className="gf-skeleton" style={{ height: 12, width: `${w}%` }} />
            ))}
        </div>
      ) : children}
    </div>
  </div>
  );
};

// ── Status color helpers ──────────────────────────────────────────────────────
const statusColor = (s) => ({ DEAD: "#f2495c", CRITICAL_DROP: "#f2495c", DEGRADED: "#f5a623", HIGH_ERRORS: "#f5a623", OK: "#73bf69" }[s] || "#8e8e8e");
const slaColor = (s) => ({ critical: "#f2495c", warning: "#f5a623", ok: "#73bf69" }[s] || "#8e8e8e");
const severityColor = (s) => ({ critical: "#f2495c", warning: "#f5a623", info: "#5794f2" }[s] || "#8e8e8e");

// ── HTTP code color helper ────────────────────────────────────────────────────
const getCodeColor = (code) => {
  const c = String(code || "");
  if (c.startsWith("5")) return "#f2495c";
  if (c.startsWith("4")) return "#f5a623";
  if (c.startsWith("2")) return "#73bf69";
  return "#5794f2";
};

// ── DrillDownPanel column definitions ────────────────────────────────────────
const COLS = [
  { key: "operation_Name", label: "API Name",    w: "30%", align: "left"  },
  { key: "failures",       label: "Failures",    w: "9%",  align: "right" },
  { key: "error_rate",     label: "Err Rate",    w: "9%",  align: "right" },
  { key: "avg_rt",         label: "Avg RT",      w: "9%",  align: "right" },
  { key: "p95_rt",         label: "p95 RT",      w: "9%",  align: "right" },
  { key: "total",          label: "Total Req",   w: "9%",  align: "right" },
  { key: "result_codes",   label: "HTTP Codes",  w: "15%", align: "left"  },
];

// ── 1. Spike Detector ─────────────────────────────────────────────────────────
function SpikeDetector() {
  const { T, themeKey } = useTheme();
  const isLight = themeKey === "light";
  const gridStroke = isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.04)";
  const TT = {
    contentStyle: { background: T.panel, border: `1px solid ${T.border2}`, borderRadius: 4, fontSize: 11 },
    labelStyle: { color: T.muted, fontSize: 10 },
  };
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    axios.get(API_ENDPOINTS.spikeDetector)
      .then(r => { setData(r.data); setError(false); })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 60 * 1000); return () => clearInterval(t); }, [load]);

  const hasCritical = data?.spikes?.some(s => s.severity === "critical");

  return (
    <Panel title="⚡ Live Spike Detector" color={hasCritical ? "#f2495c" : "#73bf69"} badge="Refreshes every 60s" loading={loading} error={error}>
      {data && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 10 }}>
            {[
              { label: "Error Rate",  curr: `${data.current?.errorRate}%`,  prev: `${data.previous?.errorRate}%`,  color: data.current?.errorRate > 10 ? "#f2495c" : "#73bf69" },
              { label: "Requests/5m", curr: data.current?.total,            prev: data.previous?.total,            color: data.current?.total < data.previous?.total * 0.5 ? "#f2495c" : "#73bf69" },
              { label: "Avg RT",      curr: `${data.current?.avgRt}ms`,     prev: `${data.previous?.avgRt}ms`,     color: data.current?.avgRt > 1000 ? "#f5a623" : "#73bf69" },
            ].map(({ label, curr, prev, color }) => (
              <div key={label} style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 3, padding: "8px 10px" }}>
                <div style={{ fontSize: 10, color: T.muted, marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color }}>{curr}</div>
                <div style={{ fontSize: 10, color: T.dim, marginTop: 2 }}>prev: {prev}</div>
              </div>
            ))}
          </div>

          {data.spikes?.length === 0 ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "rgba(115,191,105,0.08)", border: "1px solid rgba(115,191,105,0.2)", borderRadius: 3 }}>
              <span style={{ fontSize: 14 }}>✅</span>
              <span style={{ fontSize: 12, color: "#73bf69", fontWeight: 600 }}>No spikes detected — all metrics normal</span>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {data.spikes.map((spike, i) => (
                <div key={i} style={{ padding: "8px 10px", background: `${severityColor(spike.severity)}10`, border: `1px solid ${severityColor(spike.severity)}30`, borderRadius: 3 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: severityColor(spike.severity), background: `${severityColor(spike.severity)}20`, padding: "1px 6px", borderRadius: 3 }}>{spike.severity.toUpperCase()}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: T.text }}>{spike.title}</span>
                    <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, color: severityColor(spike.severity) }}>
                      {spike.change > 0 ? "▲" : "▼"} {Math.abs(spike.change)}%
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: T.muted }}>{spike.message}</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Panel>
  );
}

// ── 2. Error Burst Timeline — chart panel only ────────────────────────────────
function ErrorBurstTimeline({ range, committed, drillLoading, drillData, onDrillResult, onReset }) {
  const { T, themeKey } = useTheme();
  const isLight = themeKey === "light";
  const gridStroke = isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.04)";
  const TT = {
    contentStyle: { background: T.panel, border: `1px solid ${T.border2}`, borderRadius: 4, fontSize: 11 },
    labelStyle: { color: T.muted, fontSize: 10 },
  };
  const [data, setData]             = useState({ timeline: [], bursts: [] });
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(false);
  const [selecting, setSelecting]   = useState(false);
  const [selStart, setSelStart]     = useState(null);
  const [selEnd, setSelEnd]         = useState(null);
  const [selStartTs, setSelStartTs] = useState(null);
  const [selEndTs, setSelEndTs]     = useState(null);

  useEffect(() => {
    setLoading(true);
    onReset();
    axios.get(API_ENDPOINTS.errorBurstTimeline(range))
      .then(r => { setData(r.data || { timeline: [], bursts: [] }); setError(false); })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const timeline = data.timeline || [];

  const displayTimeline = committed
    ? timeline.filter(d => d.timestamp >= committed.ts1 && d.timestamp <= committed.ts2)
    : timeline;

  const maxErrorRate = Math.max(...displayTimeline.map(d => d.errorRate || 0), 1);

  const handleMouseDown = (e) => {
    if (!e?.activeLabel) return;
    const idx = timeline.findIndex(d => d.time === e.activeLabel);
    if (idx < 0) return;
    setSelecting(true);
    setSelStart(e.activeLabel);
    setSelEnd(e.activeLabel);
    setSelStartTs(timeline[idx].timestamp);
    setSelEndTs(timeline[idx].timestamp);
    onReset();
  };

  const handleMouseMove = (e) => {
    if (!selecting || !e?.activeLabel) return;
    const idx = timeline.findIndex(d => d.time === e.activeLabel);
    if (idx < 0) return;
    setSelEnd(e.activeLabel);
    setSelEndTs(timeline[idx].timestamp);
  };

  const handleMouseUp = () => {
    if (!selecting) return;
    setSelecting(false);
    if (!selStartTs || !selEndTs || selStartTs === selEndTs) return;
    const [ts1, ts2] = selStartTs < selEndTs ? [selStartTs, selEndTs] : [selEndTs, selStartTs];
    const [l1, l2]   = selStartTs < selEndTs ? [selStart, selEnd]     : [selEnd, selStart];
    onDrillResult({ ts1, ts2, l1, l2 });
  };

  const resetZoom = () => {
    setSelStart(null);
    setSelEnd(null);
    setSelStartTs(null);
    setSelEndTs(null);
    onReset();
  };

  const refStart = selStartTs && selEndTs && selStartTs > selEndTs ? selEnd : selStart;
  const refEnd   = selStartTs && selEndTs && selStartTs > selEndTs ? selStart : selEnd;

  return (
    <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 4, overflow: "hidden" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px", borderBottom: `1px solid ${T.border}`, background: T.panel, minHeight: 36 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ width: 3, height: 16, borderRadius: 2, background: "#f2495c", flexShrink: 0 }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: T.text }}>🔥 Error Burst Timeline</span>
          <span style={{ fontSize: 10, color: T.muted, background: T.border, padding: "1px 7px", borderRadius: 3, border: `1px solid ${T.border2}` }}>
            {committed ? `Zoomed: ${committed.l1} → ${committed.l2}` : `Last ${range} · 1-min bins`}
          </span>
          {committed ? (
            <>
              <span style={{ fontSize: 10, color: "#5794f2", background: "rgba(87,148,242,0.1)", padding: "2px 8px", borderRadius: 3, border: "1px solid rgba(87,148,242,0.25)", fontWeight: 600 }}>
                📍 {committed.l1} → {committed.l2}
              </span>
              <button
                onClick={resetZoom}
                style={{ padding: "2px 8px", background: "rgba(242,73,92,0.1)", border: "1px solid rgba(242,73,92,0.25)", borderRadius: 3, color: "#f2495c", fontSize: 10, cursor: "pointer" }}
              >
                ✕ Reset Zoom
              </button>
              {drillData && (
                <span style={{ fontSize: 10, color: "#73bf69", background: "rgba(115,191,105,0.1)", padding: "2px 8px", borderRadius: 3, border: "1px solid rgba(115,191,105,0.25)" }}>
                  {drillData.totalApis} APIs · {drillData.windowMinutes}min
                </span>
              )}
              {drillLoading && (
                <span style={{ fontSize: 10, color: "#5794f2", display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ display: "inline-block", width: 10, height: 10, border: "2px solid #5794f2", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                  Loading...
                </span>
              )}
            </>
          ) : (
            <span style={{ fontSize: 10, color: T.dim }}>Drag on chart to zoom &amp; drill down</span>
          )}
        </div>
        {error && <span style={{ fontSize: 10, color: "#f2495c" }}>⚠ API Error</span>}
      </div>

      {/* Body */}
      <div style={{ padding: "10px 14px" }}>
        {data.bursts?.length > 0 && (
          <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
            {data.bursts.map((b, i) => (
              <span key={i} style={{ fontSize: 10, padding: "2px 8px", background: "rgba(242,73,92,0.15)", border: "1px solid rgba(242,73,92,0.3)", borderRadius: 3, color: "#f2495c", fontWeight: 600 }}>
                🔴 Burst: {b.start} → {b.end}
              </span>
            ))}
          </div>
        )}

        {loading ? (
          <div className="gf-skeleton" style={{ height: 200, width: "100%" }} />
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart
              data={displayTimeline}
              margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              style={{ cursor: selecting ? "col-resize" : "crosshair", userSelect: "none" }}
            >
              <defs>
                <linearGradient id="errGradBT" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f2495c" stopOpacity={0.4} />
                  <stop offset="90%" stopColor="#f2495c" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="rtGradBT" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#5794f2" stopOpacity={0.3} />
                  <stop offset="90%" stopColor="#5794f2" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 4" stroke={gridStroke} vertical={false} />
              <XAxis dataKey="time" tick={{ fontSize: 9, fill: T.dim }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis yAxisId="left" tick={{ fontSize: 9, fill: T.dim }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} width={32} domain={[0, Math.max(maxErrorRate + 5, 20)]} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 9, fill: T.dim }} axisLine={false} tickLine={false} width={36} />
              {!selecting && (
                <Tooltip
                  {...TT}
                  formatter={(v, name) => [name === "errorRate" ? `${v}%` : `${v}ms`, name === "errorRate" ? "Error Rate" : "Avg RT"]}
                />
              )}
              {maxErrorRate > 10 && (
                <ReferenceLine yAxisId="left" y={10} stroke="#f5a623" strokeDasharray="4 2" strokeWidth={1} label={{ value: "10%", fill: "#f5a623", fontSize: 9 }} />
              )}
              <Area yAxisId="right" type="monotone" dataKey="avgRt" stroke="#5794f2" strokeWidth={1.5} fill="url(#rtGradBT)" isAnimationActive={false} dot={false} />
              <Area yAxisId="left" type="monotone" dataKey="errorRate" stroke="#f2495c" strokeWidth={2} fill="url(#errGradBT)" isAnimationActive={false} dot={false} activeDot={selecting ? false : { r: 3 }} />
              {selecting && selStart && selEnd && selStart !== selEnd && (
                <ReferenceArea yAxisId="left" x1={refStart} x2={refEnd} fill="rgba(87,148,242,0.2)" stroke="#5794f2" strokeWidth={1.5} />
              )}
            </AreaChart>
          </ResponsiveContainer>
        )}

        <div style={{ display: "flex", gap: 12, marginTop: 6, fontSize: 10, color: T.muted }}>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 12, height: 2, background: "#f2495c", display: "inline-block" }} />
            Error Rate (%)
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 12, height: 2, background: "#5794f2", display: "inline-block" }} />
            Avg Response (ms)
          </span>
          <span style={{ marginLeft: "auto", color: T.dim }}>
            {committed
              ? `Showing zoomed view · ${displayTimeline.length} data points`
              : "Drag on chart to zoom into a time window"}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── 3. DrillDownPanel — standalone full-width drill-down table ────────────────
function DrillDownPanel({ committed, drillData, drillLoading }) {
  const { T } = useTheme();
  const [drillSort, setDrillSort]       = useState({ key: "failures", dir: "desc" });
  const [drillSearch, setDrillSearch]   = useState("");
  const [drillPage, setDrillPage]       = useState(1);
  const [drillPageSize, setDrillPageSize] = useState(10);

  // Reset page when search changes
  const handleSearch = (val) => { setDrillSearch(val); setDrillPage(1); };

  if (!drillData || !committed) return null;

  const apis = drillData.apis || [];

  // Filter
  const filteredApis = apis.filter(a =>
    !drillSearch || (a.operation_Name || "").toLowerCase().includes(drillSearch.toLowerCase())
  );

  // Sort
  const sortedApis = [...filteredApis].sort((a, b) => {
    const av = a[drillSort.key] ?? 0;
    const bv = b[drillSort.key] ?? 0;
    if (typeof av === "string") return drillSort.dir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    return drillSort.dir === "asc" ? av - bv : bv - av;
  });

  // Paginate
  const totalPages = Math.max(1, Math.ceil(sortedApis.length / drillPageSize));
  const pagedApis  = sortedApis.slice((drillPage - 1) * drillPageSize, drillPage * drillPageSize);

  // KPI stats
  const totalFail = apis.reduce((s, a) => s + (a.failures || 0), 0);
  const critApis  = apis.filter(a => a.error_rate >= 50).length;
  const slowApis  = apis.filter(a => a.avg_rt > 2000).length;
  const totalApis = drillData.totalApis;

  const kpis = [
    { icon: "💥", label: "Total Failures", value: totalFail.toLocaleString(), color: "#f2495c", bg: "rgba(242,73,92,0.08)",  border: "rgba(242,73,92,0.2)"  },
    { icon: "🔴", label: "Critical APIs",  value: critApis,                   color: "#f2495c", bg: "rgba(242,73,92,0.06)",  border: "rgba(242,73,92,0.15)" },
    { icon: "🐢", label: "Slow APIs",      value: slowApis,                   color: "#f5a623", bg: "rgba(245,166,35,0.08)", border: "rgba(245,166,35,0.2)"  },
    { icon: "📡", label: "APIs Affected",  value: totalApis,                  color: "#5794f2", bg: "rgba(87,148,242,0.08)", border: "rgba(87,148,242,0.2)"  },
  ];

  return (
    <div style={{ background: T.bg, border: `1px solid ${T.blue}40`, borderRadius: 6, overflow: "hidden", boxShadow: "0 4px 24px rgba(0,0,0,0.2)" }}>

      <div style={{ background: T.surface, borderBottom: `1px solid ${T.blue}30`, padding: "12px 20px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(87,148,242,0.15)", border: "1px solid rgba(87,148,242,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🔍</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.text, letterSpacing: "-0.01em" }}>Time Window Analysis</div>
            <div style={{ fontSize: 11, color: T.muted, marginTop: 1 }}>
              <span style={{ color: "#5794f2", fontWeight: 600 }}>{committed.l1}</span>
              <span style={{ color: T.dim, margin: "0 5px" }}>→</span>
              <span style={{ color: "#5794f2", fontWeight: 600 }}>{committed.l2}</span>
              <span style={{ color: T.dim, margin: "0 6px" }}>·</span>
              <span style={{ color: T.muted }}>{drillData.windowMinutes} min window</span>
            </div>
          </div>
        </div>

        {/* KPI cards */}
        <div style={{ display: "flex", gap: 8, marginLeft: 16, flexWrap: "wrap" }}>
          {kpis.map(({ icon, label, value, color, bg, border }) => (
            <div key={label} style={{ padding: "8px 14px", background: bg, border: `1px solid ${border}`, borderRadius: 6, minWidth: 90, textAlign: "center" }}>
              <div style={{ fontSize: 10, color: T.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>{icon} {label}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color, lineHeight: 1, letterSpacing: "-0.02em" }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Search + rows-per-page */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto", flexWrap: "wrap" }}>
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: T.muted }}>🔎</span>
            <input
              value={drillSearch}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Search API name..."
              style={{ width: 210, background: T.inputBg, border: `1px solid ${T.border2}`, borderRadius: 5, color: T.text, fontSize: 11, padding: "6px 10px 6px 28px", outline: "none" }}
              onFocus={e => { e.target.style.borderColor = "#5794f2"; }}
              onBlur={e => { e.target.style.borderColor = T.border2; }}
            />
          </div>
          <div style={{ display: "flex", background: T.inputBg, border: `1px solid ${T.border2}`, borderRadius: 5, overflow: "hidden" }}>
            {[10, 25, 50].map(n => (
              <button
                key={n}
                onClick={() => { setDrillPageSize(n); setDrillPage(1); }}
                style={{ padding: "5px 10px", background: drillPageSize === n ? "rgba(87,148,242,0.25)" : "transparent", border: "none", color: drillPageSize === n ? "#5794f2" : T.muted, fontSize: 11, fontWeight: drillPageSize === n ? 700 : 400, cursor: "pointer" }}
              >
                {n}
              </button>
            ))}
          </div>
          <span style={{ fontSize: 10, color: T.muted, whiteSpace: "nowrap" }}>{filteredApis.length} results</span>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "7px 20px", background: T.bg, borderBottom: `1px solid ${T.border}`, fontSize: 10, color: T.muted }}>
        <span style={{ fontWeight: 600, color: T.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Severity:</span>
        {[
          { color: "#f2495c", label: "Critical ≥50% err"  },
          { color: "#f5a623", label: "Warning ≥20% err"   },
          { color: "#5794f2", label: "Elevated <20% err"  },
        ].map(({ color, label }) => (
          <span key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block" }} />
            <span style={{ color: T.muted }}>{label}</span>
          </span>
        ))}
        <span style={{ marginLeft: "auto", color: T.dim }}>Click column headers to sort · Hover rows for details</span>
      </div>

      {/* ── Table ── */}
      <div style={{ overflowX: "auto", maxHeight: 420, overflowY: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead style={{ position: "sticky", top: 0, zIndex: 2 }}>
            <tr style={{ background: T.bg, borderBottom: `2px solid ${T.blue}30` }}>
              <th style={{ padding: "9px 16px", textAlign: "left", color: T.muted, fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", width: "3%", whiteSpace: "nowrap" }}>#</th>
              {COLS.map(({ key, label, w, align }) => {
                const isActive = drillSort.key === key;
                return (
                  <th
                    key={key}
                    onClick={() => { setDrillSort(s => ({ key, dir: s.key === key && s.dir === "desc" ? "asc" : "desc" })); setDrillPage(1); }}
                    style={{ padding: "9px 12px", textAlign: align, color: isActive ? "#93c5fd" : T.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", fontSize: 9, cursor: "pointer", userSelect: "none", width: w, whiteSpace: "nowrap", background: isActive ? "rgba(87,148,242,0.06)" : "transparent", borderBottom: isActive ? "2px solid #5794f2" : "2px solid transparent" }}
                  >
                    {label} {isActive ? (drillSort.dir === "asc" ? "↑" : "↓") : <span style={{ opacity: 0.3 }}>↕</span>}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {drillLoading ? (
              Array.from({ length: drillPageSize }).map((_, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${T.border}`, background: i % 2 === 0 ? T.bg : T.surface }}>
                  <td style={{ padding: "10px 16px" }}><div className="gf-skeleton" style={{ height: 10, width: 20 }} /></td>
                  {COLS.map(({ key }) => (
                    <td key={key} style={{ padding: "10px 12px" }}><div className="gf-skeleton" style={{ height: 10, width: "80%" }} /></td>
                  ))}
                </tr>
              ))
            ) : pagedApis.length === 0 ? (
              <tr>
                <td colSpan={COLS.length + 1} style={{ padding: "24px", textAlign: "center", color: T.muted, fontSize: 12 }}>
                  {drillSearch ? `No APIs matching "${drillSearch}"` : "No data available"}
                </td>
              </tr>
            ) : (
              pagedApis.map((api, i) => {
                const rank    = (drillPage - 1) * drillPageSize + i + 1;
                const maxFail = filteredApis[0]?.failures || 1;
                const failPct = Math.min(((api.failures || 0) / maxFail) * 100, 100);
                const bc      = api.error_rate >= 50 ? "#f2495c" : api.error_rate >= 20 ? "#f5a623" : "#5794f2";
                const errColor = api.error_rate >= 50 ? "#f2495c" : api.error_rate >= 20 ? "#f5a623" : "#73bf69";
                const rtColor  = api.avg_rt > 5000 ? "#f2495c" : api.avg_rt > 2000 ? "#f5a623" : api.avg_rt > 1000 ? T.text : "#73bf69";
                const isEven   = i % 2 === 0;
                return (
                  <tr
                    key={i}
                    style={{ borderBottom: `1px solid ${T.border}`, background: isEven ? T.bg : T.surface, borderLeft: `3px solid ${bc}`, transition: "background 0.12s" }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(87,148,242,0.05)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = isEven ? T.bg : T.surface; }}
                  >
                    <td style={{ padding: "10px 16px", color: T.dim, fontSize: 10, fontWeight: 700, textAlign: "center" }}>{rank}</td>
                    <td style={{ padding: "10px 12px", minWidth: 200, maxWidth: 320 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 6, height: 6, borderRadius: "50%", background: bc, flexShrink: 0, boxShadow: `0 0 6px ${bc}` }} />
                        <div style={{ overflow: "hidden" }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 280 }} title={api.operation_Name}>
                            {api.operation_Name}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                            <div style={{ flex: 1, height: 3, background: T.border, borderRadius: 2, overflow: "hidden", maxWidth: 160 }}>
                              <div style={{ height: "100%", width: `${failPct}%`, background: `linear-gradient(90deg, ${bc}, ${bc}88)`, borderRadius: 2, transition: "width 0.4s ease" }} />
                            </div>
                            <span style={{ fontSize: 9, color: T.muted }}>{failPct.toFixed(0)}% of peak</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right" }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: "#f2495c", letterSpacing: "-0.02em" }}>{(api.failures || 0).toLocaleString()}</span>
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right" }}>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 8px", background: `${errColor}15`, border: `1px solid ${errColor}30`, borderRadius: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: errColor }}>{api.error_rate}%</span>
                      </div>
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right" }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: rtColor }}>{api.avg_rt}ms</span>
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right" }}>
                      <span style={{ fontSize: 11, color: api.p95_rt > 5000 ? "#f5a623" : T.muted }}>{api.p95_rt}ms</span>
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right" }}>
                      <span style={{ fontSize: 11, color: T.textSub }}>{(api.total || 0).toLocaleString()}</span>
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {api.result_codes
                          ? api.result_codes.split(",").slice(0, 4).map(c => {
                              const code = c.trim();
                              const cc = getCodeColor(code);
                              return (
                                <span key={code} style={{ padding: "1px 6px", background: `${cc}15`, border: `1px solid ${cc}30`, borderRadius: 3, color: cc, fontWeight: 700, fontSize: 10 }}>{code}</span>
                              );
                            })
                          : <span style={{ color: T.dim, fontSize: 10 }}>—</span>
                        }
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 20px", borderTop: `1px solid ${T.border}`, background: T.bg }}>
        <span style={{ fontSize: 11, color: T.muted }}>
          Showing{" "}
          <strong style={{ color: T.textSub }}>{Math.min((drillPage - 1) * drillPageSize + 1, filteredApis.length)}–{Math.min(drillPage * drillPageSize, filteredApis.length)}</strong>
          {" "}of{" "}
          <strong style={{ color: T.textSub }}>{filteredApis.length}</strong> APIs
          {drillSearch && <span style={{ color: "#5794f2", marginLeft: 6 }}>matching "{drillSearch}"</span>}
        </span>
        {totalPages > 1 && (
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <button onClick={() => setDrillPage(1)} disabled={drillPage === 1}
              style={{ padding: "4px 10px", background: drillPage === 1 ? "transparent" : "rgba(87,148,242,0.1)", border: `1px solid ${T.border}`, borderRadius: 4, color: drillPage === 1 ? T.dim : "#5794f2", fontSize: 11, cursor: drillPage === 1 ? "not-allowed" : "pointer" }}>«</button>
            <button onClick={() => setDrillPage(p => Math.max(1, p - 1))} disabled={drillPage === 1}
              style={{ padding: "4px 10px", background: drillPage === 1 ? "transparent" : "rgba(87,148,242,0.1)", border: `1px solid ${T.border}`, borderRadius: 4, color: drillPage === 1 ? T.dim : "#5794f2", fontSize: 11, cursor: drillPage === 1 ? "not-allowed" : "pointer" }}>‹ Prev</button>
            <span style={{ padding: "4px 14px", background: "rgba(87,148,242,0.15)", border: "1px solid rgba(87,148,242,0.3)", borderRadius: 4, color: "#5794f2", fontSize: 11, fontWeight: 700 }}>
              {drillPage} / {totalPages}
            </span>
            <button onClick={() => setDrillPage(p => Math.min(totalPages, p + 1))} disabled={drillPage === totalPages}
              style={{ padding: "4px 10px", background: drillPage === totalPages ? "transparent" : "rgba(87,148,242,0.1)", border: `1px solid ${T.border}`, borderRadius: 4, color: drillPage === totalPages ? T.dim : "#5794f2", fontSize: 11, cursor: drillPage === totalPages ? "not-allowed" : "pointer" }}>Next ›</button>
            <button onClick={() => setDrillPage(totalPages)} disabled={drillPage === totalPages}
              style={{ padding: "4px 10px", background: drillPage === totalPages ? "transparent" : "rgba(87,148,242,0.1)", border: `1px solid ${T.border}`, borderRadius: 4, color: drillPage === totalPages ? T.dim : "#5794f2", fontSize: 11, cursor: drillPage === totalPages ? "not-allowed" : "pointer" }}>»</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── 4. Percentile Heatmap ─────────────────────────────────────────────────────
function PercentileHeatmap({ range, startDate, endDate }) {
  const { T } = useTheme();
  const [data, setData]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);

  useEffect(() => {
    setLoading(true);
    axios.get(API_ENDPOINTS.percentileHeatmap(range, startDate, endDate))
      .then(r => { setData(Array.isArray(r.data) ? r.data : []); setError(false); })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [range, startDate, endDate]);

  const maxP95 = Math.max(...data.map(d => d.p95), 1);

  return (
    <Panel title="📊 Response Time Percentiles (p50/p95/p99)" color="#f5a623" badge="Top 15 by p95" loading={loading} error={error}>
      {data.length === 0 ? (
        <div style={{ color: T.dim, fontSize: 12, textAlign: "center", padding: "16px 0" }}>No data available</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="gf-table">
            <thead>
              <tr>
                <th>Operation</th>
                <th style={{ textAlign: "center" }}>p50</th>
                <th style={{ textAlign: "center" }}>p95</th>
                <th style={{ textAlign: "center" }}>p99</th>
                <th style={{ textAlign: "center" }}>Count</th>
                <th style={{ textAlign: "center" }}>Err%</th>
                <th style={{ textAlign: "center" }}>SLA</th>
                <th style={{ minWidth: 80 }}>p95 Bar</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => {
                const sc = slaColor(row.slaStatus);
                const barWidth = Math.min((row.p95 / maxP95) * 100, 100);
                return (
                  <tr key={i}>
                    <td style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 11 }} title={row.operation}>{row.operation}</td>
                    <td style={{ textAlign: "center", color: row.p50 > 2000 ? "#f5a623" : "#73bf69" }}>{row.p50}ms</td>
                    <td style={{ textAlign: "center", color: sc, fontWeight: 700 }}>{row.p95}ms</td>
                    <td style={{ textAlign: "center", color: row.p99 > 5000 ? "#f2495c" : T.muted }}>{row.p99}ms</td>
                    <td style={{ textAlign: "center", color: T.muted }}>{row.count?.toLocaleString()}</td>
                    <td style={{ textAlign: "center", color: row.errorRate > 10 ? "#f2495c" : row.errorRate > 4 ? "#f5a623" : T.muted }}>{row.errorRate}%</td>
                    <td style={{ textAlign: "center" }}>
                      <span className="gf-badge" style={{ background: `${sc}15`, color: sc, fontSize: 10 }}>{row.slaStatus.toUpperCase()}</span>
                    </td>
                    <td>
                      <div style={{ background: T.border, borderRadius: 2, height: 6, overflow: "hidden", minWidth: 60 }}>
                        <div style={{ height: "100%", borderRadius: 2, background: sc, width: `${barWidth}%`, transition: "width 0.5s ease" }} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

// ── 5. Top Failing URLs ───────────────────────────────────────────────────────
function TopFailingUrls({ range, startDate, endDate }) {
  const { T } = useTheme();
  const [data, setData]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    setLoading(true);
    axios.get(API_ENDPOINTS.topFailingUrls(range, startDate, endDate))
      .then(r => { setData(Array.isArray(r.data) ? r.data : []); setError(false); })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [range, startDate, endDate]);

  return (
    <Panel title="🔴 Top Failing Endpoints" color="#f2495c" badge={`Last ${range}`} loading={loading} error={error}>
      {data.length === 0 ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "rgba(115,191,105,0.08)", border: "1px solid rgba(115,191,105,0.2)", borderRadius: 3 }}>
          <span style={{ fontSize: 14 }}>✅</span>
          <span style={{ fontSize: 12, color: "#73bf69", fontWeight: 600 }}>No failures detected</span>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {data.slice(0, 10).map((row, i) => (
            <div key={i}>
              <div
                onClick={() => setExpanded(expanded === i ? null : i)}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", background: T.panel, border: `1px solid ${T.border}`, borderRadius: 3, cursor: "pointer", transition: "border-color 0.15s" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = T.border2; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; }}
              >
                <span style={{ background: "rgba(242,73,92,0.15)", color: "#f2495c", borderRadius: 3, fontSize: 11, fontWeight: 700, padding: "1px 7px", minWidth: 36, textAlign: "center", flexShrink: 0 }}>{row.failureCount}</span>
                <span style={{ flex: 1, fontSize: 11, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={row.name}>{row.name}</span>
                <span style={{ fontSize: 10, color: "#f5a623", background: "rgba(245,166,35,0.1)", padding: "1px 6px", borderRadius: 3, flexShrink: 0 }}>{row.resultCodes}</span>
                <span style={{ fontSize: 10, color: T.dim, flexShrink: 0 }}>{row.duration}</span>
                <span style={{ fontSize: 10, color: T.dim, flexShrink: 0 }}>Last: {row.lastSeen}</span>
                <span style={{ fontSize: 10, color: T.dim }}>{expanded === i ? "▲" : "▼"}</span>
              </div>
              {expanded === i && (
                <div style={{ padding: "8px 10px", background: T.bg, border: `1px solid ${T.border}`, borderTop: "none", borderRadius: "0 0 3px 3px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 11 }}>
                    <div>
                      <span style={{ color: T.dim }}>First seen: </span>
                      <span style={{ color: T.text }}>{row.firstSeen}</span>
                    </div>
                    <div>
                      <span style={{ color: T.dim }}>Last seen: </span>
                      <span style={{ color: T.text }}>{row.lastSeen}</span>
                    </div>
                    <div style={{ gridColumn: "1 / -1" }}>
                      <span style={{ color: T.dim }}>Sample URL: </span>
                      <span style={{ color: "#5794f2", wordBreak: "break-all" }}>{row.sample_url || "N/A"}</span>
                    </div>
                    <div style={{ gridColumn: "1 / -1" }}>
                      <span style={{ color: T.dim }}>Operation ID: </span>
                      <span style={{ color: T.text, fontFamily: "monospace", fontSize: 10 }}>{row.sample_operationId || "N/A"}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

// ── Main Export ───────────────────────────────────────────────────────────────
export default function OutageDetectionPanel({ range, startDate, endDate }) {
  const { T } = useTheme();
  // Lifted state: drill-down data shared between ErrorBurstTimeline and DrillDownPanel
  const [committed, setCommitted]     = useState(null);   // { ts1, ts2, l1, l2 }
  const [drillData, setDrillData]     = useState(null);
  const [drillLoading, setDrillLoading] = useState(false);

  const handleDrillResult = useCallback(({ ts1, ts2, l1, l2 }) => {
    setCommitted({ ts1, ts2, l1, l2 });
    setDrillData(null);
    setDrillLoading(true);
    axios.get(API_ENDPOINTS.topApisInWindow(ts1, ts2))
      .then(r => setDrillData(r.data))
      .catch(() => setDrillData(null))
      .finally(() => setDrillLoading(false));
  }, []);

  const handleReset = useCallback(() => {
    setCommitted(null);
    setDrillData(null);
    setDrillLoading(false);
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>

      {/* Section header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
        <div style={{ flex: 1, height: 1, background: T.border }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: "#f2495c", letterSpacing: "0.08em", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 6 }}>
          <span className="pulse-dot" style={{ background: "#f2495c", width: 6, height: 6 }} />
          Outage Detection Zone
        </span>
        <div style={{ flex: 1, height: 1, background: T.border }} />
      </div>

      {/* Row 1: Spike Detector | Error Burst Timeline */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: 8 }}>
        <SpikeDetector />
        <ErrorBurstTimeline
          range={range}
          committed={committed}
          drillLoading={drillLoading}
          drillData={drillData}
          onDrillResult={handleDrillResult}
          onReset={handleReset}
        />
      </div>

      {/* Full width: DrillDownPanel (only when drillData && committed) */}
      {drillData && committed && (
        <DrillDownPanel
          committed={committed}
          drillData={drillData}
          drillLoading={drillLoading}
        />
      )}

      {/* Row 2: Percentile Heatmap | Top Failing URLs */}
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 8 }}>
        <PercentileHeatmap range={range} startDate={startDate} endDate={endDate} />
        <TopFailingUrls range={range} startDate={startDate} endDate={endDate} />
      </div>

    </div>
  );
}
