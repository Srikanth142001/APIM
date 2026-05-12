import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { API_ENDPOINTS } from "../../config/apiConfig";
import { useTheme } from "../../context/ThemeContext";
import { FaDownload, FaChevronLeft, FaChevronRight, FaArrowUp, FaArrowDown, FaSpinner, FaCalendarAlt } from "react-icons/fa";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import DateRangePicker from "./DateRangePicker";

function Delta({ value, pct, unit = "" }) {
  const { T } = useTheme();
  if (value === null || value === undefined) return <span style={{ fontSize: 10, color: T.dim }}>N/A</span>;
  if (value === 0) return <span style={{ fontSize: 10, color: T.dim }}>—</span>;
  const worse = value > 0;
  const color = worse ? "#f2495c" : "#73bf69";
  const Icon = worse ? FaArrowUp : FaArrowDown;
  const showPct = pct !== null && pct !== undefined && Math.abs(pct) < 9999;
  return (
    <span style={{ fontSize: 10, color, display: "flex", alignItems: "center", gap: 2, fontWeight: 600 }}>
      <Icon style={{ fontSize: 8 }} />
      {Math.abs(value).toLocaleString()}{unit}
      {showPct && <span style={{ opacity: 0.7 }}>({Math.abs(pct)}%)</span>}
    </span>
  );
}

function getCodeColor(code) {
  const c = String(code);
  if (c.startsWith("5")) return "#f2495c";
  if (c.startsWith("4")) return "#f5a623";
  if (c.startsWith("2")) return "#73bf69";
  return "#5794f2";
}

