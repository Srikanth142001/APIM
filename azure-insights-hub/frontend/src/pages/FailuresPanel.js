
import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import {
  ResponsiveContainer, LineChart, Line,
  XAxis, YAxis, Tooltip, CartesianGrid,
  ReferenceArea, ReferenceLine,
} from 'recharts';
import { API_BASE_URL } from '../config/apiConfig';
const getEnvId = () => localStorage.getItem('active_env_id') || '';
import DateRangePicker from '../components/DateRangePicker';
import { useTheme } from '../context/ThemeContext';

/* ─── utils ──────────────────────────────────────────────────────────────── */
const fmt = (n) => {
  if (n == null || isNaN(n)) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
};
const codeColor  = (c, T) => { const s = String(c); return s.startsWith('5') ? T.red : s.startsWith('4') ? T.orange : s.startsWith('2') ? T.green : T.blue; };
const rateColor  = (r, T) => r > 50 ? T.red : r > 20 ? T.orange : T.green;
const rtColor    = (ms, T) => ms > 2000 ? T.red : ms > 1000 ? T.orange : T.text;
const findSpikes = (data) => {
  if (!data || data.length < 4) return [];
  const vals = data.map(d => d.failed || 0);
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const sd   = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length);
  return data.filter(d => (d.failed || 0) > mean + 2 * sd);
};

/* ─── sparkline ──────────────────────────────────────────────────────────── */
const Spark = ({ vals = [], color }) => {
  if (!vals.length) return <span style={{ color: '#5a6080' }}>—</span>;
  const max = Math.max(...vals, 1);
  const W = 52, H = 18;
  const pts = vals.map((v, i) => `${(i / Math.max(vals.length - 1, 1)) * W},${H - (v / max) * (H - 2) - 1}`).join(' ');
  return <svg width={W} height={H} style={{ display: 'block' }}><polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" /></svg>;
};

