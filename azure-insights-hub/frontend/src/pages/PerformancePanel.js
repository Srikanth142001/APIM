import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import {
  ResponsiveContainer, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, Tooltip, CartesianGrid,
  ReferenceArea, ReferenceLine, BarChart, Bar, Cell,
} from 'recharts';
import { API_BASE_URL } from '../config/apiConfig';
const getEnvId = () => localStorage.getItem('active_env_id') || '';
import DateRangePicker from '../components/DateRangePicker';
import { useTheme } from '../context/ThemeContext';

const fmt = (n) => {
  if (n == null || isNaN(n)) return '-';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
};
const rtColor  = (ms, T) => ms > 2000 ? T.red : ms > 1000 ? T.orange : T.green;
const pctColor = (p, T)  => p > 50 ? T.red : p > 20 ? T.orange : T.green;
const codeColor = (c, T) => { const s = String(c); return s.startsWith('5') ? T.red : s.startsWith('4') ? T.orange : s.startsWith('2') ? T.green : T.blue; };
const depTypeColor = (type, T) => {
  const t = String(type).toLowerCase();
  if (t.includes('sql') || t.includes('mysql')) return T.blue;
  if (t.includes('http') || t.includes('ajax')) return T.orange;
  if (t.includes('redis') || t.includes('cache')) return '#9b59b6';
  return T.muted;
};
const findSlowSpikes = (data) => {
  if (!data || data.length < 4) return [];
  const vals = data.map(d => d.avgRt || 0);
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const sd   = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length);
  return data.filter(d => (d.avgRt || 0) > mean + 2 * sd);
};

const Spark = ({ vals = [], color }) => {
  if (!vals.length) return null;
  const max = Math.max(...vals, 1);
  const W = 52, H = 18;
  const pts = vals.map((v, i) => `${(i / Math.max(vals.length - 1, 1)) * W},${H - (v / max) * (H - 2) - 1}`).join(' ');
  return <svg width={W} height={H} style={{ display: 'block' }}><polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" /></svg>;
};