function ExpandedDetail({ row, range, startDate, endDate, compareStart, compareEnd }) {
  const { T, themeKey } = useTheme();
  const isLight = themeKey === "light";
  const TT = { contentStyle: { background: T.panel, border: `1px solid ${T.border2}`, borderRadius: 4, fontSize: 11 } };
  const gridStroke = isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.04)";
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    axios.get(API_ENDPOINTS.highFailureApisDetail(row.operation_Name, range, startDate, endDate, compareStart, compareEnd))
      .then(r => setDetail(r.data))
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, [row.operation_Name, range, startDate, endDate, compareStart, compareEnd]);

  const failChange = (row.err_rate_delta ?? 0) > 0 ? "worse" : (row.err_rate_delta ?? 0) < 0 ? "better" : "same";

  return (
    <div style={{ padding: "14px 16px", background: T.bg, borderTop: `1px solid ${T.border}` }}>
      {/* Top panels — side-by-side comparison */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 0.7fr", gap: 10, marginBottom: 12 }}>

        {/* TODAY vs DAY-1 comparison card */}
        <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 4, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", background: T.surface, borderBottom: `1px solid ${T.border}` }}>
            <div style={{ padding: "6px 12px", fontSize: 9, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Metric</div>
            <div style={{ padding: "6px 12px", fontSize: 9, fontWeight: 700, color: T.blue, textTransform: "uppercase", letterSpacing: "0.06em", borderLeft: `1px solid ${T.border}` }}>▶ Today</div>
            <div style={{ padding: "6px 12px", fontSize: 9, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.06em", borderLeft: `1px solid ${T.border}` }}>◀ Day -1</div>
          </div>
          {[
            {
              label: "Error Rate %",
              today: `${row.error_rate}%`,
              todayColor: row.error_rate >= 50 ? "#f2495c" : row.error_rate >= 20 ? "#f5a623" : "#73bf69",
              day1: row.day1_error_rate !== null && row.day1_error_rate !== undefined ? `${row.day1_error_rate}%` : null,
              day1Color: T.muted,
              delta: row.err_rate_delta,
              deltaPct: row.err_rate_delta_pct,
              deltaUnit: "pp",
            },
            {
              label: "Avg RT",
              today: `${row.avg_rt}ms`,
              todayColor: row.avg_rt > 2000 ? "#f2495c" : row.avg_rt > 1000 ? "#f5a623" : T.text,
              day1: row.day1_avg_rt !== null && row.day1_avg_rt !== undefined ? `${row.day1_avg_rt}ms` : null,
              day1Color: T.muted,
              delta: row.rt_delta,
              deltaPct: row.rt_delta_pct,
              deltaUnit: "ms",
            },
            {
              label: "Total Requests",
              today: row.total_requests.toLocaleString(),
              todayColor: T.text,
              day1: detail?.day1Summary?.total != null && detail.day1Summary.total > 0
                ? detail.day1Summary.total.toLocaleString()
                : null,
              day1Color: T.muted,
              delta: null,
            },
            {
              label: "Failures",
              today: row.failure_count.toLocaleString(),
              todayColor: "#f2495c",
              day1: loading ? "..." : detail?.day1Summary?.failures != null ? detail.day1Summary.failures.toLocaleString() : null,
              day1Color: T.muted,
              delta: null,
            },
          ].map(({ label, today, todayColor, day1, day1Color, delta, deltaPct, deltaUnit }) => (
            <div key={label} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", borderBottom: `1px solid ${T.bg}` }}>
              <div style={{ padding: "7px 12px", fontSize: 11, color: T.muted }}>{label}</div>
              <div style={{ padding: "7px 12px", fontSize: 12, fontWeight: 700, color: todayColor, borderLeft: `1px solid ${T.border}` }}>{today}</div>
              <div style={{ padding: "7px 12px", borderLeft: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: day1 ? day1Color : T.dim }}>{day1 ?? "N/A"}</span>
                {delta !== null && delta !== undefined && (
                  <Delta value={delta} pct={deltaPct} unit={deltaUnit} />
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Verdict */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {!loading && !error && (
            <div style={{ padding: "10px 12px", borderRadius: 4,
              background: failChange === "worse" ? "rgba(242,73,92,0.08)" : failChange === "better" ? "rgba(115,191,105,0.08)" : "rgba(87,148,242,0.08)",
              border: `1px solid ${failChange === "worse" ? "rgba(242,73,92,0.25)" : failChange === "better" ? "rgba(115,191,105,0.25)" : "rgba(87,148,242,0.25)"}`,
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: failChange === "worse" ? "#f2495c" : failChange === "better" ? "#73bf69" : "#5794f2", marginBottom: 4 }}>
                {failChange === "worse" ? "📈 Worse than yesterday" : failChange === "better" ? "📉 Better than yesterday" : "➡ Same as yesterday"}
              </div>
              {row.day1_error_rate !== null && row.day1_error_rate !== undefined ? (
                <div style={{ fontSize: 11, color: T.muted }}>
                  Error rate: <strong style={{ color: T.text }}>{row.error_rate}%</strong> today vs <strong style={{ color: T.muted }}>{row.day1_error_rate}%</strong> yesterday
                  {row.err_rate_delta !== 0 && (
                    <span style={{ marginLeft: 6, color: failChange === "worse" ? "#f2495c" : "#73bf69", fontWeight: 700 }}>
                      ({row.err_rate_delta > 0 ? "+" : ""}{row.err_rate_delta}pp)
                    </span>
                  )}
                </div>
              ) : (
                <div style={{ fontSize: 11, color: T.dim }}>No day-1 data available for comparison</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Result code breakdown + hourly trend */}
      {loading ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: T.muted, fontSize: 12, padding: "12px 0" }}>
          <FaSpinner style={{ animation: "spin 1s linear infinite" }} /> Loading result code breakdown...
        </div>
      ) : error ? (
        <div style={{ color: "#f2495c", fontSize: 12, padding: "8px 0" }}>⚠ Failed to load detail: {error}</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {/* Result code grouped bar chart — Today vs Day-1 */}
          <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 4, padding: "12px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Failures by Result Code
              </div>
              <div style={{ display: "flex", gap: 10, fontSize: 10 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 4, color: T.blue }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: T.blue, display: "inline-block" }} /> Today
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 4, color: T.muted }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: T.dim, border: `1px dashed ${T.muted}`, display: "inline-block" }} /> Day-1
                </span>
              </div>
            </div>
            {detail?.resultCodeBreakdown?.length > 0 ? (() => {
              // Merge today + day-1 into grouped data
              const allCodes = [...new Set([
                ...detail.resultCodeBreakdown.map(d => d.code),
                ...(detail.day1CodeBreakdown || []).map(d => d.code),
              ])].slice(0, 8);

              const day1Map = new Map((detail.day1CodeBreakdown || []).map(d => [d.code, d.count]));
              const todayMap = new Map(detail.resultCodeBreakdown.map(d => [d.code, d.count]));

              const chartData = allCodes.map(code => ({
                code,
                today:  todayMap.get(code) || 0,
                day1:   day1Map.get(code)   || 0,
                color:  getCodeColor(code),
              })).sort((a, b) => b.today - a.today);

              const maxVal = Math.max(...chartData.map(d => Math.max(d.today, d.day1)), 1);

              return (
                <>
                  {/* Custom grouped bar rows */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {chartData.map(({ code, today, day1, color }) => {
                      const todayPct = row.failure_count > 0 ? ((today / row.failure_count) * 100).toFixed(1) : 0;
                      const delta = today - day1;
                      const hasDay1 = day1 > 0;
                      return (
                        <div key={code}>
                          {/* Code label + counts */}
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color, minWidth: 36 }}>{code}</span>
                            <div style={{ display: "flex", gap: 12, fontSize: 10 }}>
                              <span style={{ color: T.blue }}>Today: <strong style={{ color }}>{today.toLocaleString()}</strong> ({todayPct}%)</span>
                              <span style={{ color: T.muted }}>Day-1: <strong style={{ color: hasDay1 ? T.muted : T.dim }}>{hasDay1 ? day1.toLocaleString() : "N/A"}</strong></span>
                              {hasDay1 && (
                                <span style={{ color: delta > 0 ? "#f2495c" : delta < 0 ? "#73bf69" : T.dim, fontWeight: 700 }}>
                                  {delta > 0 ? "↑" : delta < 0 ? "↓" : "="}{Math.abs(delta).toLocaleString()}
                                </span>
                              )}
                            </div>
                          </div>
                          {/* Today bar */}
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                            <span style={{ fontSize: 9, color: "#5794f2", width: 28, textAlign: "right", flexShrink: 0 }}>Now</span>
                            <div style={{ flex: 1, height: 12, background: "rgba(255,255,255,0.04)", borderRadius: 2, overflow: "hidden" }}>
                              <div style={{ height: "100%", width: `${(today / maxVal) * 100}%`, background: color, borderRadius: 2, transition: "width 0.4s ease", minWidth: today > 0 ? 2 : 0 }} />
                            </div>
                            <span style={{ fontSize: 9, color, fontWeight: 700, width: 40, flexShrink: 0 }}>{today.toLocaleString()}</span>
                          </div>
                          {/* Day-1 bar */}
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: 9, color: T.dim, width: 28, textAlign: "right", flexShrink: 0 }}>D-1</span>
                            <div style={{ flex: 1, height: 8, background: isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.04)", borderRadius: 2, overflow: "hidden" }}>
                              {hasDay1 ? (
                                <div style={{ height: "100%", width: `${(day1 / maxVal) * 100}%`, background: T.dim, borderRadius: 2, transition: "width 0.4s ease", minWidth: 2 }} />
                              ) : (
                                <div style={{ height: "100%", display: "flex", alignItems: "center", paddingLeft: 4 }}>
                                  <span style={{ fontSize: 8, color: T.dim }}>no data</span>
                                </div>
                              )}
                            </div>
                            <span style={{ fontSize: 9, color: T.dim, width: 40, flexShrink: 0 }}>{hasDay1 ? day1.toLocaleString() : "—"}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              );
            })() : (
              <div style={{ color: T.dim, fontSize: 11, padding: "8px 0" }}>No failure result codes found</div>
            )}
          </div>

          {/* Hourly trend */}
          <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 4, padding: "12px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>Hourly Error Rate & Avg RT</div>
            {detail?.hourlyTrend?.length > 0 ? (
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={detail.hourlyTrend} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="errGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f2495c" stopOpacity={0.4} />
                      <stop offset="90%" stopColor="#f2495c" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="rtGrad2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#5794f2" stopOpacity={0.3} />
                      <stop offset="90%" stopColor="#5794f2" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 4" stroke={gridStroke} vertical={false} />
                  <XAxis dataKey="time" tick={{ fontSize: 9, fill: T.muted }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis yAxisId="err" tick={{ fontSize: 9, fill: T.muted }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} width={32} />
                  <YAxis yAxisId="rt" orientation="right" tick={{ fontSize: 9, fill: T.muted }} axisLine={false} tickLine={false} tickFormatter={v => `${v}ms`} width={40} />
                  <Tooltip {...TT} formatter={(v, n) => [n === "error_rate" ? `${v}%` : `${v}ms`, n === "error_rate" ? "Error Rate" : "Avg RT"]} />
                  <Area yAxisId="err" type="monotone" dataKey="error_rate" stroke="#f2495c" strokeWidth={2} fill="url(#errGrad)" isAnimationActive={false} dot={false} />
                  <Area yAxisId="rt"  type="monotone" dataKey="avg_rt"     stroke="#5794f2" strokeWidth={1.5} fill="url(#rtGrad2)" isAnimationActive={false} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ color: T.dim, fontSize: 11, padding: "8px 0" }}>No hourly data available</div>
            )}
          </div>
        </div>
      )}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function HighFailureApisTable({ range, startDate, endDate }) {
  const { T, themeKey } = useTheme();
  const isLight = themeKey === "light";
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState("failure_count");
  const [sortDir, setSortDir] = useState("desc");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [pageSize, setPageSize] = useState(10);
  const [compareLabel, setCompareLabel] = useState("day-1");

  // Compare period state — "day-1" (default) or "custom"
  const [compareMode, setCompareMode] = useState("day-1");
  const [compareStart, setCompareStart] = useState("");
  const [compareEnd, setCompareEnd] = useState("");
  const [showComparePicker, setShowComparePicker] = useState(false);
  const [pickerDates, setPickerDates] = useState({ startDate: null, endDate: null });
  const comparePickerRef = useRef(null);

  // Close picker on outside click
  useEffect(() => {
    const handler = (e) => {
      if (comparePickerRef.current && !comparePickerRef.current.contains(e.target)) {
        setShowComparePicker(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Effective compare params passed to API
  const effectiveCompare = compareMode === "custom" && compareStart && compareEnd
    ? { compareStart, compareEnd }
    : {};

  // Human-readable compare label for column header
  const compareColLabel = compareMode === "custom" && compareStart && compareEnd
    ? `${new Date(compareStart).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} → ${new Date(compareEnd).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}`
    : "Yesterday";

  useEffect(() => {
    setLoading(true); setSearch(""); setPage(1); setExpanded(null);
    axios.get(API_ENDPOINTS.highFailureApis(range, startDate, endDate, effectiveCompare.compareStart, effectiveCompare.compareEnd))
      .then(r => { setData(r.data?.data || []); setCompareLabel(r.data?.compareLabel || "day-1"); })
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [range, startDate, endDate, effectiveCompare.compareStart, effectiveCompare.compareEnd]);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
    setPage(1);
  };

  const sorted = [...data]
    .filter(d => !search || d.operation_Name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      let aVal = a[sortKey];
      let bVal = b[sortKey];
      
      // Handle null/undefined — push to bottom regardless of sort direction
      const aIsNull = aVal === null || aVal === undefined;
      const bIsNull = bVal === null || bVal === undefined;
      if (aIsNull && bIsNull) return 0;
      if (aIsNull) return 1;  // a goes to bottom
      if (bIsNull) return -1; // b goes to bottom
      
      const dir = sortDir === "asc" ? 1 : -1;
      if (typeof aVal === "number" && typeof bVal === "number") {
        return (aVal - bVal) * dir;
      }
      return String(aVal).localeCompare(String(bVal)) * dir;
    });

  const totalPages = Math.ceil(sorted.length / pageSize);
  const paged = sorted.slice((page - 1) * pageSize, page * pageSize);

  const downloadCSV = () => {
    const headers = ["API Name","Total Requests","Failures","Error Rate %","Avg RT (ms)","Day-1 Error Rate %","Day-1 RT (ms)","Err Rate Delta (pp)","RT Delta (ms)","Result Codes","First Seen","Last Seen"];
    const rows = sorted.map(d => [d.operation_Name,d.total_requests,d.failure_count,d.error_rate,d.avg_rt,d.day1_error_rate??0,d.day1_avg_rt??0,d.err_rate_delta??0,d.rt_delta??0,d.result_codes,d.first_seen||"",d.last_seen||""]);
    const csv = [headers,...rows].map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob([csv],{type:"text/csv"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href=url; a.download=`high-failure-apis-${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const COLS = [
    { key: "operation_Name",    label: "API Name",        w: "22%" },
    { key: "total_requests",    label: "Total Req",       w: "9%"  },
    { key: "failure_count",     label: "Failures",        w: "9%"  },
    { key: "error_rate",        label: "Err Rate %",      w: "8%"  },
    { key: "avg_rt",            label: "Avg RT",          w: "8%"  },
    { key: "day1_error_rate",   label: "Day-1 Err %",     w: "9%"  },
    { key: "day1_avg_rt",       label: "Day-1 RT",        w: "8%"  },
    { key: "err_rate_delta",    label: "Err Rate Δ",      w: "13%" },
    { key: "rt_delta",          label: "RT Δ",            w: "14%" },
  ];

  return (
    <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 4, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: `1px solid ${T.border}`, background: T.surface }}>
        <span style={{ width: 3, height: 16, borderRadius: 2, background: T.red, flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>High Failure APIs</span>
        <span style={{ fontSize: 11, color: T.muted, background: T.border, padding: "1px 7px", borderRadius: 3, border: `1px solid ${T.border2}` }}>{sorted.length} APIs</span>
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); setExpanded(null); }}
          placeholder="Search API name..."
          style={{ flex: 1, maxWidth: 300, background: T.surface, border: `1px solid ${T.border2}`, borderRadius: 3, color: T.text, fontSize: 12, padding: "5px 10px", outline: "none" }}
          onFocus={e => e.target.style.borderColor=T.blue} onBlur={e => e.target.style.borderColor=T.border2} />
        <span style={{ fontSize: 10, color: T.dim, marginLeft: "auto", flexShrink: 0 }}>↕ Click row for details</span>
        <button onClick={downloadCSV} disabled={!data.length}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", background: "rgba(87,148,242,0.1)", border: "1px solid rgba(87,148,242,0.3)", borderRadius: 3, color: T.blue, fontSize: 11, fontWeight: 600, cursor: data.length ? "pointer" : "not-allowed", opacity: data.length ? 1 : 0.5, flexShrink: 0 }}>
          <FaDownload style={{ fontSize: 10 }} /> CSV
        </button>
      </div>

      {/* Compare period selector */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderBottom: `1px solid ${T.border}`, background: T.bg }}>
        <span style={{ fontSize: 10, color: T.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", flexShrink: 0 }}>◀ Compare with:</span>
        <div style={{ display: "flex", background: T.surface, border: `1px solid ${T.border2}`, borderRadius: 3, overflow: "hidden" }}>
          <button onClick={() => { setCompareMode("day-1"); setCompareStart(""); setCompareEnd(""); setPickerDates({ startDate: null, endDate: null }); setShowComparePicker(false); }}
            style={{ padding: "4px 12px", background: compareMode === "day-1" ? "rgba(87,148,242,0.2)" : "transparent", border: "none", color: compareMode === "day-1" ? T.blue : T.muted, fontSize: 11, fontWeight: compareMode === "day-1" ? 700 : 400, cursor: "pointer" }}>
            Day -1 (Yesterday)
          </button>
          <button onClick={() => { setCompareMode("custom"); setShowComparePicker(v => !v); }}
            style={{ padding: "4px 12px", background: compareMode === "custom" ? "rgba(87,148,242,0.2)" : "transparent", border: "none", color: compareMode === "custom" ? T.blue : T.muted, fontSize: 11, fontWeight: compareMode === "custom" ? 700 : 400, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
            <FaCalendarAlt style={{ fontSize: 10 }} />
            Custom Period
          </button>
        </div>

        {/* Active compare label */}
        {compareMode === "custom" && compareStart && compareEnd ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11, color: "#5794f2", background: "rgba(87,148,242,0.1)", padding: "3px 10px", borderRadius: 3, border: "1px solid rgba(87,148,242,0.25)", fontWeight: 600 }}>
              📅 {compareColLabel}
            </span>
            <button onClick={() => { setCompareStart(""); setCompareEnd(""); setPickerDates({ startDate: null, endDate: null }); setCompareMode("day-1"); }}
              style={{ padding: "3px 8px", background: "rgba(242,73,92,0.1)", border: "1px solid rgba(242,73,92,0.3)", borderRadius: 3, color: "#f2495c", fontSize: 11, cursor: "pointer" }}>
              ✕ Clear
            </button>
          </div>
        ) : compareMode === "day-1" ? (
          <span style={{ fontSize: 10, color: T.dim }}>Comparing against same window yesterday</span>
        ) : (
          <span style={{ fontSize: 10, color: T.orange }}>Select a date range to compare</span>
        )}

        {/* DateRangePicker dropdown */}
        {compareMode === "custom" && showComparePicker && (
          <div ref={comparePickerRef} style={{ position: "absolute", top: "auto", zIndex: 1000, marginTop: 4 }}>
            <DateRangePicker
              startDate={pickerDates.startDate}
              endDate={pickerDates.endDate}
              onChange={({ startDate, endDate }) => setPickerDates({ startDate, endDate })}
              onApply={(start, end) => {
                setCompareStart(start);
                setCompareEnd(end);
                setShowComparePicker(false);
                setPage(1);
                setExpanded(null);
              }}
              onClear={() => { setPickerDates({ startDate: null, endDate: null }); setCompareStart(""); setCompareEnd(""); }}
            />
          </div>
        )}
      </div>

      <div style={{ overflowX: "auto" }}>
        {loading ? (
          <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 5 }}>
            {Array(6).fill(0).map((_, i) => <div key={i} className="gf-skeleton" style={{ height: 36 }} />)}
          </div>
        ) : !sorted.length ? (
          <div style={{ padding: "40px", textAlign: "center", color: T.muted, fontSize: 12 }}>
            {search ? `No APIs matching "${search}"` : "✅ No failures in selected range"}
          </div>
        ) : (
          <>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr style={{ background: T.bg }}>
                  <th colSpan={5} style={{ padding: "5px 10px 2px", textAlign: "left", borderBottom: `1px solid ${T.border}`, borderRight: `2px solid ${T.border2}` }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: T.blue, textTransform: "uppercase", letterSpacing: "0.08em" }}>▶ TODAY (Current Period)</span>
                  </th>
                  <th colSpan={2} style={{ padding: "5px 10px 2px", textAlign: "left", borderBottom: `1px solid ${T.border}`, borderRight: `2px solid ${T.border2}` }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>◀ DAY -1 ({compareColLabel.toUpperCase()})</span>
                  </th>
                  <th colSpan={2} style={{ padding: "5px 10px 2px", textAlign: "left", borderBottom: `1px solid ${T.border}` }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: T.orange, textTransform: "uppercase", letterSpacing: "0.08em" }}>Δ CHANGE</span>
                  </th>
                </tr>
                <tr style={{ background: T.bg, borderBottom: `2px solid ${T.border}` }}>
                  {[
                    { key: "operation_Name", label: "API Name",     w: "22%", border: false },
                    { key: "total_requests", label: "Total Req",    w: "9%",  border: false },
                    { key: "failure_count",  label: "Failures",     w: "9%",  border: false },
                    { key: "error_rate",     label: "Err Rate %",   w: "8%",  border: false },
                    { key: "avg_rt",         label: "Avg RT",       w: "8%",  border: true  },
                    { key: "day1_error_rate",label: "Err Rate %",   w: "9%",  border: false },
                    { key: "day1_avg_rt",    label: "Avg RT",       w: "8%",  border: true  },
                    { key: "err_rate_delta", label: "Err Rate Δ",   w: "13%", border: false },
                    { key: "rt_delta",       label: "RT Δ",         w: "14%", border: false },
                  ].map(({ key, label, w, border }) => (
                    <th key={key} onClick={() => handleSort(key)}
                      style={{ padding: "6px 10px", textAlign: "left", color: sortKey === key ? T.blue : T.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", fontSize: 9, cursor: "pointer", userSelect: "none", width: w, whiteSpace: "nowrap", borderRight: border ? `2px solid ${T.border2}` : "none" }}>
                      {label}{sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paged.map((row, i) => {
                  const isOpen = expanded === row.operation_Name;
                  return (
                    <>
                      <tr key={row.operation_Name}
                        onClick={() => setExpanded(isOpen ? null : row.operation_Name)}
                        style={{ borderBottom: isOpen ? "none" : `1px solid ${T.border}`, background: isOpen ? T.surface : i % 2 === 0 ? T.panel : T.surface, cursor: "pointer" }}>
                        <td style={{ padding: "10px 10px", color: T.text, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 0 }} title={row.operation_Name}>
                          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ color: T.dim, fontSize: 9, flexShrink: 0 }}>{isOpen ? "▼" : "▶"}</span>
                            {row.operation_Name}
                          </span>
                        </td>
                        <td style={{ padding: "10px 10px", color: T.text }}>{row.total_requests.toLocaleString()}</td>
                        <td style={{ padding: "10px 10px", color: "#f2495c", fontWeight: 700 }}>{row.failure_count.toLocaleString()}</td>
                        <td style={{ padding: "10px 10px", fontWeight: 700, color: row.error_rate >= 50 ? "#f2495c" : row.error_rate >= 20 ? "#f5a623" : "#73bf69" }}>{row.error_rate}%</td>
                        <td style={{ padding: "10px 10px", color: row.avg_rt > 2000 ? "#f2495c" : row.avg_rt > 1000 ? "#f5a623" : T.text, borderRight: `2px solid ${T.border2}` }}>{row.avg_rt}ms</td>
                        <td style={{ padding: "10px 10px", color: T.muted }}>
                          {row.day1_error_rate !== null && row.day1_error_rate !== undefined ? `${row.day1_error_rate}%` : <span style={{ color: T.dim }}>N/A</span>}
                        </td>
                        <td style={{ padding: "10px 10px", color: T.muted, borderRight: `2px solid ${T.border2}` }}>
                          {row.day1_avg_rt !== null && row.day1_avg_rt !== undefined ? `${row.day1_avg_rt}ms` : <span style={{ color: T.dim }}>N/A</span>}
                        </td>
                        <td style={{ padding: "10px 10px" }}>
                          <Delta value={row.err_rate_delta} pct={row.err_rate_delta_pct} unit="pp" />
                        </td>
                        <td style={{ padding: "10px 10px" }}>
                          <Delta value={row.rt_delta} pct={row.rt_delta_pct} unit="ms" />
                        </td>
                      </tr>
                      {isOpen && (
                        <tr key={`${row.operation_Name}-detail`} style={{ borderBottom: `1px solid ${T.border}` }}>
                          <td colSpan={COLS.length} style={{ padding: 0 }}>
                            <ExpandedDetail row={row} range={range} startDate={startDate} endDate={endDate} compareStart={effectiveCompare.compareStart} compareEnd={effectiveCompare.compareEnd} />
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>

            {sorted.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderTop: `1px solid ${T.border}`, background: T.bg }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, color: T.muted }}>Rows per page:</span>
                  <div style={{ display: "flex", background: T.surface, border: `1px solid ${T.border2}`, borderRadius: 3, overflow: "hidden" }}>
                    {[10, 25, 50, 100].map(n => (
                      <button key={n} onClick={() => { setPageSize(n); setPage(1); }}
                        style={{ padding: "3px 10px", background: pageSize === n ? "rgba(87,148,242,0.2)" : "transparent", border: "none", color: pageSize === n ? T.blue : T.muted, fontSize: 11, fontWeight: pageSize === n ? 700 : 400, cursor: "pointer" }}>
                        {n}
                      </button>
                    ))}
                  </div>
                  <span style={{ fontSize: 11, color: T.muted }}>{(page-1)*pageSize+1}–{Math.min(page*pageSize, sorted.length)} of {sorted.length}</span>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1}
                    style={{ padding: "4px 10px", background: page===1 ? T.border : "rgba(87,148,242,0.1)", border: `1px solid ${T.border2}`, borderRadius: 3, color: page===1 ? T.dim : T.blue, fontSize: 11, cursor: page===1 ? "not-allowed" : "pointer" }}>
                    <FaChevronLeft style={{ fontSize: 9 }} />
                  </button>
                  <span style={{ padding: "4px 12px", background: T.border, border: `1px solid ${T.border2}`, borderRadius: 3, color: T.text, fontSize: 11, fontWeight: 600 }}>{page}/{totalPages}</span>
                  <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page===totalPages}
                    style={{ padding: "4px 10px", background: page===totalPages ? T.border : "rgba(87,148,242,0.1)", border: `1px solid ${T.border2}`, borderRadius: 3, color: page===totalPages ? T.dim : T.blue, fontSize: 11, cursor: page===totalPages ? "not-allowed" : "pointer" }}>
                    <FaChevronRight style={{ fontSize: 9 }} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