/* ─── tooltip ────────────────────────────────────────────────────────────── */
const makeTooltip = (T) => ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload || {};
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border2}`, padding: '10px 14px', fontSize: 11, lineHeight: 1.9, minWidth: 170, boxShadow: '0 4px 20px rgba(0,0,0,0.25)' }}>
      <div style={{ color: T.muted, fontSize: 10, marginBottom: 6, borderBottom: `1px solid ${T.border}`, paddingBottom: 5, fontWeight: 600 }}>{label}</div>
      {[['Failures', fmt(d.failed), T.red], ['Total', fmt(d.total), T.text], ['Error rate', `${d.errorRate?.toFixed(1)}%`, T.orange], d.avgRt != null ? ['Avg RT', `${d.avgRt}ms`, T.green] : null]
        .filter(Boolean).map(([l, v, c]) => (
          <div key={l} style={{ display: 'flex', justifyContent: 'space-between', gap: 24 }}>
            <span style={{ color: T.muted }}>{l}</span>
            <span style={{ color: c, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{v}</span>
          </div>
        ))}
    </div>
  );
};

/* ─── sub-components ─────────────────────────────────────────────────────── */
const SectionLabel = ({ children, T }) => (
  <div style={{ fontSize: 10, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 8, paddingBottom: 5, borderBottom: `1px solid ${T.border}` }}>{children}</div>
);
const ProgBar = ({ pct, color, T }) => (
  <div style={{ background: T.border, height: 4, borderRadius: 2, overflow: 'hidden', marginTop: 3 }}>
    <div style={{ background: color, height: '100%', width: `${Math.min(pct, 100)}%` }} />
  </div>
);
const TH = ({ label, k, sortKey, sortDir, onSort, align = 'right', T }) => (
  <th onClick={() => onSort(k)} style={{ textAlign: align, padding: '9px 14px', color: sortKey === k ? T.text : T.muted, fontWeight: 500, fontSize: 11, cursor: 'pointer', userSelect: 'none', borderBottom: `1px solid ${T.border}`, background: T.panel, letterSpacing: '0.03em', whiteSpace: 'nowrap' }}>
    {label}
    {sortKey === k ? <span style={{ marginLeft: 4, color: T.blue }}>{sortDir === 'asc' ? '↑' : '↓'}</span> : <span style={{ marginLeft: 4, color: T.dim }}>↕</span>}
  </th>
);

export default function FailuresPanel() {
  const { T } = useTheme();

  /* ── time filter ── */
  const [range,       setRange]       = useState('30d');
  const [dateMode,    setDateMode]    = useState('range');
  const [customStart, setCustomStart] = useState('');
  const [customEnd,   setCustomEnd]   = useState('');
  const [showPicker,  setShowPicker]  = useState(false);
  const [pickerDates, setPickerDates] = useState({ startDate: null, endDate: null });
  const pickerRef = useRef(null);

  /* ── data ── */
  const [timeline,   setTimeline]   = useState([]);   // full timeline
  const [operations, setOperations] = useState([]);
  const [overall,    setOverall]    = useState(null);
  const [apiDetail,  setApiDetail]  = useState(null);

  /* ── selection ── */
  const [selectedApi,  setSelectedApi]  = useState(null);
  const [zoomWindow,   setZoomWindow]   = useState(null); // { start, end, label } ISO timestamps

  /* ── drag state ── */
  const [dragStart,  setDragStart]  = useState(null); // time label string
  const [dragEnd,    setDragEnd]    = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  /* ── chart animation key — only animate on new data, not on re-renders ── */
  const [chartKey, setChartKey] = useState(0);
  const animatedRef = useRef(false);

  /* ── loading ── */
  const [loadingMain,   setLoadingMain]   = useState(false);
  const [loadingOps,    setLoadingOps]    = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  /* ── table ── */
  const [search,  setSearch]  = useState('');
  const [sortKey, setSortKey] = useState('failed');
  const [sortDir, setSortDir] = useState('desc');
  const [page,    setPage]    = useState(1);
  const PAGE = 25;

  /* ── close picker on outside click ── */
  useEffect(() => {
    const h = (e) => { if (pickerRef.current && !pickerRef.current.contains(e.target)) setShowPicker(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  /* ── base params ── */
  const baseParams = useCallback(() => {
    const p = new URLSearchParams();
    if (customStart && customEnd) { p.append('startDate', customStart); p.append('endDate', customEnd); }
    else p.append('range', range);
    return p;
  }, [range, customStart, customEnd]);

  /* ── fetchers ── */
  const fetchTimeline = useCallback(async () => {
    setLoadingMain(true);
    try {
      const r = await axios.get(`${API_BASE_URL}/api/${getEnvId()}/failures-panel/timeline?${baseParams()}`);
      setTimeline(r.data.data || []);
      animatedRef.current = false; // reset so next load animates once
      setChartKey(k => k + 1);
    } catch (e) { console.error(e); setTimeline([]); }
    finally { setLoadingMain(false); }
  }, [baseParams]);

  const fetchOperations = useCallback(async (win) => {
    setLoadingOps(true);
    try {
      const p = win ? new URLSearchParams({ windowStart: win.start, windowEnd: win.end }) : baseParams();
      const r = await axios.get(`${API_BASE_URL}/api/${getEnvId()}/failures-panel/operations?${p}`);
      setOperations(r.data.data || []);
    } catch (e) { console.error(e); setOperations([]); }
    finally { setLoadingOps(false); }
  }, [baseParams]);

  const fetchOverall = useCallback(async (win) => {
    try {
      const p = win ? new URLSearchParams({ windowStart: win.start, windowEnd: win.end }) : baseParams();
      const r = await axios.get(`${API_BASE_URL}/api/${getEnvId()}/failures-panel/overall?${p}`);
      setOverall(r.data);
    } catch (e) { console.error(e); setOverall(null); }
  }, [baseParams]);

  const fetchApiDetail = useCallback(async (op, win) => {
    setLoadingDetail(true);
    setApiDetail(null);
    try {
      const p = new URLSearchParams({ operation: op.operation });
      if (win) { p.append('windowStart', win.start); p.append('windowEnd', win.end); }
      else if (customStart && customEnd) { p.append('startDate', customStart); p.append('endDate', customEnd); }
      else p.append('range', range);
      const r = await axios.get(`${API_BASE_URL}/api/${getEnvId()}/failures-panel/detail?${p}`);
      setApiDetail(r.data);
      animatedRef.current = false;
      setChartKey(k => k + 1);
    } catch (e) { console.error(e); setApiDetail(null); }
    finally { setLoadingDetail(false); }
  }, [range, customStart, customEnd]);

  /* ── lifecycle ── */
  useEffect(() => {
    setSelectedApi(null); setApiDetail(null); setZoomWindow(null);
    setDragStart(null); setDragEnd(null);
    fetchTimeline();
  }, [range, customStart, customEnd]); // eslint-disable-line

  useEffect(() => {
    if (timeline.length) { fetchOperations(null); fetchOverall(null); }
  }, [timeline]); // eslint-disable-line

  /* ── drag handlers ── */
  const onMouseDown = (e) => { if (!e?.activeLabel) return; setDragStart(e.activeLabel); setDragEnd(null); setIsDragging(true); };
  const onMouseMove = (e) => { if (isDragging && e?.activeLabel) setDragEnd(e.activeLabel); };
  const onMouseUp   = () => {
    setIsDragging(false);
    if (!dragStart || !dragEnd || dragStart === dragEnd) { setDragStart(null); setDragEnd(null); return; }
    // find timestamps from the FULL timeline (not zoomed)
    const s  = timeline.find(t => t.time === dragStart);
    const en = timeline.find(t => t.time === dragEnd);
    if (!s || !en) { setDragStart(null); setDragEnd(null); return; }
    const [a, b] = s.timestamp <= en.timestamp ? [s, en] : [en, s];
    const win = { start: a.timestamp, end: b.timestamp, label: `${a.time} → ${b.time}` };
    setZoomWindow(win);
    setDragStart(null); setDragEnd(null);
    setChartKey(k => k + 1); // re-animate zoomed chart
    fetchOperations(win);
    fetchOverall(win);
    if (selectedApi) fetchApiDetail(selectedApi, win);
  };

  /* ── row click ── */
  const handleApiClick = (op) => { setSelectedApi(op); fetchApiDetail(op, zoomWindow); setPage(1); };
  const clearApi  = () => { setSelectedApi(null); setApiDetail(null); };
  const clearZoom = () => { setZoomWindow(null); fetchOperations(null); fetchOverall(null); if (selectedApi) fetchApiDetail(selectedApi, null); };
  const clearAll  = () => { clearApi(); clearZoom(); };

  /* ── table ── */
  const filtered   = operations.filter(o => o.operation?.toLowerCase().includes(search.toLowerCase()));
  const sorted     = [...filtered].sort((a, b) => { const av = a[sortKey] ?? 0, bv = b[sortKey] ?? 0; return sortDir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1); });
  const totalPages = Math.ceil(sorted.length / PAGE);
  const paged      = sorted.slice((page - 1) * PAGE, page * PAGE);
  const onSort     = (k) => { setSortKey(k); setSortDir(sortKey === k && sortDir === 'asc' ? 'desc' : 'asc'); };

  /* ── chart data:
       - if API selected → use apiDetail.timeline
       - if zoomed       → filter full timeline to the zoom window
       - otherwise       → full timeline
  ── */
  const rawChartData = selectedApi ? (apiDetail?.timeline ?? []) : timeline;
  const chartData = zoomWindow && !selectedApi
    ? rawChartData.filter(d => d.timestamp >= zoomWindow.start && d.timestamp <= zoomWindow.end)
    : rawChartData;

  const chartColor = selectedApi ? T.orange : T.red;
  const spikes     = findSpikes(chartData);
  const dragL      = dragStart && dragEnd ? (dragStart < dragEnd ? dragStart : dragEnd) : null;
  const dragR      = dragStart && dragEnd ? (dragStart < dragEnd ? dragEnd : dragStart) : null;

  /* ── summary ── */
  const totalFailed  = operations.reduce((s, o) => s + (o.failed || 0), 0);
  const totalReqs    = operations.reduce((s, o) => s + (o.total  || 0), 0);
  const avgErrRate   = totalReqs > 0 ? (totalFailed / totalReqs) * 100 : 0;
  const criticalApis = operations.filter(o => o.errorRate > 50).length;

  /* ── csv ── */
  const exportCsv = () => {
    const rows = [['API','Failures','Total','Error%','AvgRT(ms)'], ...sorted.map(o => [o.operation, o.failed, o.total, o.errorRate?.toFixed(2), o.avgRt?.toFixed(0)])];
    const blob = new Blob([rows.map(r => r.join(',')).join('\n')], { type: 'text/csv' });
    Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `failures-${Date.now()}.csv` }).click();
  };

  const ChartTooltip = makeTooltip(T);
  const btn = (active, color) => ({
    display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 11px', fontSize: 11, fontWeight: 500,
    background: active ? `${color}18` : 'transparent', border: `1px solid ${active ? color + '55' : T.border2}`,
    color: active ? color : T.muted, cursor: 'pointer', transition: 'border-color 0.12s, color 0.12s', letterSpacing: '0.02em',
  });

  return (
    <div style={{ background: T.bg, minHeight: '100vh', color: T.text, fontFamily: "'Inter', system-ui, sans-serif", fontSize: 13, transition: 'background 0.2s, color 0.2s' }}>

      {/* ══ HEADER ══════════════════════════════════════════════════════════ */}
      <div style={{ background: T.surface, borderBottom: `1px solid ${T.border}`, padding: '0 24px', transition: 'background 0.2s' }}>

        {/* top row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 50 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <span style={{ fontWeight: 600, color: T.text }}>Failures</span>
            {selectedApi && (
              <>
                <span style={{ color: T.dim, margin: '0 2px' }}>/</span>
                <button onClick={clearApi} style={{ ...btn(false), padding: '2px 8px', fontSize: 11 }}>← All</button>
                <span style={{ color: T.dim, margin: '0 2px' }}>/</span>
                <span style={{ color: T.orange, fontSize: 11, maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedApi.operation}</span>
              </>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {(zoomWindow || selectedApi) && (
              <button onClick={clearAll} style={{ ...btn(true, T.red) }}>✕ Clear</button>
            )}
            <button onClick={() => { clearAll(); fetchTimeline(); }} disabled={loadingMain} style={{ ...btn(false, T.blue), color: loadingMain ? T.dim : T.muted }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: loadingMain ? 'spin 1s linear infinite' : 'none' }}>
                <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
              </svg>
              Refresh
            </button>

            <div style={{ width: 1, height: 18, background: T.border2, margin: '0 2px' }} />

            <div style={{ display: 'flex', border: `1px solid ${T.border2}`, overflow: 'hidden' }}>
              {[['range','Quick'],['custom','Custom']].map(([m, l]) => (
                <button key={m} onClick={() => { setDateMode(m); if (m === 'range') { setCustomStart(''); setCustomEnd(''); setShowPicker(false); } else setShowPicker(v => !v); }}
                  style={{ padding: '5px 11px', fontSize: 11, fontWeight: 500, cursor: 'pointer', border: 'none', background: dateMode === m ? T.border2 : 'transparent', color: dateMode === m ? T.text : T.muted, transition: 'all 0.12s' }}>
                  {l}
                </button>
              ))}
            </div>

            {dateMode === 'range' && (
              <select value={range} onChange={e => { setRange(e.target.value); setZoomWindow(null); }}
                style={{ background: T.surface, border: `1px solid ${T.border2}`, padding: '5px 10px', color: T.text, fontSize: 11, cursor: 'pointer', outline: 'none' }}>
                {[['10m','10 min'],['30m','30 min'],['1h','1 hour'],['6h','6 hours'],['12h','12 hours'],['24h','24 hours'],['7d','7 days'],['30d','30 days'],['90d','90 days']].map(([v,l]) =>
                  <option key={v} value={v}>{l}</option>)}
              </select>
            )}

            {dateMode === 'custom' && (
              <div style={{ position: 'relative' }}>
                <button onClick={() => setShowPicker(v => !v)} style={{ ...btn(!!customStart, T.blue) }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  {customStart && customEnd ? `${new Date(customStart).toLocaleDateString('en-GB',{day:'2-digit',month:'short'})} – ${new Date(customEnd).toLocaleDateString('en-GB',{day:'2-digit',month:'short'})}` : 'Select range'}
                </button>
                {showPicker && (
                  <div ref={pickerRef} style={{ position: 'absolute', top: 38, right: 0, zIndex: 1000 }}>
                    <DateRangePicker startDate={pickerDates.startDate} endDate={pickerDates.endDate}
                      onChange={({ startDate, endDate }) => setPickerDates({ startDate, endDate })}
                      onApply={(s, e) => { setCustomStart(s); setCustomEnd(e); setShowPicker(false); setZoomWindow(null); }}
                      onClear={() => { setPickerDates({ startDate: null, endDate: null }); setCustomStart(''); setCustomEnd(''); }} />
                  </div>
                )}
              </div>
            )}

            <button onClick={exportCsv} style={{ ...btn(false, T.green) }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
              Export
            </button>
          </div>
        </div>

        {/* metric strip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, borderTop: `1px solid ${T.border}`, height: 46 }}>
          {[
            { label: 'Failures',      value: loadingOps ? null : fmt(totalFailed),            color: T.red    },
            { label: 'Requests',      value: loadingOps ? null : fmt(totalReqs),              color: T.text   },
            { label: 'Error Rate %',   value: loadingOps ? null : `${avgErrRate.toFixed(1)}%`, color: T.orange },
            { label: 'Critical APIs', value: loadingOps ? null : String(criticalApis),        color: criticalApis > 0 ? T.red : T.green },
          ].map(({ label, value, color }, i) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center' }}>
              {i > 0 && <div style={{ width: 1, height: 28, background: T.border, margin: '0 20px' }} />}
              <div>
                <div style={{ fontSize: 10, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 1 }}>{label}</div>
                {value == null
                  ? <div className="gf-skeleton" style={{ height: 18, width: 60, marginTop: 2 }} />
                  : <div style={{ fontSize: 18, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', lineHeight: 1 }}>{value}</div>
                }
              </div>
            </div>
          ))}
          {zoomWindow && (
            <>
              <div style={{ width: 1, height: 28, background: T.border, margin: '0 20px' }} />
              <div>
                <div style={{ fontSize: 10, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 1 }}>Zoom window</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: T.blue, fontWeight: 600 }}>{zoomWindow.label}</span>
                  <button onClick={clearZoom} style={{ background: 'none', border: 'none', color: T.muted, cursor: 'pointer', fontSize: 12, padding: 0 }}>✕</button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ══ BODY ════════════════════════════════════════════════════════════ */}
      <div style={{ padding: '18px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* ── CHART ── */}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, transition: 'background 0.2s' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 18px', borderBottom: `1px solid ${T.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: chartColor, boxShadow: `0 0 5px ${chartColor}80` }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: T.text }}>
                {selectedApi ? selectedApi.operation : 'Total Failures'}
              </span>
              {zoomWindow && !selectedApi && (
                <span style={{ fontSize: 10, color: T.blue, background: `${T.blue}14`, border: `1px solid ${T.blue}30`, padding: '2px 8px' }}>
                  {zoomWindow.label}
                </span>
              )}
              {spikes.length > 0 && (
                <span style={{ fontSize: 10, color: T.red, background: `${T.red}14`, border: `1px solid ${T.red}30`, padding: '2px 8px', letterSpacing: '0.04em', fontWeight: 600 }}>
                  {spikes.length} SPIKE{spikes.length > 1 ? 'S' : ''}
                </span>
              )}
              {loadingDetail && selectedApi && <span style={{ fontSize: 10, color: T.muted }}>loading…</span>}
            </div>
            <span style={{ fontSize: 10, color: T.dim }}>Drag to zoom · Click row to drill down</span>
          </div>

          <div style={{ padding: '14px 8px 6px', background: T.chartBg, transition: 'background 0.2s' }}>
            {loadingMain ? (
              <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.dim, fontSize: 12 }}>Loading…</div>
            ) : chartData.length === 0 ? (
              <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.dim, fontSize: 12 }}>
                {selectedApi ? 'No data for this API in the selected period' : 'No data available'}
              </div>
            ) : (
              <ResponsiveContainer key={chartKey} width="100%" height={260}>
                <LineChart data={chartData} onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp}
                  style={{ cursor: isDragging ? 'col-resize' : 'crosshair', userSelect: 'none' }}>
                  <CartesianGrid strokeDasharray="0" stroke={T.gridLine} vertical={false} />
                  <XAxis dataKey="time" tick={{ fill: T.muted, fontSize: 10 }} axisLine={{ stroke: T.border }} tickLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fill: T.muted, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={fmt} width={50} />
                  <Tooltip content={<ChartTooltip />} cursor={{ stroke: T.border2, strokeWidth: 1 }} />
                  <Line type="monotone" dataKey="failed" name="Failures" stroke={chartColor} strokeWidth={2}
                    dot={false} activeDot={{ r: 5, fill: chartColor, stroke: T.chartBg, strokeWidth: 2 }}
                    isAnimationActive={!animatedRef.current}
                    animationDuration={700} animationEasing="ease-out"
                    onAnimationEnd={() => { animatedRef.current = true; }} />
                  {spikes.map((s, i) => (
                    <ReferenceLine key={i} x={s.time} stroke={`${T.red}35`} strokeDasharray="3 4" strokeWidth={1} />
                  ))}
                  {dragL && dragR && (
                    <ReferenceArea x1={dragL} x2={dragR} fill={`${T.blue}18`} stroke={`${T.blue}70`} strokeWidth={1} />
                  )}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* ── BOTTOM GRID ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 296px', gap: 14, alignItems: 'start' }}>

          {/* TABLE */}
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, transition: 'background 0.2s' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 18px', borderBottom: `1px solid ${T.border}` }}>
              <div>
                <span style={{ fontSize: 12, fontWeight: 600, color: T.text }}>Operations</span>
                <span style={{ marginLeft: 8, fontSize: 10, color: T.muted }}>
                  {loadingOps ? 'Loading…' : `${sorted.length} APIs`}
                </span>
              </div>
              <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Filter by name…"
                style={{ background: T.inputBg, border: `1px solid ${T.border2}`, padding: '5px 10px', color: T.text, fontSize: 11, width: 210, outline: 'none' }} />
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <TH label="API Name"  k="operation" sortKey={sortKey} sortDir={sortDir} onSort={onSort} align="left" T={T} />
                  <TH label="Failures"  k="failed"    sortKey={sortKey} sortDir={sortDir} onSort={onSort} T={T} />
                  <TH label="Error %"   k="errorRate" sortKey={sortKey} sortDir={sortDir} onSort={onSort} T={T} />
                  <TH label="Avg RT"    k="avgRt"     sortKey={sortKey} sortDir={sortDir} onSort={onSort} T={T} />
                  <th style={{ textAlign: 'center', padding: '9px 14px', color: T.muted, fontWeight: 500, fontSize: 11, borderBottom: `1px solid ${T.border}`, background: T.panel }}>Trend</th>
                </tr>
              </thead>
              <tbody>
                {loadingOps ? (
                  Array(8).fill(0).map((_, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${T.border}` }}>
                      <td style={{ padding: '10px 14px' }}><div className="gf-skeleton" style={{ height: 11, width: `${55 + (i * 17) % 35}%` }} /></td>
                      <td style={{ padding: '10px 14px' }}><div className="gf-skeleton" style={{ height: 11, width: 48, marginLeft: 'auto' }} /></td>
                      <td style={{ padding: '10px 14px' }}><div className="gf-skeleton" style={{ height: 11, width: 40, marginLeft: 'auto' }} /></td>
                      <td style={{ padding: '10px 14px' }}><div className="gf-skeleton" style={{ height: 11, width: 44, marginLeft: 'auto' }} /></td>
                      <td style={{ padding: '10px 14px' }}><div className="gf-skeleton" style={{ height: 11, width: 52, margin: '0 auto' }} /></td>
                    </tr>
                  ))
                ) : paged.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: 48, color: T.dim, fontSize: 12 }}>{search ? 'No matching APIs' : 'No data'}</td></tr>
                ) : paged.map((op, i) => {
                  const active = selectedApi?.operation === op.operation;
                  const sparkVals = op.codes ? String(op.codes).split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n)) : [];
                  return (
                    <tr key={i} onClick={() => handleApiClick(op)}
                      style={{ borderBottom: `1px solid ${T.border}`, cursor: 'pointer', background: active ? `${T.orange}0a` : 'transparent', transition: 'background 0.1s' }}
                      onMouseEnter={e => { if (!active) e.currentTarget.style.background = T.panel; }}
                      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}>
                      <td style={{ padding: '10px 14px', color: active ? T.orange : T.text, fontWeight: active ? 500 : 400, maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', borderLeft: `2px solid ${active ? T.orange : 'transparent'}` }}>
                        {op.operation}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', color: T.red, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmt(op.failed)}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                        <span style={{ color: rateColor(op.errorRate, T), fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>{op.errorRate?.toFixed(1)}%</span>
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', color: rtColor(op.avgRt, T), fontVariantNumeric: 'tabular-nums' }}>{op.avgRt?.toFixed(0)}ms</td>
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}><Spark vals={sparkVals.slice(0, 12)} color={rateColor(op.errorRate, T)} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 18px', borderTop: `1px solid ${T.border}`, fontSize: 11, color: T.muted }}>
                <span>{(page-1)*PAGE+1}–{Math.min(page*PAGE, sorted.length)} of {sorted.length}</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  {[['←', page > 1, () => setPage(p => p-1)], ['→', page < totalPages, () => setPage(p => p+1)]].map(([l, en, fn]) => (
                    <button key={l} onClick={fn} disabled={!en} style={{ width: 26, height: 26, background: 'none', border: `1px solid ${en ? T.border2 : T.border}`, color: en ? T.text : T.dim, cursor: en ? 'pointer' : 'not-allowed', fontSize: 13 }}>{l}</button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT PANEL */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {selectedApi && (
              <div style={{ background: T.surface, border: `1px solid ${T.border}`, transition: 'background 0.2s' }}>
                <div style={{ padding: '10px 16px', borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: T.text }}>API Detail</span>
                  {loadingDetail && <span style={{ fontSize: 10, color: T.muted }}>loading…</span>}
                </div>
                <div style={{ padding: 14 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, marginBottom: 14, border: `1px solid ${T.border}` }}>
                    {[['Failures', fmt(selectedApi.failed), T.red, 0], ['Error %', `${selectedApi.errorRate?.toFixed(1)}%`, T.orange, 1], ['Total', fmt(selectedApi.total), T.text, 2], ['Avg RT', `${selectedApi.avgRt?.toFixed(0)}ms`, rtColor(selectedApi.avgRt, T), 3]].map(([l, v, c, idx]) => (
                      <div key={l} style={{ padding: '11px 13px', background: idx % 2 === 0 ? T.panel : T.surface, borderRight: idx % 2 === 0 ? `1px solid ${T.border}` : 'none', borderBottom: idx < 2 ? `1px solid ${T.border}` : 'none' }}>
                        <div style={{ fontSize: 10, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{l}</div>
                        <div style={{ fontSize: 17, fontWeight: 700, color: c, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>{v}</div>
                      </div>
                    ))}
                  </div>
                  {apiDetail ? (
                    <>
                      {apiDetail.responseCodes?.length > 0 && (
                        <div style={{ marginBottom: 14 }}>
                          <SectionLabel T={T}>Response Codes</SectionLabel>
                          {apiDetail.responseCodes.slice(0, 5).map((rc, i) => (
                            <div key={i} style={{ marginBottom: 7 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
                                <span style={{ color: codeColor(rc.code, T), fontWeight: 600 }}>{rc.code}</span>
                                <span style={{ color: T.muted, fontVariantNumeric: 'tabular-nums' }}>{fmt(rc.count)}</span>
                              </div>
                              <ProgBar pct={(rc.count / (apiDetail.responseCodes[0]?.count || 1)) * 100} color={codeColor(rc.code, T)} T={T} />
                            </div>
                          ))}
                        </div>
                      )}
                      {apiDetail.exceptions?.length > 0 && (
                        <div style={{ marginBottom: 14 }}>
                          <SectionLabel T={T}>Exceptions</SectionLabel>
                          {apiDetail.exceptions.slice(0, 3).map((ex, i) => (
                            <div key={i} style={{ padding: '7px 0', borderBottom: `1px solid ${T.border}` }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                                <span style={{ fontSize: 11, color: T.text, fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ex.type}</span>
                                <span style={{ fontSize: 11, color: T.red, fontWeight: 600, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{fmt(ex.count)}</span>
                              </div>
                              <div style={{ fontSize: 10, color: T.dim, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ex.full}</div>
                            </div>
                          ))}
                        </div>
                      )}
                      {apiDetail.dependencies?.length > 0 && (
                        <div>
                          <SectionLabel T={T}>Failed Dependencies</SectionLabel>
                          {apiDetail.dependencies.slice(0, 3).map((dep, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: `1px solid ${T.border}` }}>
                              <div style={{ flex: 1, overflow: 'hidden' }}>
                                <div style={{ fontSize: 11, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dep.name}</div>
                                <div style={{ fontSize: 10, color: T.dim }}>{dep.type}</div>
                              </div>
                              <span style={{ fontSize: 11, color: T.orange, fontWeight: 600, fontVariantNumeric: 'tabular-nums', marginLeft: 8 }}>{fmt(dep.count)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : !loadingDetail && <div style={{ textAlign: 'center', padding: 20, color: T.dim, fontSize: 11 }}>No detail data</div>}
                </div>
              </div>
            )}

            <div style={{ background: T.surface, border: `1px solid ${T.border}`, transition: 'background 0.2s' }}>
              <div style={{ padding: '10px 16px', borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: T.text }}>Overall Stats</span>
                {zoomWindow && <span style={{ fontSize: 10, color: T.blue }}>zoomed</span>}
              </div>
              <div style={{ padding: 14 }}>
                {!overall ? <div style={{ textAlign: 'center', padding: 24, color: T.dim, fontSize: 11 }}>Loading…</div> : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {overall.responseCodes?.length > 0 && (
                      <div>
                        <SectionLabel T={T}>Response Codes</SectionLabel>
                        {overall.responseCodes.slice(0, 4).map((rc, i) => (
                          <div key={i} style={{ marginBottom: 7 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
                              <span style={{ color: codeColor(rc.code, T), fontWeight: 600 }}>{rc.code}</span>
                              <span style={{ color: T.muted, fontVariantNumeric: 'tabular-nums' }}>{fmt(rc.count)}</span>
                            </div>
                            <ProgBar pct={(rc.count / (overall.responseCodes[0]?.count || 1)) * 100} color={codeColor(rc.code, T)} T={T} />
                          </div>
                        ))}
                      </div>
                    )}
                    {overall.exceptions?.length > 0 && (
                      <div>
                        <SectionLabel T={T}>Exceptions</SectionLabel>
                        {overall.exceptions.slice(0, 3).map((ex, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${T.border}`, fontSize: 11 }}>
                            <span style={{ color: T.text, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ex.type}</span>
                            <span style={{ color: T.red, fontWeight: 600, fontVariantNumeric: 'tabular-nums', marginLeft: 8 }}>{fmt(ex.count)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {overall.dependencies?.length > 0 && (
                      <div>
                        <SectionLabel T={T}>Dependencies</SectionLabel>
                        {overall.dependencies.slice(0, 3).map((dep, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${T.border}`, fontSize: 11 }}>
                            <span style={{ color: T.text, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dep.name}</span>
                            <span style={{ color: T.orange, fontWeight: 600, fontVariantNumeric: 'tabular-nums', marginLeft: 8 }}>{fmt(dep.count)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        select option { background: ${T.surface}; color: ${T.text}; }
        input::placeholder { color: ${T.muted}; }
      `}</style>
    </div>
  );
}