const makeTooltip = (T) => ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload || {};
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border2}`, padding: '10px 14px', fontSize: 11, lineHeight: 1.9, minWidth: 180, boxShadow: '0 4px 20px rgba(0,0,0,0.25)' }}>
      <div style={{ color: T.muted, fontSize: 10, marginBottom: 6, borderBottom: `1px solid ${T.border}`, paddingBottom: 5, fontWeight: 600 }}>{label}</div>
      {[
        ['Avg RT',   d.avgRt != null ? `${d.avgRt}ms` : null, T.green],
        ['Requests', d.total != null ? fmt(d.total)   : null, T.text],
        ['Slow >2s', d.slow  != null ? fmt(d.slow)    : null, T.orange],
      ].filter(([,v]) => v != null).map(([l, v, c]) => (
        <div key={l} style={{ display: 'flex', justifyContent: 'space-between', gap: 24 }}>
          <span style={{ color: T.muted }}>{l}</span>
          <span style={{ color: c, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{v}</span>
        </div>
      ))}
    </div>
  );
};

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
    {sortKey === k ? <span style={{ marginLeft: 4, color: T.blue }}>{sortDir === 'asc' ? 'up' : 'dn'}</span> : <span style={{ marginLeft: 4, color: T.dim }}>ud</span>}
  </th>
);

export default function PerformancePanel() {
  const { T } = useTheme();

  const [range,       setRange]       = useState('30d');
  const [dateMode,    setDateMode]    = useState('range');
  const [customStart, setCustomStart] = useState('');
  const [customEnd,   setCustomEnd]   = useState('');
  const [showPicker,  setShowPicker]  = useState(false);
  const [pickerDates, setPickerDates] = useState({ startDate: null, endDate: null });
  const pickerRef = useRef(null);

  const [timeline,   setTimeline]   = useState([]);
  const [operations, setOperations] = useState([]);
  const [overall,    setOverall]    = useState(null);
  const [apiDetail,  setApiDetail]  = useState(null);
  const [tlMeta,     setTlMeta]     = useState({ totalReqs: 0, totalSlow: 0, overallAvg: 0 });

  const [selectedApi,  setSelectedApi]  = useState(null);
  const [zoomWindow,   setZoomWindow]   = useState(null);
  const [dragStart,    setDragStart]    = useState(null);
  const [dragEnd,      setDragEnd]      = useState(null);
  const [isDragging,   setIsDragging]   = useState(false);
  // separate drag state for the requests chart
  const [reqDragStart, setReqDragStart] = useState(null);
  const [reqDragEnd,   setReqDragEnd]   = useState(null);
  const [reqDragging,  setReqDragging]  = useState(false);
  const [chartKey,     setChartKey]     = useState(0);
  const animatedRef = useRef(false);

  const [loadingMain,   setLoadingMain]   = useState(false);
  const [loadingOps,    setLoadingOps]    = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [search,  setSearch]  = useState('');
  const [sortKey, setSortKey] = useState('avgRt');
  const [sortDir, setSortDir] = useState('desc');
  const [page,    setPage]    = useState(1);
  const PAGE = 25; // paginate table display

  useEffect(() => {
    const h = (e) => { if (pickerRef.current && !pickerRef.current.contains(e.target)) setShowPicker(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const baseParams = useCallback(() => {
    const p = new URLSearchParams();
    if (customStart && customEnd) { p.append('startDate', customStart); p.append('endDate', customEnd); }
    else p.append('range', range);
    return p;
  }, [range, customStart, customEnd]);

  const fetchTimeline = useCallback(async () => {
    setLoadingMain(true);
    try {
      const r = await axios.get(`${API_BASE_URL}/api/${getEnvId()}/performance/timeline?${baseParams()}`);
      setTimeline(r.data.data || []);
      setTlMeta({ totalReqs: r.data.totalReqs || 0, totalSlow: r.data.totalSlow || 0, overallAvg: r.data.overallAvg || 0 });
      animatedRef.current = false;
      setChartKey(k => k + 1);
    } catch (e) { console.error(e); setTimeline([]); }
    finally { setLoadingMain(false); }
  }, [baseParams]);

  const fetchOperations = useCallback(async (win) => {
    setLoadingOps(true);
    try {
      const p = win ? new URLSearchParams({ windowStart: win.start, windowEnd: win.end }) : baseParams();
      const r = await axios.get(`${API_BASE_URL}/api/${getEnvId()}/performance/operations?${p}`);
      setOperations(r.data.data || []);
    } catch (e) { console.error(e); setOperations([]); }
    finally { setLoadingOps(false); }
  }, [baseParams]);

  const fetchOverall = useCallback(async (win) => {
    try {
      const p = win ? new URLSearchParams({ windowStart: win.start, windowEnd: win.end }) : baseParams();
      const r = await axios.get(`${API_BASE_URL}/api/${getEnvId()}/performance/overall?${p}`);
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
      const r = await axios.get(`${API_BASE_URL}/api/${getEnvId()}/performance/detail?${p}`);
      setApiDetail(r.data);
      animatedRef.current = false;
      setChartKey(k => k + 1);
    } catch (e) { console.error(e); setApiDetail(null); }
    finally { setLoadingDetail(false); }
  }, [range, customStart, customEnd]);

  useEffect(() => {
    setSelectedApi(null); setApiDetail(null); setZoomWindow(null);
    setDragStart(null); setDragEnd(null);
    fetchTimeline();
  }, [range, customStart, customEnd]); // eslint-disable-line

  useEffect(() => {
    if (timeline.length) { fetchOperations(null); fetchOverall(null); }
  }, [timeline]); // eslint-disable-line

  const onMouseDown = (e) => { if (!e?.activeLabel) return; setDragStart(e.activeLabel); setDragEnd(null); setIsDragging(true); };
  const onMouseMove = (e) => { if (isDragging && e?.activeLabel) setDragEnd(e.activeLabel); };
  const onMouseUp   = () => {
    setIsDragging(false);
    if (!dragStart || !dragEnd || dragStart === dragEnd) { setDragStart(null); setDragEnd(null); return; }
    const s  = timeline.find(t => t.time === dragStart);
    const en = timeline.find(t => t.time === dragEnd);
    if (!s || !en) { setDragStart(null); setDragEnd(null); return; }
    const [a, b] = s.timestamp <= en.timestamp ? [s, en] : [en, s];
    const win = { start: a.timestamp, end: b.timestamp, label: `${a.time} - ${b.time}` };
    setZoomWindow(win);
    setDragStart(null); setDragEnd(null);
    setChartKey(k => k + 1);
    fetchOperations(win);
    fetchOverall(win);
    if (selectedApi) fetchApiDetail(selectedApi, win);
  };

  // drag handlers for the Total Requests chart — shares the same zoom window
  const onReqMouseDown = (e) => { if (!e?.activeLabel) return; setReqDragStart(e.activeLabel); setReqDragEnd(null); setReqDragging(true); };
  const onReqMouseMove = (e) => { if (reqDragging && e?.activeLabel) setReqDragEnd(e.activeLabel); };
  const onReqMouseUp   = () => {
    setReqDragging(false);
    if (!reqDragStart || !reqDragEnd || reqDragStart === reqDragEnd) { setReqDragStart(null); setReqDragEnd(null); return; }
    const src = timeline.find(t => t.time === reqDragStart);
    const end = timeline.find(t => t.time === reqDragEnd);
    if (!src || !end) { setReqDragStart(null); setReqDragEnd(null); return; }
    const [a, b] = src.timestamp <= end.timestamp ? [src, end] : [end, src];
    const win2 = { start: a.timestamp, end: b.timestamp, label: `${a.time} - ${b.time}` };
    setZoomWindow(win2);
    setReqDragStart(null); setReqDragEnd(null);
    setChartKey(k => k + 1);
    fetchOperations(win2);
    fetchOverall(win2);
    if (selectedApi) fetchApiDetail(selectedApi, win2);
  };
  const reqDragL = reqDragStart && reqDragEnd ? (reqDragStart < reqDragEnd ? reqDragStart : reqDragEnd) : null;
  const reqDragR = reqDragStart && reqDragEnd ? (reqDragStart < reqDragEnd ? reqDragEnd : reqDragStart) : null;

  const handleApiClick = (op) => { setSelectedApi(op); fetchApiDetail(op, zoomWindow); setPage(1); };
  const clearApi  = () => { setSelectedApi(null); setApiDetail(null); };
  const clearZoom = () => { setZoomWindow(null); fetchOperations(null); fetchOverall(null); if (selectedApi) fetchApiDetail(selectedApi, null); };
  const clearAll  = () => { clearApi(); clearZoom(); };

  const filtered   = operations.filter(o => o.operation?.toLowerCase().includes(search.toLowerCase()));
  const sorted     = [...filtered].sort((a, b) => { const av = a[sortKey] ?? 0, bv = b[sortKey] ?? 0; return sortDir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1); });
  const totalPages = Math.ceil(sorted.length / PAGE);
  const paged      = sorted.slice((page - 1) * PAGE, page * PAGE);
  const onSort     = (k) => { setSortKey(k); setSortDir(sortKey === k && sortDir === 'asc' ? 'desc' : 'asc'); };

  const rawChartData = selectedApi ? (apiDetail?.timeline ?? []) : timeline;
  const chartData    = zoomWindow && !selectedApi
    ? rawChartData.filter(d => d.timestamp >= zoomWindow.start && d.timestamp <= zoomWindow.end)
    : rawChartData;

  const chartColor = selectedApi ? T.blue : T.green;
  const spikes     = findSlowSpikes(chartData);
  const dragL      = dragStart && dragEnd ? (dragStart < dragEnd ? dragStart : dragEnd) : null;
  const dragR      = dragStart && dragEnd ? (dragStart < dragEnd ? dragEnd : dragStart) : null;

  const totalReqs    = operations.reduce((s, o) => s + (o.total || 0), 0);
  const totalSlow    = operations.reduce((s, o) => s + (o.slow  || 0), 0);
  const avgRt        = operations.length ? Math.round(operations.reduce((s, o) => s + (o.avgRt || 0), 0) / operations.length) : 0;
  const slowestApi   = operations.length ? operations.reduce((a, b) => (a.avgRt || 0) > (b.avgRt || 0) ? a : b) : null;

  const exportCsv = () => {
    if (selectedApi && apiDetail) {
      // Export full detail for selected API
      const rows = [
        ['API', selectedApi.operation],
        ['Period', customStart && customEnd ? `${customStart} to ${customEnd}` : `Last ${range}`],
        [],
        ['SUMMARY'],
        ['Total Requests', apiDetail.summary?.total ?? selectedApi.total],
        ['Success', apiDetail.summary?.success ?? '-'],
        ['Failed', apiDetail.summary?.failed ?? selectedApi.errors],
        ['Avg RT (ms)', apiDetail.summary?.avgRt ?? selectedApi.avgRt],
        ['Min RT (ms)', apiDetail.summary?.minRt ?? '-'],
        ['Max RT (ms)', apiDetail.summary?.maxRt ?? '-'],
        ['P50 (ms)', apiDetail.summary?.p50 ?? '-'],
        ['P95 (ms)', apiDetail.summary?.p95 ?? '-'],
        ['P99 (ms)', apiDetail.summary?.p99 ?? '-'],
        ['Slow >2s', selectedApi.slow],
        ['Slow %', selectedApi.slowPct?.toFixed(1) + '%'],
        ['Error %', selectedApi.errorRate?.toFixed(2) + '%'],
        [],
        ['STATUS CODES'],
        ['Code', 'Count'],
        ...(apiDetail.statusCodes || []).map(s => [s.code, s.count]),
        [],
        ['DEPENDENCIES'],
        ['Name', 'Type', 'Avg RT (ms)', 'Total Calls', 'Failed'],
        ...(apiDetail.dependencies || []).map(d => [d.name, d.type, d.avgRt, d.total, d.failed]),
      ];
      const blob = new Blob([rows.map(r => r.join(',')).join('\n')], { type: 'text/csv' });
      Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `perf-detail-${selectedApi.operation.replace(/[^a-z0-9]/gi,'_')}-${Date.now()}.csv` }).click();
    } else {
      // Export ALL operations (not just current page)
      const rows = [['API','Total','Success','Failed','Avg RT(ms)','Slow >2s','Slow%','Error%'],
        ...sorted.map(o => [
          `"${(o.operation || '').replace(/"/g, '""')}"`,
          o.total,
          (o.total - (o.errors || 0)),
          o.errors || 0,
          o.avgRt,
          o.slow,
          o.slowPct?.toFixed(1),
          o.errorRate?.toFixed(2)
        ])];
      const blob = new Blob([rows.map(r => r.join(',')).join('\n')], { type: 'text/csv' });
      Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `performance-all-${Date.now()}.csv` }).click();
    }
  };

  const ChartTooltip = makeTooltip(T);
  const btn = (active, color) => ({
    display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 11px', fontSize: 11, fontWeight: 500,
    background: active ? `${color}18` : 'transparent', border: `1px solid ${active ? color + '55' : T.border2}`,
    color: active ? color : T.muted, cursor: 'pointer', transition: 'border-color 0.12s, color 0.12s', letterSpacing: '0.02em',
  });

  return (
    <div style={{ background: T.bg, minHeight: '100vh', color: T.text, fontFamily: "'Inter', system-ui, sans-serif", fontSize: 13, transition: 'background 0.2s, color 0.2s' }}>      {loadingMain && (<div style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}><div style={{ width: 48, height: 48, border: '3px solid rgba(255,255,255,0.15)', borderTopColor: '#5794f2', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /><div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>Loading performance data...</div><div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>Querying App Insights</div></div>)}


      {/* HEADER */}
      <div style={{ background: T.surface, borderBottom: `1px solid ${T.border}`, padding: '0 24px', transition: 'background 0.2s' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 50 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <span style={{ fontWeight: 600, color: T.text }}>Performance</span>
            {selectedApi && (
              <>
                <span style={{ color: T.dim, margin: '0 2px' }}>/</span>
                <button onClick={clearApi} style={{ ...btn(false, T.blue), padding: '2px 8px', fontSize: 11 }}>Back</button>
                <span style={{ color: T.dim, margin: '0 2px' }}>/</span>
                <span style={{ color: T.blue, fontSize: 11, maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedApi.operation}</span>
              </>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {(zoomWindow || selectedApi) && (
              <button onClick={clearAll} style={{ ...btn(true, T.red) }}>x Clear</button>
            )}
            <button onClick={() => { clearAll(); fetchTimeline(); }} disabled={loadingMain} style={{ ...btn(false, T.blue), color: loadingMain ? T.dim : T.muted }}>
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
                  {customStart && customEnd ? `${new Date(customStart).toLocaleDateString('en-GB',{day:'2-digit',month:'short'})} - ${new Date(customEnd).toLocaleDateString('en-GB',{day:'2-digit',month:'short'})}` : 'Select range'}
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
            <button onClick={exportCsv} style={{ ...btn(false, T.green) }}>{selectedApi ? 'Export Detail' : 'Export CSV'}</button>
          </div>
        </div>

        {/* metric strip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, borderTop: `1px solid ${T.border}`, height: 46 }}>
          {[
            { label: 'Avg Response',  value: loadingOps ? null : `${avgRt}ms`,       color: rtColor(avgRt, T) },
            { label: 'Requests',      value: loadingOps ? null : fmt(totalReqs),      color: T.text },
            { label: 'Slow >2s',      value: loadingOps ? null : fmt(totalSlow),      color: T.orange },
            { label: 'Slowest API',   value: loadingOps ? null : (slowestApi ? `${slowestApi.avgRt}ms` : '-'), color: slowestApi ? rtColor(slowestApi.avgRt, T) : T.muted },
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
                  <button onClick={clearZoom} style={{ background: 'none', border: 'none', color: T.muted, cursor: 'pointer', fontSize: 12, padding: 0 }}>x</button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* BODY */}
      <div style={{ padding: '18px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* CHARTS ROW */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

          {/* TOTAL REQUESTS CHART - first, with drag-to-zoom */}
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, transition: 'background 0.2s' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 18px', borderBottom: `1px solid ${T.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: T.blue, boxShadow: `0 0 5px ${T.blue}80` }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: T.text }}>Total Requests</span>
                {zoomWindow && (
                  <span style={{ fontSize: 10, color: T.blue, background: `${T.blue}14`, border: `1px solid ${T.blue}30`, padding: '2px 8px' }}>
                    {zoomWindow.label}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 10, color: T.muted }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 10, height: 2, background: T.blue, display: 'inline-block', borderRadius: 1 }} />Total
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 10, height: 2, background: T.orange, display: 'inline-block', borderRadius: 1 }} />Slow &gt;2s
                </span>
                <span style={{ color: T.dim }}>Drag to zoom</span>
              </div>
            </div>
            <div style={{ padding: '14px 8px 6px', background: T.chartBg, transition: 'background 0.2s' }}>
              {loadingMain ? (
                <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.dim, fontSize: 12 }}>Loading...</div>
              ) : (selectedApi ? apiDetail?.timeline ?? [] : timeline).length === 0 ? (
                <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.dim, fontSize: 12 }}>No data</div>
              ) : (
                <ResponsiveContainer key={`req-${chartKey}`} width="100%" height={200}>
                  <AreaChart
                    data={zoomWindow && !selectedApi
                      ? (selectedApi ? apiDetail?.timeline ?? [] : timeline).filter(d => d.timestamp >= zoomWindow.start && d.timestamp <= zoomWindow.end)
                      : (selectedApi ? apiDetail?.timeline ?? [] : timeline)}
                    onMouseDown={onReqMouseDown} onMouseMove={onReqMouseMove} onMouseUp={onReqMouseUp}
                    style={{ cursor: reqDragging ? 'col-resize' : 'crosshair', userSelect: 'none' }}>
                    <defs>
                      <linearGradient id="reqGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={T.blue} stopOpacity={0.18} />
                        <stop offset="95%" stopColor={T.blue} stopOpacity={0.01} />
                      </linearGradient>
                      <linearGradient id="slowGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={T.orange} stopOpacity={0.15} />
                        <stop offset="95%" stopColor={T.orange} stopOpacity={0.01} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="0" stroke={T.gridLine} vertical={false} />
                    <XAxis dataKey="time" tick={{ fill: T.muted, fontSize: 10 }} axisLine={{ stroke: T.border }} tickLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fill: T.muted, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={fmt} width={50} />
                    <Tooltip
                      contentStyle={{ background: T.surface, border: `1px solid ${T.border2}`, borderRadius: 4, fontSize: 11, padding: '8px 12px' }}
                      labelStyle={{ color: T.muted, fontSize: 10, marginBottom: 4 }}
                      formatter={(val, name) => [fmt(val), name]}
                      cursor={{ stroke: T.border2, strokeWidth: 1 }}
                    />
                    <Area type="monotone" dataKey="total" name="Total" stroke={T.blue} strokeWidth={2} fill="url(#reqGrad)"
                      dot={false} activeDot={{ r: 4, fill: T.blue, stroke: T.chartBg, strokeWidth: 2 }} isAnimationActive={false} />
                    <Area type="monotone" dataKey="slow" name="Slow >2s" stroke={T.orange} strokeWidth={1.5} fill="url(#slowGrad)"
                      dot={false} activeDot={{ r: 4, fill: T.orange, stroke: T.chartBg, strokeWidth: 2 }} isAnimationActive={false} />
                    {reqDragL && reqDragR && (
                      <ReferenceArea x1={reqDragL} x2={reqDragR} fill={`${T.blue}18`} stroke={`${T.blue}70`} strokeWidth={1} />
                    )}
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* AVG RESPONSE TIME CHART - second, with drag-to-zoom */}
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, transition: 'background 0.2s' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 18px', borderBottom: `1px solid ${T.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: chartColor, boxShadow: `0 0 5px ${chartColor}80` }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: T.text }}>
                  {selectedApi ? selectedApi.operation : 'Avg Response Time'}
                </span>
                {zoomWindow && !selectedApi && (
                  <span style={{ fontSize: 10, color: T.blue, background: `${T.blue}14`, border: `1px solid ${T.blue}30`, padding: '2px 8px' }}>
                    {zoomWindow.label}
                  </span>
                )}
                {spikes.length > 0 && (
                  <span style={{ fontSize: 10, color: T.orange, background: `${T.orange}14`, border: `1px solid ${T.orange}30`, padding: '2px 8px', letterSpacing: '0.04em', fontWeight: 600 }}>
                    {spikes.length} SLOW SPIKE{spikes.length > 1 ? 'S' : ''}
                  </span>
                )}
                {loadingDetail && selectedApi && <span style={{ fontSize: 10, color: T.muted }}>loading...</span>}
              </div>
              <span style={{ fontSize: 10, color: T.dim }}>Drag to zoom - Click row to drill down</span>
            </div>
            <div style={{ padding: '14px 8px 6px', background: T.chartBg, transition: 'background 0.2s' }}>
              {loadingMain ? (
                <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.dim, fontSize: 12 }}>Loading...</div>
              ) : chartData.length === 0 ? (
                <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.dim, fontSize: 12 }}>No data</div>
              ) : (
                <ResponsiveContainer key={chartKey} width="100%" height={200}>
                  <AreaChart data={chartData} onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp}
                    style={{ cursor: isDragging ? 'col-resize' : 'crosshair', userSelect: 'none' }}>
                    <defs>
                      <linearGradient id="perfGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={chartColor} stopOpacity={0.18} />
                        <stop offset="95%" stopColor={chartColor} stopOpacity={0.01} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="0" stroke={T.gridLine} vertical={false} />
                    <XAxis dataKey="time" tick={{ fill: T.muted, fontSize: 10 }} axisLine={{ stroke: T.border }} tickLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fill: T.muted, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}ms`} width={58} />
                    <Tooltip content={<ChartTooltip />} cursor={{ stroke: T.border2, strokeWidth: 1 }} />
                    <Area type="monotone" dataKey="avgRt" name="Avg RT" stroke={chartColor} strokeWidth={2} fill="url(#perfGrad)"
                      dot={false} activeDot={{ r: 5, fill: chartColor, stroke: T.chartBg, strokeWidth: 2 }}
                      isAnimationActive={!animatedRef.current} animationDuration={700} animationEasing="ease-out"
                      onAnimationEnd={() => { animatedRef.current = true; }} />
                    {spikes.map((s, i) => (
                      <ReferenceLine key={i} x={s.time} stroke={`${T.orange}50`} strokeDasharray="3 4" strokeWidth={1} />
                    ))}
                    {dragL && dragR && (
                      <ReferenceArea x1={dragL} x2={dragR} fill={`${T.blue}18`} stroke={`${T.blue}70`} strokeWidth={1} />
                    )}
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

        </div>

        {/* BOTTOM GRID */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 296px', gap: 14, alignItems: 'start' }}>
          {/* TABLE */}
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, transition: 'background 0.2s' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 18px', borderBottom: `1px solid ${T.border}` }}>
              <div>
                <span style={{ fontSize: 12, fontWeight: 600, color: T.text }}>Operations</span>
                <span style={{ marginLeft: 8, fontSize: 10, color: T.muted }}>
                  {loadingOps ? 'Loading...' : `${sorted.length} APIs`}
                </span>
              </div>
              <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Filter by name..."
                style={{ background: T.inputBg, border: `1px solid ${T.border2}`, padding: '5px 10px', color: T.text, fontSize: 11, width: 210, outline: 'none' }} />
            </div>
            <div style={{ maxHeight: 520, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                <tr>
                  <TH label="API Name"  k="operation" sortKey={sortKey} sortDir={sortDir} onSort={onSort} align="left" T={T} />
                  <TH label="Requests"  k="total"     sortKey={sortKey} sortDir={sortDir} onSort={onSort} T={T} />
                  <TH label="Avg RT"    k="avgRt"     sortKey={sortKey} sortDir={sortDir} onSort={onSort} T={T} />
                  <TH label="Slow >2s"  k="slow"      sortKey={sortKey} sortDir={sortDir} onSort={onSort} T={T} />
                  <TH label="Slow %"    k="slowPct"   sortKey={sortKey} sortDir={sortDir} onSort={onSort} T={T} />
                  <TH label="Error %"   k="errorRate" sortKey={sortKey} sortDir={sortDir} onSort={onSort} T={T} />
                  <th style={{ textAlign: 'center', padding: '9px 14px', color: T.muted, fontWeight: 500, fontSize: 11, borderBottom: `1px solid ${T.border}`, background: T.panel }}>Trend</th>
                </tr>
              </thead>
              <tbody>
                {loadingOps ? (
                  Array(8).fill(0).map((_, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${T.border}` }}>
                      {[320, 48, 52, 44, 44, 44, 52].map((w, j) => (
                        <td key={j} style={{ padding: '10px 14px' }}>
                          <div className="gf-skeleton" style={{ height: 11, width: w, marginLeft: j === 0 ? 0 : 'auto' }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : paged.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: 48, color: T.dim, fontSize: 12 }}>{search ? 'No matching APIs' : 'No data'}</td></tr>
                ) : paged.map((op, i) => {
                  const active = selectedApi?.operation === op.operation;
                  const sparkVals = [op.avgRt || 0];
                  return (
                    <tr key={i} onClick={() => handleApiClick(op)}
                      style={{ borderBottom: `1px solid ${T.border}`, cursor: 'pointer', background: active ? `${T.blue}0a` : 'transparent', transition: 'background 0.1s' }}
                      onMouseEnter={e => { if (!active) e.currentTarget.style.background = T.panel; }}
                      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}>
                      <td style={{ padding: '10px 14px', color: active ? T.blue : T.text, fontWeight: active ? 500 : 400, maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', borderLeft: `2px solid ${active ? T.blue : 'transparent'}` }}>
                        {op.operation}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', color: T.text, fontVariantNumeric: 'tabular-nums' }}>{fmt(op.total)}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', color: rtColor(op.avgRt, T), fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{op.avgRt}ms</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', color: op.slow > 0 ? T.orange : T.muted, fontVariantNumeric: 'tabular-nums' }}>{fmt(op.slow)}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                        <span style={{ color: pctColor(op.slowPct, T), fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>{op.slowPct?.toFixed(1)}%</span>
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                        <span style={{ color: op.errorRate > 0 ? T.red : T.muted, fontVariantNumeric: 'tabular-nums' }}>{op.errorRate?.toFixed(1)}%</span>
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        <Spark vals={sparkVals} color={rtColor(op.avgRt, T)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 18px', borderTop: `1px solid ${T.border}`, fontSize: 11, color: T.muted }}>
                <span>{(page-1)*PAGE+1}-{Math.min(page*PAGE, sorted.length)} of {sorted.length}</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  {[['<', page > 1, () => setPage(p => p - 1)], ['>', page < totalPages, () => setPage(p => p + 1)]].map(([l, en, fn]) => (
                    <button key={l} onClick={fn} disabled={!en} style={{ width: 26, height: 26, background: 'none', border: `1px solid ${en ? T.border2 : T.border}`, color: en ? T.text : T.dim, cursor: en ? 'pointer' : 'not-allowed', fontSize: 13 }}>{l}</button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT PANEL */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {selectedApi ? (
              /* -- SELECTED API DETAIL PANEL -- */
              <div style={{ background: T.surface, border: `1px solid ${T.border}`, transition: 'background 0.2s' }}>
                <div style={{ padding: '10px 16px', borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: T.text }}>API Detail</span>
                    {loadingDetail && <span style={{ fontSize: 10, color: T.muted }}>loading...</span>}
                  </div>
                  <button onClick={exportCsv} style={{ fontSize: 10, padding: '3px 9px', background: `${T.green}14`, border: `1px solid ${T.green}40`, color: T.green, cursor: 'pointer', borderRadius: 2 }}>
                    Export Detail CSV
                  </button>
                </div>
                <div style={{ padding: 14, maxHeight: 680, overflowY: 'auto' }}>

                  {/* API name */}
                  <div style={{ fontSize: 11, color: T.blue, fontWeight: 500, marginBottom: 12, wordBreak: 'break-all', lineHeight: 1.4 }}>{selectedApi.operation}</div>

                  {/* Summary grid — 3 cols */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, marginBottom: 14, border: `1px solid ${T.border}` }}>
                    {[
                      ['Total',    fmt(apiDetail?.summary?.total ?? selectedApi.total),                         T.text],
                      ['Success',  apiDetail?.summary ? fmt(apiDetail.summary.success) : '-',                   T.green],
                      ['Failed',   apiDetail?.summary ? fmt(apiDetail.summary.failed)  : fmt(selectedApi.errors || 0), T.red],
                      ['Avg RT',   `${apiDetail?.summary?.avgRt ?? selectedApi.avgRt}ms`,                       rtColor(selectedApi.avgRt, T)],
                      ['P95',      apiDetail?.summary ? `${apiDetail.summary.p95}ms` : '-',                     T.orange],
                      ['P99',      apiDetail?.summary ? `${apiDetail.summary.p99}ms` : '-',                     T.red],
                      ['Min RT',   apiDetail?.summary ? `${apiDetail.summary.minRt}ms` : '-',                   T.green],
                      ['Max RT',   apiDetail?.summary ? `${apiDetail.summary.maxRt}ms` : '-',                   T.red],
                      ['Slow >2s', fmt(selectedApi.slow),                                                       T.orange],
                    ].map(([l, v, c], idx) => (
                      <div key={l} style={{ padding: '9px 10px', background: idx % 2 === 0 ? T.panel : T.surface, borderRight: (idx % 3 !== 2) ? `1px solid ${T.border}` : 'none', borderBottom: idx < 6 ? `1px solid ${T.border}` : 'none' }}>
                        <div style={{ fontSize: 9, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{l}</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: c, fontVariantNumeric: 'tabular-nums' }}>{v}</div>
                      </div>
                    ))}
                  </div>

                  {/* Status Codes */}
                  {loadingDetail ? (
                    <div style={{ marginBottom: 14 }}>
                      <SectionLabel T={T}>Status Codes</SectionLabel>
                      {Array(4).fill(0).map((_, i) => <div key={i} className="gf-skeleton" style={{ height: 22, marginBottom: 6, borderRadius: 2 }} />)}
                    </div>
                  ) : apiDetail?.statusCodes?.length > 0 && (
                    <div style={{ marginBottom: 14 }}>
                      <SectionLabel T={T}>Status Codes</SectionLabel>
                      {apiDetail.statusCodes.map((sc, i) => {
                        const total = apiDetail.statusCodes.reduce((s, x) => s + x.count, 0);
                        const pct = total > 0 ? (sc.count / total) * 100 : 0;
                        return (
                          <div key={i} style={{ marginBottom: 8 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontSize: 11, fontWeight: 700, color: codeColor(sc.code, T), fontVariantNumeric: 'tabular-nums', minWidth: 36 }}>{sc.code}</span>
                                <span style={{ fontSize: 10, color: T.dim }}>
                                  {sc.code.startsWith('2') ? 'Success' : sc.code.startsWith('4') ? 'Client Error' : sc.code.startsWith('5') ? 'Server Error' : sc.code.startsWith('3') ? 'Redirect' : ''}
                                </span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: 11, color: T.muted, fontVariantNumeric: 'tabular-nums' }}>{fmt(sc.count)}</span>
                                <span style={{ fontSize: 10, color: codeColor(sc.code, T), fontWeight: 600, minWidth: 38, textAlign: 'right' }}>{pct.toFixed(1)}%</span>
                              </div>
                            </div>
                            <div style={{ background: T.border, height: 5, borderRadius: 2, overflow: 'hidden' }}>
                              <div style={{ background: codeColor(sc.code, T), height: '100%', width: `${Math.min(pct, 100)}%`, transition: 'width 0.4s ease' }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Dependencies */}
                  {!loadingDetail && apiDetail?.dependencies?.length > 0 && (
                    <div>
                      <SectionLabel T={T}>Dependencies</SectionLabel>
                      {apiDetail.dependencies.map((dep, i) => (
                        <div key={i} style={{ marginBottom: 9 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
                            <span style={{ color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{dep.name}</span>
                            <span style={{ color: rtColor(dep.avgRt, T), fontWeight: 600, fontVariantNumeric: 'tabular-nums', marginLeft: 8, flexShrink: 0 }}>{dep.avgRt}ms</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: T.dim, marginBottom: 3 }}>
                            <span style={{ color: depTypeColor(dep.type, T) }}>{dep.type}</span>
                            <span>{fmt(dep.total)} calls{dep.failed > 0 ? ` · ${dep.failed} failed` : ''}</span>
                          </div>
                          <ProgBar pct={(dep.avgRt / (apiDetail.dependencies[0]?.avgRt || 1)) * 100} color={rtColor(dep.avgRt, T)} T={T} />
                        </div>
                      ))}
                    </div>
                  )}

                  {!loadingDetail && !apiDetail && (
                    <div style={{ textAlign: 'center', padding: 20, color: T.dim, fontSize: 11 }}>No detail data</div>
                  )}
                </div>
              </div>
            ) : (
              /* -- OVERALL SLOWEST DEPS (when no API selected) -- */
              <div style={{ background: T.surface, border: `1px solid ${T.border}`, transition: 'background 0.2s' }}>
                <div style={{ padding: '10px 16px', borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: T.text }}>Slowest Dependencies</span>
                  {zoomWindow && <span style={{ fontSize: 10, color: T.blue }}>zoomed</span>}
                </div>
                <div style={{ padding: 14 }}>
                  {!overall ? (
                    <div style={{ textAlign: 'center', padding: 24, color: T.dim, fontSize: 11 }}>Loading...</div>
                  ) : overall.dependencies?.length > 0 ? (
                    overall.dependencies.slice(0, 8).map((dep, i) => (
                      <div key={i} style={{ marginBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
                          <span style={{ color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{dep.name}</span>
                          <span style={{ color: rtColor(dep.avgRt, T), fontWeight: 600, fontVariantNumeric: 'tabular-nums', marginLeft: 8, flexShrink: 0 }}>{dep.avgRt}ms</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: T.dim, marginBottom: 2 }}>
                          <span style={{ color: depTypeColor(dep.type, T) }}>{dep.type}</span>
                          <span>{fmt(dep.total)} calls{dep.failed > 0 ? ` · ${dep.failed} failed` : ''}</span>
                        </div>
                        <ProgBar pct={(dep.avgRt / (overall.dependencies[0]?.avgRt || 1)) * 100} color={rtColor(dep.avgRt, T)} T={T} />
                      </div>
                    ))
                  ) : (
                    <div style={{ textAlign: 'center', padding: 24, color: T.dim, fontSize: 11 }}>No dependency data</div>
                  )}
                </div>
              </div>
            )}

            {/* TOP SLOW APIs */}
            {operations.length > 0 && (
              <div style={{ background: T.surface, border: `1px solid ${T.border}`, transition: 'background 0.2s' }}>
                <div style={{ padding: '10px 16px', borderBottom: `1px solid ${T.border}` }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: T.text }}>Top Slow APIs</span>
                </div>
                <div style={{ padding: '12px 14px' }}>
                  {[...operations].sort((a, b) => (b.slowPct || 0) - (a.slowPct || 0)).slice(0, 5).map((op, i) => (
                    <div key={i} style={{ marginBottom: 9, cursor: 'pointer' }} onClick={() => handleApiClick(op)}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 3 }}>
                        <span style={{ color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, maxWidth: 180 }}>{op.operation?.split(' - ').pop() || op.operation}</span>
                        <span style={{ color: pctColor(op.slowPct, T), fontWeight: 600, fontVariantNumeric: 'tabular-nums', marginLeft: 6, flexShrink: 0 }}>{op.slowPct?.toFixed(1)}%</span>
                      </div>
                      <ProgBar pct={op.slowPct || 0} color={pctColor(op.slowPct, T)} T={T} />
                    </div>
                  ))}
                </div>
              </div>
            )}

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

