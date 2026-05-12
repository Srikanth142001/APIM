import { useEffect, useState, useCallback, useRef } from "react";
import axios from "axios";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid, Cell, LineChart, Line, Legend,
} from "recharts";
import DashboardTable from "../components/DashboardTable";
import { API_ENDPOINTS, API_BASE_URL } from "../config/apiConfig";
import { useTheme } from "../context/ThemeContext";

const getEnvId = () => localStorage.getItem('active_env_id') || '';

export default function ApiAnalyticsPage({ range: rangeProp, startDate: startProp, endDate: endProp }) {
  const { T, themeKey } = useTheme();
  const isLight = themeKey === "light";
  const gridStroke = isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.04)";

  // ── Own range state (standalone page — not receiving props from parent) ──
  const [range, setRange] = useState(rangeProp || '30d');
  const [dateMode, setDateMode] = useState('range');
  const [customStart, setCustomStart] = useState(startProp || '');
  const [customEnd, setCustomEnd] = useState(endProp || '');
  const startDate = dateMode === 'custom' ? customStart : null;
  const endDate   = dateMode === 'custom' ? customEnd   : null;

  const TT = {
    contentStyle: { background: T.panel, border: `1px solid ${T.border2}`, borderRadius: 4, fontSize: 11, padding: "8px 12px" },
    labelStyle: { color: T.muted, fontSize: 10 },
  };

  const Panel = ({ title, color = T.blue, badge, children, minH }) => (
    <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 4, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px", borderBottom: `1px solid ${T.border}`, background: T.surface, minHeight: 36 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 3, height: 16, borderRadius: 2, background: color, flexShrink: 0 }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: T.text }}>{title}</span>
          {badge && <span style={{ fontSize: 10, color: T.muted, background: T.border, padding: "1px 7px", borderRadius: 3, border: `1px solid ${T.border2}` }}>{badge}</span>}
        </div>
      </div>
      <div style={{ padding: "12px 14px", minHeight: minH }}>{children}</div>
    </div>
  );

  const Skeleton = ({ rows = 4 }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {Array(rows).fill(0).map((_, i) => (
        <div key={i} className="gf-skeleton" style={{ height: 14, width: `${60 + (i * 13) % 35}%` }} />
      ))}
    </div>
  );
  const [topApis, setTopApis] = useState([]);
  const [failures, setFailures] = useState([]);
  const [requestRate, setRequestRate] = useState({ today: [], yesterday: [] });
  const [responseCompare, setResponseCompare] = useState([]);
  const [percentiles, setPercentiles] = useState([]);
  const [exceptions, setExceptions] = useState([]);
  const [failureDiffs, setFailureDiffs] = useState([]);
  const [failureCodes, setFailureCodes] = useState([]);
  const [loading, setLoading] = useState(true);

  // ── Watchlist ─────────────────────────────────────────────────────────────
  const WATCH_KEY = 'api_watchlist_v1';
  const [watchlist,    setWatchlist]    = useState(() => { try { return JSON.parse(localStorage.getItem(WATCH_KEY) || '[]'); } catch { return []; } });
  const [watchData,    setWatchData]    = useState({});
  const [watchLoading, setWatchLoading] = useState({});
  const [watchInput,   setWatchInput]   = useState('');
  const [watchSuggest, setWatchSuggest] = useState([]);
  const [watchSearching, setWatchSearching] = useState(false);
  const [expandedRow,  setExpandedRow]  = useState(null);
  const suggestRef = useRef(null);
  const searchDebounceRef = useRef(null);

  const saveWatchlist = (list) => { setWatchlist(list); localStorage.setItem(WATCH_KEY, JSON.stringify(list)); };
  const addWatch  = (name) => { if (!name || watchlist.includes(name)) return; saveWatchlist([...watchlist, name]); setWatchInput(''); setWatchSuggest([]); };
  const removeWatch = (name) => { saveWatchlist(watchlist.filter(w => w !== name)); if (expandedRow === name) setExpandedRow(null); };

  const fetchWatchItem = useCallback(async (opName) => {
    setWatchLoading(p => ({ ...p, [opName]: true }));
    try {
      const p = new URLSearchParams({ operation: opName });
      if (startDate && endDate) { p.append('startDate', startDate); p.append('endDate', endDate); }
      else p.append('range', range);
      const r = await axios.get(`${API_BASE_URL}/api/${getEnvId()}/performance/detail?${p}`);
      setWatchData(p2 => ({ ...p2, [opName]: r.data }));
    } catch (e) { console.error(e); }
    finally { setWatchLoading(p => ({ ...p, [opName]: false })); }
  }, [range, startDate, endDate]);

  useEffect(() => { watchlist.forEach(op => fetchWatchItem(op)); }, [range, startDate, endDate, watchlist.length]); // eslint-disable-line

  useEffect(() => {
    const h = (e) => { if (suggestRef.current && !suggestRef.current.contains(e.target)) setWatchSuggest([]); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const handleWatchInput = (val) => {
    setWatchInput(val);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

    if (!val.trim()) {
      setWatchSuggest([]);
      setWatchSearching(false);
      return;
    }

    // Show searching state immediately
    setWatchSearching(true);

    // Debounce 350ms then query the backend
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const url = API_ENDPOINTS.apiSearch(getEnvId(), val.trim(), range);
        const r = await axios.get(url);
        // results is [{ operation_Name, total, ... }] — extract the name string
        const results = (r.data.results || [])
          .map(item => typeof item === 'string' ? item : item.operation_Name)
          .filter(n => n && !watchlist.includes(n));
        setWatchSuggest(results);
      } catch {
        setWatchSuggest([]);
      } finally {
        setWatchSearching(false);
      }
    }, 350);
  };

  const exportWatchCsv = () => {
    const rows = [['API','Total','Success','Failed','Avg RT(ms)','Min RT','Max RT','Status Codes']];
    watchlist.forEach(op => {
      const d = watchData[op]; const s = d?.summary;
      const codes = (d?.statusCodes || []).map(sc => `${sc.code}:${sc.count}`).join(' | ');
      rows.push([`"${op.replace(/"/g,'""')}"`, s?.total??'-', s?.success??'-', s?.failed??'-', s?.avgRt??'-', s?.minRt??'-', s?.maxRt??'-', codes]);
    });
    const blob = new Blob([rows.map(r => r.join(',')).join('\n')], { type: 'text/csv' });
    Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `watchlist-${Date.now()}.csv` }).click();
  };

  const codeCol = (c) => { const s = String(c); return s.startsWith('5') ? '#f2495c' : s.startsWith('4') ? '#f5a623' : s.startsWith('2') ? '#73bf69' : '#5794f2'; };
  const rtCol   = (ms) => ms > 2000 ? '#f2495c' : ms > 1000 ? '#f5a623' : '#73bf69';
  const fmtN    = (n) => { if (n == null || isNaN(n)) return '-'; if (n >= 1e6) return `${(n/1e6).toFixed(1)}M`; if (n >= 1e3) return `${(n/1e3).toFixed(1)}K`; return String(Math.round(n)); };

  useEffect(() => {
    setLoading(true);
    const sd = startDate || null, ed = endDate || null;
    const envId = getEnvId();
    if (!envId) { setLoading(false); return; }
    Promise.allSettled([
      axios.get(API_ENDPOINTS.topApis(envId, range, sd, ed)),
      axios.get(API_ENDPOINTS.failures(envId, range, sd, ed)),
      axios.get(API_ENDPOINTS.requestRate(envId, range, sd, ed)),
      axios.get(API_ENDPOINTS.responseCompare(envId, range, sd, ed)),  // response time compare
      Promise.resolve({ data: [] }),  // responsePercentiles (not in new backend)
      Promise.resolve({ data: { increasedBy30Percent: [] } }),       // exceptions
      Promise.resolve({ data: [] }),  // failureDiffs
      axios.get(API_ENDPOINTS.failureCodes(envId, range)),
    ]).then(([a, b, c, d, e, f, g, h]) => {
      if (a.status === "fulfilled") setTopApis(a.value.data || []);
      if (b.status === "fulfilled") setFailures(b.value.data || []);
      if (c.status === "fulfilled") setRequestRate(c.value.data || { today: [], yesterday: [] });
      if (d.status === "fulfilled") setResponseCompare(d.value.data || []);
      if (e.status === "fulfilled") setPercentiles(e.value.data || []);
      if (f.status === "fulfilled") setExceptions(f.value.data?.increasedBy30Percent || []);
      if (g.status === "fulfilled") setFailureDiffs(g.value.data || []);
      if (h.status === "fulfilled") {
        const raw = h.value.data || [];
        const mapped = Array.isArray(raw)
          ? raw.map(r => ({ code: String(r.statusCode || r.resultCode || r.code || ""), count: r.count || 0 }))
               .filter(r => r.code && r.count > 0)
               .sort((a, b) => b.count - a.count)
               .slice(0, 10)
          : [];
        setFailureCodes(mapped);
      }
    }).finally(() => setLoading(false));
  }, [range, startDate, endDate]);

  // Merge request rate
  const maxLen = Math.max(requestRate.today.length, requestRate.yesterday.length);
  const mergedReq = Array.from({ length: maxLen }, (_, i) => ({
    time: requestRate.today[i]?.time || requestRate.yesterday[i]?.time || "",
    Today: requestRate.today[i]?.count,
    Yesterday: requestRate.yesterday[i]?.count,
  }));

  // Merge response compare
  const today = responseCompare.filter(d => d.period === "Today");
  const yesterday = responseCompare.filter(d => d.period === "Yesterday");
  const maxRt = Math.max(today.length, yesterday.length);
  const mergedRt = Array.from({ length: maxRt }, (_, i) => ({
    time: today[i]?.time || yesterday[i]?.time || "",
    Today: today[i]?.value,
    Yesterday: yesterday[i]?.value,
  }));

  const formatCount = v => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1_000 ? `${(v / 1_000).toFixed(1)}K` : v;
  const codeColor = c => ({ "4": "#f5a623", "5": "#f2495c", "2": "#73bf69", "3": "#5794f2" }[String(c)[0]] || "#8e8e8e");

  return (
    <div style={{ background: T.bg, minHeight: "100vh", color: T.text, fontFamily: "Inter, Segoe UI, system-ui, sans-serif" }}>

      {/* ── Header bar ── */}
      <div style={{ background: T.surface, borderBottom: `1px solid ${T.border}`, padding: "0 16px", height: 48, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>API Analytics</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", background: T.surface, border: `1px solid ${T.border2}`, borderRadius: 3, overflow: "hidden" }}>
            {[["range","Quick"],["custom","Custom"]].map(([m, l]) => (
              <button key={m} onClick={() => setDateMode(m)} style={{ padding: "5px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer", border: "none", background: dateMode === m ? "rgba(87,148,242,0.2)" : "transparent", color: dateMode === m ? T.blue : T.muted }}>
                {l}
              </button>
            ))}
          </div>
          {dateMode === "range" && (
            <select value={range} onChange={e => setRange(e.target.value)} style={{ background: T.surface, border: `1px solid ${T.border2}`, borderRadius: 3, color: T.text, fontSize: 11, padding: "5px 8px", cursor: "pointer", outline: "none" }}>
              {[["10m","10 min"],["30m","30 min"],["1h","1 hour"],["6h","6 hrs"],["12h","12 hrs"],["24h","24 hrs"],["7d","7 days"],["30d","30 days"],["90d","90 days"]].map(([v,l]) => (
                <option key={v} value={v} style={{ background: T.surface }}>{l}</option>
              ))}
            </select>
          )}
          {dateMode === "custom" && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input type="datetime-local" value={customStart} onChange={e => setCustomStart(e.target.value)} style={{ background: T.inputBg, border: `1px solid ${T.border2}`, borderRadius: 3, color: T.text, fontSize: 11, padding: "4px 8px" }} />
              <span style={{ color: T.muted, fontSize: 11 }}>→</span>
              <input type="datetime-local" value={customEnd} onChange={e => setCustomEnd(e.target.value)} style={{ background: T.inputBg, border: `1px solid ${T.border2}`, borderRadius: 3, color: T.text, fontSize: 11, padding: "4px 8px" }} />
            </div>
          )}
          <button onClick={() => { setLoading(true); setTimeout(() => setLoading(false), 100); }} style={{ padding: "5px 12px", background: "rgba(87,148,242,0.12)", border: "1px solid rgba(87,148,242,0.3)", borderRadius: 4, color: T.blue, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
            Refresh
          </button>
        </div>
      </div>

      {/* ── Loading overlay ── */}
      {loading && (
        <div style={{ position: "fixed", inset: 0, zIndex: 999, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(3px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
          <div style={{ width: 48, height: 48, border: "3px solid rgba(255,255,255,0.15)", borderTopColor: T.blue, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>Loading API Analytics...</div>
        </div>
      )}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "16px" }}>

      {/* ── Row 1: Request Volume + Response Time Comparison ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <Panel title="Total Request Volume" color="#73bf69" badge="Today vs Yesterday">
          {loading ? <Skeleton /> : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={mergedReq} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="reqT" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#73bf69" stopOpacity={0.3} /><stop offset="90%" stopColor="#73bf69" stopOpacity={0.02} /></linearGradient>
                  <linearGradient id="reqY" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#5794f2" stopOpacity={0.2} /><stop offset="90%" stopColor="#5794f2" stopOpacity={0.02} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 4" stroke={gridStroke} vertical={false} />
                <XAxis dataKey="time" tick={{ fontSize: 9, fill: T.muted }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 9, fill: T.muted }} axisLine={false} tickLine={false} tickFormatter={formatCount} width={44} />
                <Tooltip {...TT} formatter={(v, n) => [`${formatCount(v)} reqs`, n]} />
                <Legend wrapperStyle={{ fontSize: 10, color: T.muted }} />
                <Area type="monotone" dataKey="Yesterday" stroke="#5794f2" strokeWidth={1.5} strokeDasharray="5 3" fill="url(#reqY)" isAnimationActive={false} dot={false} connectNulls />
                <Area type="monotone" dataKey="Today" stroke="#73bf69" strokeWidth={2} fill="url(#reqT)" isAnimationActive={false} dot={false} connectNulls />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Panel>

        <Panel title="Response Time Comparison" color="#f2495c" badge="Today vs Yesterday">
          {loading ? <Skeleton /> : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={mergedRt} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="rtT" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f2495c" stopOpacity={0.3} /><stop offset="90%" stopColor="#f2495c" stopOpacity={0.02} /></linearGradient>
                  <linearGradient id="rtY" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#5794f2" stopOpacity={0.2} /><stop offset="90%" stopColor="#5794f2" stopOpacity={0.02} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 4" stroke={gridStroke} vertical={false} />
                <XAxis dataKey="time" tick={{ fontSize: 9, fill: T.muted }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 9, fill: T.muted }} axisLine={false} tickLine={false} tickFormatter={v => `${v?.toFixed(0)}ms`} width={48} domain={[0, "auto"]} />
                <Tooltip {...TT} formatter={(v, n) => [`${v?.toFixed(2)} ms`, n]} />
                <Legend wrapperStyle={{ fontSize: 10, color: T.muted }} />
                <Area type="monotone" dataKey="Yesterday" stroke="#5794f2" strokeWidth={1.5} strokeDasharray="5 3" fill="url(#rtY)" isAnimationActive={false} dot={false} connectNulls />
                <Area type="monotone" dataKey="Today" stroke="#f2495c" strokeWidth={2} fill="url(#rtT)" isAnimationActive={false} dot={false} connectNulls />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Panel>
      </div>

      {/* ── Row 2: Top APIs + HTTP Status Codes ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 8 }}>
        <Panel title="Top Success APIs" color="#73bf69">
          {loading ? <Skeleton /> : (
            <DashboardTable title="" data={topApis} columns={[
              { label: "API Name", key: "name", align: "text-left", sortable: true },
              { label: "Count", key: "count", align: "text-center", sortable: true },
              { label: "Avg Time (s)", key: "avg", align: "text-center", sortable: true },
              { label: "Errors", key: "errors", align: "text-center", sortable: true },
              { label: "Success %", key: "success", align: "text-center", sortable: true },
            ]} />
          )}
        </Panel>

        <Panel title="HTTP Status Code Distribution" color="#f5a623">
          {loading ? <Skeleton /> : failureCodes.length === 0 ? (
            <div style={{ color: T.dim, fontSize: 12, textAlign: "center", padding: "20px 0" }}>No failure data</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={failureCodes} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke={gridStroke} vertical={false} />
                  <XAxis dataKey="code" tick={{ fontSize: 10, fill: T.muted }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: T.muted }} axisLine={false} tickLine={false} width={36} />
                  <Tooltip {...TT} formatter={(v, _, p) => [`${v.toLocaleString()}`, `HTTP ${p.payload.code}`]} />
                  <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                    {failureCodes.map((e, i) => <Cell key={i} fill={codeColor(e.code)} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                {failureCodes.slice(0, 6).map(({ code, count }) => (
                  <span key={code} style={{ fontSize: 10, padding: "2px 8px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 3, color: codeColor(code), fontWeight: 700 }}>{code}: {count.toLocaleString()}</span>
                ))}
              </div>
            </>
          )}
        </Panel>
      </div>

      {/* ── Row 3: Failures + Critical APIs ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <Panel title="APIs with >30% Increase in Failures" color="#f2495c" badge="Last 30 min vs Previous">
          {loading ? <Skeleton /> : (
            <DashboardTable title="" data={failureDiffs} columns={[
              { label: "Endpoint", key: "name", align: "text-left", sortable: true },
              { label: "API Name", key: "sample_operationName", align: "text-left", sortable: true },
              { label: "Prev", key: "pastFailures", align: "text-center", sortable: true },
              { label: "Current", key: "currentFailures", align: "text-center", sortable: true },
              { label: "Diff %", key: "diffPercent", align: "text-center", sortable: true },
            ]} />
          )}
        </Panel>

        <Panel title="Top 10 Critical APIs" color="#f5a623" badge="Last 30 min vs Previous">
          {loading ? <Skeleton /> : (
            <DashboardTable title="" data={percentiles} columns={[
              { label: "API Name", key: "operationName", align: "text-left", sortable: true },
              { label: "Prev (ms)", key: "previousAvgResponseTime", align: "text-center", sortable: true },
              { label: "Current (ms)", key: "currentAvgResponseTime", align: "text-center", sortable: true },
              { label: "Count", key: "currentCount", align: "text-center", sortable: true },
              { label: "Diff %", key: "diffPercent", align: "text-center", sortable: true },
            ]} />
          )}
        </Panel>
      </div>

      {/* ── Row 4: APIs with 4sec increase + Recent Failures ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <Panel title="APIs with 4sec+ Response Time Increase" color="#f5a623">
          {loading ? <Skeleton /> : (
            <DashboardTable title="" data={exceptions} columns={[
              { label: "API Name", key: "operation_Name", align: "text-left", sortable: true },
              { label: "Prev Avg", key: "prev_avg_duration", align: "text-center", sortable: true },
              { label: "Curr Avg", key: "curr_avg_duration", align: "text-center", sortable: true },
              { label: "Count", key: "count", align: "text-center", sortable: true },
              { label: "Change %", key: "diff_percent", align: "text-center", sortable: true },
            ]} />
          )}
        </Panel>

        <Panel title="Recent Failures" color="#f2495c">
          {loading ? <Skeleton /> : (
            <DashboardTable title="" data={failures} columns={[
              { label: "API Name", key: "name", align: "text-left", sortable: true },
              { label: "Status", key: "status", align: "text-center", sortable: true },
              { label: "Count", key: "failureCount", align: "text-center", sortable: true },
            ]} />
          )}
        </Panel>
      </div>

      {/* ── Row 5: API Watchlist ── */}
      <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 4, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', borderBottom: `1px solid ${T.border}`, background: T.surface, minHeight: 36 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 3, height: 16, borderRadius: 2, background: '#9b59b6', flexShrink: 0 }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: T.text }}>API Watchlist</span>
            <span style={{ fontSize: 10, color: T.muted, background: T.border, padding: '1px 7px', borderRadius: 3, border: `1px solid ${T.border2}` }}>{watchlist.length} monitored</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {watchlist.length > 0 && (
              <button onClick={exportWatchCsv} style={{ fontSize: 10, padding: '3px 10px', background: 'rgba(115,191,105,0.12)', border: '1px solid rgba(115,191,105,0.4)', color: '#73bf69', cursor: 'pointer', borderRadius: 2 }}>
                Export CSV
              </button>
            )}
            {/* Add API input */}
            <div ref={suggestRef} style={{ position: 'relative' }}>
              <div style={{ display: 'flex', gap: 4 }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <input
                    value={watchInput}
                    onChange={e => handleWatchInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && watchInput.trim()) addWatch(watchInput.trim()); }}
                    placeholder="🔍 Search API name or paste exact name..."
                    style={{ background: T.surface, border: `1px solid ${watchInput.trim() ? '#5794f2' : T.border2}`, padding: '4px 10px', color: T.text, fontSize: 11, width: 320, outline: 'none', borderRadius: 2, transition: 'border-color 0.2s' }}
                  />
                  {watchInput.trim() && (
                    <button onClick={() => { setWatchInput(''); setWatchSuggest([]); }}
                      style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: T.muted, cursor: 'pointer', fontSize: 14, padding: '0 4px', lineHeight: 1 }}>
                      ✕
                    </button>
                  )}
                </div>
                <button onClick={() => addWatch(watchInput.trim())}
                  disabled={!watchInput.trim()}
                  style={{ padding: '4px 14px', background: watchInput.trim() ? 'rgba(87,148,242,0.15)' : 'transparent', border: `1px solid ${watchInput.trim() ? 'rgba(87,148,242,0.4)' : T.border2}`, color: watchInput.trim() ? '#5794f2' : T.dim, cursor: watchInput.trim() ? 'pointer' : 'not-allowed', fontSize: 11, borderRadius: 2, fontWeight: 600, transition: 'all 0.2s' }}>
                  + Add
                </button>
              </div>
              {watchSuggest.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: T.surface, border: `1px solid ${T.border2}`, borderRadius: 2, marginTop: 2, zIndex: 100, boxShadow: '0 4px 16px rgba(0,0,0,0.3)', maxHeight: 280, overflowY: 'auto' }}>
                  <div style={{ padding: '6px 12px', fontSize: 9, color: T.dim, borderBottom: `1px solid ${T.border}`, textTransform: 'uppercase', letterSpacing: '0.06em', background: T.panel, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>{watchSuggest.length} matching API{watchSuggest.length !== 1 ? 's' : ''} found</span>
                    {watchSearching && <span style={{ color: '#5794f2', fontSize: 9 }}>searching...</span>}
                  </div>
                  {watchSuggest.map((s, i) => {
                    const q = watchInput.toLowerCase();
                    const idx = s.toLowerCase().indexOf(q);
                    const before = s.substring(0, idx);
                    const match = s.substring(idx, idx + watchInput.length);
                    const after = s.substring(idx + watchInput.length);
                    
                    return (
                      <div key={i} onClick={() => addWatch(s)}
                        style={{ padding: '8px 12px', fontSize: 11, color: T.text, cursor: 'pointer', borderBottom: i < watchSuggest.length - 1 ? `1px solid ${T.border}` : 'none', display: 'flex', alignItems: 'center', gap: 8 }}
                        onMouseEnter={e => e.currentTarget.style.background = T.panel}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <span style={{ color: '#5794f2', fontSize: 10 }}>→</span>
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {before}<span style={{ background: 'rgba(87,148,242,0.25)', color: '#5794f2', fontWeight: 600 }}>{match}</span>{after}
                        </span>
                      </div>
                    );
                  })}
                  <div onClick={() => addWatch(watchInput.trim())}
                    style={{ padding: '8px 12px', fontSize: 11, color: '#5794f2', cursor: 'pointer', borderTop: `1px solid ${T.border}`, fontWeight: 600, background: T.panel }}
                    onMouseEnter={e => e.currentTarget.style.background = `rgba(87,148,242,0.08)`}
                    onMouseLeave={e => e.currentTarget.style.background = T.panel}>
                    ✓ Add "{watchInput.trim()}" exactly as typed
                  </div>
                </div>
              )}
              {watchSuggest.length === 0 && watchInput.trim().length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: T.surface, border: `1px solid ${T.border2}`, borderRadius: 2, marginTop: 2, zIndex: 100, boxShadow: '0 4px 16px rgba(0,0,0,0.3)' }}>
                  {watchSearching ? (
                    <div style={{ padding: '10px 12px', fontSize: 11, color: T.muted, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: '#5794f2' }}>⟳</span> Searching App Insights...
                    </div>
                  ) : (
                    <>
                      <div style={{ padding: '8px 12px', fontSize: 10, color: T.muted, borderBottom: `1px solid ${T.border}`, background: T.panel }}>
                        No matching APIs found in App Insights
                      </div>
                      <div onClick={() => addWatch(watchInput.trim())}
                        style={{ padding: '10px 12px', fontSize: 11, color: '#5794f2', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}
                        onMouseEnter={e => e.currentTarget.style.background = T.panel}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <span style={{ fontSize: 14 }}>✓</span>
                        <span>Add "{watchInput.trim()}" (press Enter or click)</span>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Watchlist table */}
        {watchlist.length === 0 ? (
          <div style={{ padding: '32px 14px', textAlign: 'center', color: T.muted, fontSize: 12 }}>
            No APIs being monitored. Type an API name above and click Add.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ background: T.surface }}>
                  {['API Name','Total','Success','Failed','Avg RT','Min RT','Max RT','Status Codes',''].map((h, i) => (
                    <th key={i} style={{ padding: '8px 12px', textAlign: i === 0 ? 'left' : i === 7 ? 'left' : 'right', color: T.muted, fontWeight: 500, fontSize: 10, borderBottom: `1px solid ${T.border}`, whiteSpace: 'nowrap', letterSpacing: '0.04em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {watchlist.map((op, idx) => {
                  const d    = watchData[op];
                  const s    = d?.summary;
                  const busy = watchLoading[op];
                  const isExp = expandedRow === op;
                  const codes = d?.statusCodes || [];
                  const successRate = s ? ((s.success / s.total) * 100).toFixed(1) : null;

                  return (
                    <>
                      <tr key={op}
                        style={{ borderBottom: `1px solid ${T.border}`, background: isExp ? `rgba(155,89,182,0.06)` : idx % 2 === 0 ? 'transparent' : `${T.surface}55`, cursor: 'pointer', transition: 'background 0.1s' }}
                        onMouseEnter={e => { if (!isExp) e.currentTarget.style.background = T.panel; }}
                        onMouseLeave={e => { if (!isExp) e.currentTarget.style.background = idx % 2 === 0 ? 'transparent' : `${T.surface}55`; }}>
                        {/* API Name */}
                        <td style={{ padding: '10px 12px', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', borderLeft: `2px solid #9b59b6` }}>
                          <span style={{ color: T.text, fontWeight: 500 }}>{op}</span>
                        </td>
                        {/* Metrics */}
                        {busy ? (
                          <td colSpan={9} style={{ padding: '10px 12px', textAlign: 'center' }}>
                            <span style={{ color: T.muted, fontSize: 10 }}>Loading...</span>
                          </td>
                        ) : (
                          <>
                            <td style={{ padding: '10px 12px', textAlign: 'right', color: T.text, fontVariantNumeric: 'tabular-nums' }}>{fmtN(s?.total)}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                              <span style={{ color: '#73bf69', fontWeight: 600 }}>{fmtN(s?.success)}</span>
                              {successRate && <span style={{ color: T.muted, fontSize: 9, marginLeft: 4 }}>{successRate}%</span>}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                              <span style={{ color: s?.failed > 0 ? '#f2495c' : T.muted, fontWeight: s?.failed > 0 ? 600 : 400 }}>{fmtN(s?.failed)}</span>
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', color: rtCol(s?.avgRt), fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{s?.avgRt != null ? `${s.avgRt}ms` : '-'}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', color: T.muted, fontVariantNumeric: 'tabular-nums' }}>{s?.minRt != null ? `${s.minRt}ms` : '-'}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', color: rtCol(s?.maxRt), fontVariantNumeric: 'tabular-nums' }}>{s?.maxRt != null ? `${s.maxRt}ms` : '-'}</td>
                            {/* Status codes inline pills */}
                            <td style={{ padding: '10px 12px', minWidth: 160 }}>
                              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                {codes.slice(0, 5).map((sc, i) => (
                                  <span key={i} style={{ fontSize: 9, padding: '1px 6px', borderRadius: 2, background: `${codeCol(sc.code)}20`, border: `1px solid ${codeCol(sc.code)}50`, color: codeCol(sc.code), fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                                    {sc.code}: {fmtN(sc.count)}
                                  </span>
                                ))}
                                {codes.length > 5 && <span style={{ fontSize: 9, color: T.muted }}>+{codes.length - 5}</span>}
                              </div>
                            </td>
                          </>
                        )}
                        {/* Actions */}
                        <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <button onClick={() => setExpandedRow(isExp ? null : op)}
                            style={{ fontSize: 10, padding: '2px 8px', background: isExp ? 'rgba(155,89,182,0.15)' : 'transparent', border: `1px solid ${isExp ? '#9b59b6' : T.border2}`, color: isExp ? '#9b59b6' : T.muted, cursor: 'pointer', borderRadius: 2, marginRight: 4 }}>
                            {isExp ? 'Collapse' : 'Details'}
                          </button>
                          <button onClick={() => { fetchWatchItem(op); }}
                            style={{ fontSize: 10, padding: '2px 8px', background: 'transparent', border: `1px solid ${T.border2}`, color: T.muted, cursor: 'pointer', borderRadius: 2, marginRight: 4 }}>
                            ↻
                          </button>
                          <button onClick={() => removeWatch(op)}
                            style={{ fontSize: 10, padding: '2px 8px', background: 'transparent', border: `1px solid rgba(242,73,92,0.3)`, color: '#f2495c', cursor: 'pointer', borderRadius: 2 }}>
                            ✕
                          </button>
                        </td>
                      </tr>

                      {/* Expanded detail row */}
                      {isExp && d && (
                        <tr key={`${op}-exp`} style={{ background: `rgba(155,89,182,0.04)`, borderBottom: `1px solid ${T.border}` }}>
                          <td colSpan={12} style={{ padding: '14px 16px 16px 24px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

                              {/* Status code breakdown */}
                              <div>
                                <div style={{ fontSize: 10, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 10, paddingBottom: 5, borderBottom: `1px solid ${T.border}` }}>Status Code Breakdown</div>
                                {codes.length === 0 ? <div style={{ color: T.dim, fontSize: 11 }}>No data</div> : (
                                  codes.map((sc, i) => {
                                    const total = codes.reduce((a, b) => a + b.count, 0);
                                    const pct = total > 0 ? (sc.count / total) * 100 : 0;
                                    return (
                                      <div key={i} style={{ marginBottom: 8 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span style={{ fontSize: 11, fontWeight: 700, color: codeCol(sc.code), minWidth: 36 }}>{sc.code}</span>
                                            <span style={{ fontSize: 10, color: T.dim }}>{sc.code.startsWith('2') ? 'Success' : sc.code.startsWith('4') ? 'Client Error' : sc.code.startsWith('5') ? 'Server Error' : sc.code.startsWith('3') ? 'Redirect' : ''}</span>
                                          </div>
                                          <div style={{ display: 'flex', gap: 10 }}>
                                            <span style={{ fontSize: 11, color: T.muted, fontVariantNumeric: 'tabular-nums' }}>{fmtN(sc.count)}</span>
                                            <span style={{ fontSize: 10, color: codeCol(sc.code), fontWeight: 600, minWidth: 38, textAlign: 'right' }}>{pct.toFixed(1)}%</span>
                                          </div>
                                        </div>
                                        <div style={{ background: T.border, height: 5, borderRadius: 2, overflow: 'hidden' }}>
                                          <div style={{ background: codeCol(sc.code), height: '100%', width: `${Math.min(pct, 100)}%`, transition: 'width 0.4s ease' }} />
                                        </div>
                                      </div>
                                    );
                                  })
                                )}
                              </div>

                              {/* Dependencies */}
                              <div>
                                <div style={{ fontSize: 10, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 10, paddingBottom: 5, borderBottom: `1px solid ${T.border}` }}>Dependencies</div>
                                {(d.dependencies || []).length === 0 ? <div style={{ color: T.dim, fontSize: 11 }}>No dependency data</div> : (
                                  d.dependencies.slice(0, 6).map((dep, i) => (
                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: `1px solid ${T.border}` }}>
                                      <div style={{ flex: 1, overflow: 'hidden' }}>
                                        <div style={{ fontSize: 11, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dep.name}</div>
                                        <div style={{ fontSize: 10, color: T.muted }}>{dep.type} · {fmtN(dep.total)} calls{dep.failed > 0 ? ` · ${dep.failed} failed` : ''}</div>
                                      </div>
                                      <span style={{ fontSize: 11, color: rtCol(dep.avgRt), fontWeight: 600, marginLeft: 12, flexShrink: 0 }}>{dep.avgRt}ms</span>
                                    </div>
                                  ))
                                )}
                              </div>

                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
    </div>
  );
}

