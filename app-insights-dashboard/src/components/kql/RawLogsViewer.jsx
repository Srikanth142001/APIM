import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../../config/apiConfig';
import { useTheme } from '../../context/ThemeContext';
import DateRangePicker from '../ui/DateRangePicker';
import { FaTimes, FaSearch, FaSync, FaDownload, FaFilter, FaCalendarAlt } from 'react-icons/fa';
import { TIME_RANGES } from './KqlEditor';

/* ── highlight matching text ─────────────────────────────────────────────── */
const Highlight = ({ text, query }) => {
  if (!query || !text) return <>{String(text ?? '')}</>;
  const str   = String(text);
  const idx   = str.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{str}</>;
  return (
    <>
      {str.slice(0, idx)}
      <mark style={{ background: '#f2cc0c44', color: 'inherit', padding: 0 }}>
        {str.slice(idx, idx + query.length)}
      </mark>
      {str.slice(idx + query.length)}
    </>
  );
};

/* ══ main component ═══════════════════════════════════════════════════════════ */
const RawLogsViewer = ({ panel, onClose }) => {
  const { T, themeKey } = useTheme();
  const isLight = themeKey === 'light';

  /* ── state ── */
  const [rows,        setRows]        = useState([]);
  const [columns,     setColumns]     = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState(null);
  const [totalRows,   setTotalRows]   = useState(0);

  // time filter
  const [timeMode,    setTimeMode]    = useState('quick');   // 'quick' | 'custom'
  const [timeRange,   setTimeRange]   = useState(panel.timeRange || 'PT1H');
  const [customStart, setCustomStart] = useState('');
  const [customEnd,   setCustomEnd]   = useState('');
  const [showPicker,  setShowPicker]  = useState(false);
  const [pickerDates, setPickerDates] = useState({ startDate: null, endDate: null });
  const pickerRef = useRef(null);

  // search & filter
  const [globalSearch,  setGlobalSearch]  = useState('');
  const [colFilters,    setColFilters]     = useState({});   // { colName: value }
  const [showColFilter, setShowColFilter] = useState(false);
  const [sortCol,       setSortCol]        = useState(null);
  const [sortDir,       setSortDir]        = useState('asc');
  const [page,          setPage]           = useState(1);
  const PAGE = 100;

  /* ── close picker on outside click ── */
  useEffect(() => {
    const h = (e) => { if (pickerRef.current && !pickerRef.current.contains(e.target)) setShowPicker(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  /* ── fetch logs ── */
  const fetchLogs = useCallback(async () => {
    const query = panel.queries?.[0]?.kql;
    if (!query) { setError('No KQL query configured for this panel'); return; }

    setLoading(true); setError(null);
    try {
      const timespan = timeMode === 'custom' && customStart && customEnd
        ? undefined
        : timeRange;

      const payload = { query, timespan };
      if (timeMode === 'custom' && customStart && customEnd) {
        // Inject time filter into query
        payload.query = `let _start = datetime(${customStart});\nlet _end = datetime(${customEnd});\n${query}\n| where timestamp between (_start .. _end)`;
        payload.timespan = 'P30D'; // wide window, actual filter is in query
      }

      const res = await axios.post(`${API_BASE_URL}/api/kql/query`, payload);
      if (res.data.success && res.data.tables?.[0]) {
        const tbl = res.data.tables[0];
        setColumns(tbl.columns);
        setRows(tbl.rows);
        setTotalRows(tbl.rows.length);
        setPage(1);
      } else {
        setRows([]); setColumns([]); setTotalRows(0);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally { setLoading(false); }
  }, [panel.queries, timeRange, timeMode, customStart, customEnd]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  /* ── filtered + sorted rows ── */
  const processedRows = useMemo(() => {
    let result = rows;

    // global search across all columns
    if (globalSearch.trim()) {
      const q = globalSearch.toLowerCase();
      result = result.filter(row =>
        row.some(cell => String(cell ?? '').toLowerCase().includes(q))
      );
    }

    // per-column filters
    Object.entries(colFilters).forEach(([colName, val]) => {
      if (!val.trim()) return;
      const colIdx = columns.findIndex(c => c.name === colName);
      if (colIdx === -1) return;
      const q = val.toLowerCase();
      result = result.filter(row => String(row[colIdx] ?? '').toLowerCase().includes(q));
    });

    // sort
    if (sortCol !== null) {
      const idx = sortCol;
      result = [...result].sort((a, b) => {
        const av = a[idx] ?? '';
        const bv = b[idx] ?? '';
        const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }

    return result;
  }, [rows, globalSearch, colFilters, sortCol, sortDir, columns]);

  const totalPages  = Math.ceil(processedRows.length / PAGE);
  const pagedRows   = processedRows.slice((page - 1) * PAGE, page * PAGE);

  const handleSort = (idx) => {
    if (sortCol === idx) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(idx); setSortDir('asc'); }
  };

  /* ── CSV export ── */
  const exportCsv = () => {
    const header = columns.map(c => c.name).join(',');
    const body   = processedRows.map(row =>
      row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')
    ).join('\n');
    const blob = new Blob([header + '\n' + body], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    Object.assign(document.createElement('a'), { href: url, download: `${panel.title}-logs-${Date.now()}.csv` }).click();
    URL.revokeObjectURL(url);
  };

  /* ── active col filters count ── */
  const activeFilters = Object.values(colFilters).filter(v => v.trim()).length;

  /* ── shared input style ── */
  const inp = {
    padding: '5px 10px', fontSize: 11,
    background: T.inputBg, border: `1px solid ${T.border2}`,
    color: T.text, outline: 'none',
  };

  const btn = (active, color) => ({
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '5px 11px', fontSize: 11, fontWeight: 500,
    background: active ? `${color}18` : 'transparent',
    border: `1px solid ${active ? color + '55' : T.border2}`,
    color: active ? color : T.muted,
    cursor: 'pointer', transition: 'all 0.12s', letterSpacing: '0.02em',
  });

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 2000, padding: 20,
    }}>
      <div style={{
        background: T.surface,
        border: `1px solid ${T.border}`,
        width: '100%', maxWidth: 1300,
        height: '90vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
      }}>

        {/* ── modal header ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 18px', borderBottom: `1px solid ${T.border}`, background: T.panel, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 3, height: 16, background: T.blue, display: 'inline-block' }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Raw Logs — {panel.title}</span>
            {!loading && (
              <span style={{ fontSize: 11, color: T.muted, background: T.panel, border: `1px solid ${T.border2}`, padding: '2px 8px' }}>
                {processedRows.length.toLocaleString()} / {totalRows.toLocaleString()} rows
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button onClick={exportCsv} style={btn(false, T.green)} title="Export CSV"
              onMouseEnter={e => { e.currentTarget.style.borderColor = T.green; e.currentTarget.style.color = T.green; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = T.border2; e.currentTarget.style.color = T.muted; }}
            >
              <FaDownload style={{ fontSize: 10 }} /> Export CSV
            </button>
            <button onClick={fetchLogs} disabled={loading} style={btn(false, T.blue)}
              onMouseEnter={e => { e.currentTarget.style.borderColor = T.blue; e.currentTarget.style.color = T.blue; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = T.border2; e.currentTarget.style.color = T.muted; }}
            >
              <FaSync style={{ fontSize: 10, animation: loading ? 'kql-spin 0.8s linear infinite' : 'none' }} />
              {loading ? 'Loading…' : 'Refresh'}
            </button>
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: T.muted, cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '2px 4px' }}
              onMouseEnter={e => e.currentTarget.style.color = T.text}
              onMouseLeave={e => e.currentTarget.style.color = T.muted}
            >
              <FaTimes />
            </button>
          </div>
        </div>

        {/* ── toolbar ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderBottom: `1px solid ${T.border}`, background: T.panel, flexShrink: 0, flexWrap: 'wrap' }}>

          {/* global search */}
          <div style={{ position: 'relative', flex: 1, minWidth: 200, maxWidth: 360 }}>
            <FaSearch style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: T.dim, fontSize: 10, pointerEvents: 'none' }} />
            <input
              type="text"
              value={globalSearch}
              onChange={e => { setGlobalSearch(e.target.value); setPage(1); }}
              placeholder="Search all columns…"
              style={{ ...inp, paddingLeft: 26, width: '100%', boxSizing: 'border-box' }}
            />
            {globalSearch && (
              <button onClick={() => setGlobalSearch('')}
                style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: T.dim, cursor: 'pointer', fontSize: 12, lineHeight: 1 }}>
                ×
              </button>
            )}
          </div>

          {/* column filter toggle */}
          <button onClick={() => setShowColFilter(v => !v)}
            style={btn(showColFilter || activeFilters > 0, T.orange)}
            onMouseEnter={e => { e.currentTarget.style.borderColor = T.orange; e.currentTarget.style.color = T.orange; }}
            onMouseLeave={e => { if (!showColFilter && !activeFilters) { e.currentTarget.style.borderColor = T.border2; e.currentTarget.style.color = T.muted; }}}
          >
            <FaFilter style={{ fontSize: 9 }} />
            Column Filters {activeFilters > 0 && `(${activeFilters})`}
          </button>

          {activeFilters > 0 && (
            <button onClick={() => setColFilters({})} style={btn(false, T.red)}
              onMouseEnter={e => { e.currentTarget.style.borderColor = T.red; e.currentTarget.style.color = T.red; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = T.border2; e.currentTarget.style.color = T.muted; }}
            >
              Clear Filters
            </button>
          )}

          <div style={{ width: 1, height: 18, background: T.border2 }} />

          {/* time mode toggle */}
          <div style={{ display: 'flex', border: `1px solid ${T.border2}`, overflow: 'hidden' }}>
            {[['quick', 'Quick'], ['custom', 'Custom']].map(([m, l]) => (
              <button key={m} onClick={() => { setTimeMode(m); if (m === 'quick') { setCustomStart(''); setCustomEnd(''); setShowPicker(false); } else setShowPicker(v => !v); }}
                style={{ padding: '5px 11px', fontSize: 11, fontWeight: 500, cursor: 'pointer', border: 'none', background: timeMode === m ? T.border2 : 'transparent', color: timeMode === m ? T.text : T.muted, transition: 'all 0.12s' }}>
                {l}
              </button>
            ))}
          </div>

          {/* quick range selector */}
          {timeMode === 'quick' && (
            <select value={timeRange} onChange={e => { setTimeRange(e.target.value); setPage(1); }}
              style={{ ...inp, cursor: 'pointer' }}>
              {TIME_RANGES.map(t => <option key={t.value} value={t.value} style={{ background: T.surface }}>{t.label}</option>)}
            </select>
          )}

          {/* custom date button */}
          {timeMode === 'custom' && (
            <div style={{ position: 'relative' }}>
              <button onClick={() => setShowPicker(v => !v)}
                style={btn(!!customStart, T.blue)}
                onMouseEnter={e => { e.currentTarget.style.borderColor = T.blue; e.currentTarget.style.color = T.blue; }}
                onMouseLeave={e => { if (!customStart) { e.currentTarget.style.borderColor = T.border2; e.currentTarget.style.color = T.muted; }}}
              >
                <FaCalendarAlt style={{ fontSize: 10 }} />
                {customStart && customEnd
                  ? `${new Date(customStart).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} – ${new Date(customEnd).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}`
                  : 'Select range'}
              </button>
              {showPicker && (
                <div ref={pickerRef} style={{ position: 'absolute', top: 36, left: 0, zIndex: 100 }}>
                  <DateRangePicker
                    startDate={pickerDates.startDate}
                    endDate={pickerDates.endDate}
                    onChange={({ startDate, endDate }) => setPickerDates({ startDate, endDate })}
                    onApply={(s, e) => { setCustomStart(s); setCustomEnd(e); setShowPicker(false); setPage(1); }}
                    onClear={() => { setPickerDates({ startDate: null, endDate: null }); setCustomStart(''); setCustomEnd(''); }}
                  />
                </div>
              )}
            </div>
          )}

          {customStart && customEnd && (
            <button onClick={() => { setCustomStart(''); setCustomEnd(''); setPickerDates({ startDate: null, endDate: null }); }}
              style={{ ...inp, cursor: 'pointer', color: T.red, border: `1px solid ${T.red}44`, background: `${T.red}0a` }}>
              ✕ Clear
            </button>
          )}
        </div>

        {/* ── column filters row ── */}
        {showColFilter && columns.length > 0 && (
          <div style={{ display: 'flex', gap: 8, padding: '8px 18px', borderBottom: `1px solid ${T.border}`, background: T.chartBg, flexShrink: 0, overflowX: 'auto' }}>
            {columns.map(col => (
              <div key={col.name} style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 140 }}>
                <label style={{ fontSize: 10, color: T.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {col.name}
                </label>
                <input
                  type="text"
                  value={colFilters[col.name] || ''}
                  onChange={e => { setColFilters(p => ({ ...p, [col.name]: e.target.value })); setPage(1); }}
                  placeholder={`Filter ${col.name}…`}
                  style={{ ...inp, fontSize: 11, width: '100%', boxSizing: 'border-box' }}
                />
              </div>
            ))}
          </div>
        )}

        {/* ── error ── */}
        {error && (
          <div style={{ padding: '10px 18px', background: `${T.red}14`, border: `1px solid ${T.red}44`, color: T.red, fontSize: 12, flexShrink: 0 }}>
            ⚠ {error}
          </div>
        )}

        {/* ── table ── */}
        <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, color: T.dim, fontSize: 12 }}>
              <svg style={{ width: 22, height: 22, animation: 'kql-spin 0.8s linear infinite' }} viewBox="0 0 24 24" fill="none" stroke={T.blue} strokeWidth="2.5">
                <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
              </svg>
              Loading logs…
            </div>
          ) : columns.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: T.dim, fontSize: 12 }}>
              No data — adjust the time range or check your query
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 5 }}>
                <tr style={{ background: T.panel }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left', color: T.muted, fontWeight: 600, borderBottom: `1px solid ${T.border}`, whiteSpace: 'nowrap', width: 40, fontSize: 10 }}>#</th>
                  {columns.map((col, i) => (
                    <th key={i} onClick={() => handleSort(i)}
                      style={{ padding: '8px 12px', textAlign: 'left', color: sortCol === i ? T.text : T.muted, fontWeight: 600, borderBottom: `1px solid ${T.border}`, whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none', transition: 'color 0.12s' }}
                      onMouseEnter={e => e.currentTarget.style.color = T.text}
                      onMouseLeave={e => e.currentTarget.style.color = sortCol === i ? T.text : T.muted}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {col.name}
                        <span style={{ fontSize: 9, color: sortCol === i ? T.blue : T.dim }}>
                          {sortCol === i ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                        </span>
                      </span>
                      <div style={{ fontSize: 9, color: T.dim, fontWeight: 400, marginTop: 1 }}>{col.type}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pagedRows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length + 1} style={{ textAlign: 'center', padding: 40, color: T.dim, fontSize: 12 }}>
                      No rows match your search / filters
                    </td>
                  </tr>
                ) : pagedRows.map((row, ri) => (
                  <tr key={ri}
                    style={{ borderBottom: `1px solid ${T.border}`, transition: 'background 0.1s' }}
                    onMouseEnter={e => e.currentTarget.style.background = T.panel}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '6px 12px', color: T.dim, fontVariantNumeric: 'tabular-nums', fontSize: 10 }}>
                      {(page - 1) * PAGE + ri + 1}
                    </td>
                    {row.map((cell, ci) => {
                      const colName = columns[ci]?.name;
                      const colFilter = colFilters[colName] || '';
                      const searchTerm = globalSearch || colFilter;
                      const str = cell === null || cell === undefined ? '' : String(cell);

                      // colour-code certain column types
                      let cellColor = T.text;
                      if (columns[ci]?.type === 'datetime') cellColor = T.cyan || T.blue;
                      else if (typeof cell === 'number') cellColor = T.green;
                      else if (str === 'true')  cellColor = T.green;
                      else if (str === 'false') cellColor = T.red;

                      return (
                        <td key={ci} style={{ padding: '6px 12px', color: cellColor, maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}
                          title={str}
                        >
                          <Highlight text={str} query={searchTerm} />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ── pagination footer ── */}
        {!loading && processedRows.length > PAGE && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 18px', borderTop: `1px solid ${T.border}`, background: T.panel, flexShrink: 0, fontSize: 11, color: T.muted }}>
            <span>
              Showing {(page - 1) * PAGE + 1}–{Math.min(page * PAGE, processedRows.length)} of {processedRows.length.toLocaleString()} rows
              {processedRows.length < totalRows && ` (filtered from ${totalRows.toLocaleString()})`}
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => setPage(1)} disabled={page === 1} style={{ ...inp, cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.4 : 1 }}>«</button>
              <button onClick={() => setPage(p => p - 1)} disabled={page === 1} style={{ ...inp, cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.4 : 1 }}>‹</button>
              {/* page numbers */}
              {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                let p;
                if (totalPages <= 7) p = i + 1;
                else if (page <= 4) p = i + 1;
                else if (page >= totalPages - 3) p = totalPages - 6 + i;
                else p = page - 3 + i;
                return (
                  <button key={p} onClick={() => setPage(p)}
                    style={{ ...inp, cursor: 'pointer', minWidth: 28, textAlign: 'center', background: page === p ? `${T.blue}22` : T.inputBg, color: page === p ? T.blue : T.muted, border: `1px solid ${page === p ? T.blue + '55' : T.border2}` }}>
                    {p}
                  </button>
                );
              })}
              <button onClick={() => setPage(p => p + 1)} disabled={page === totalPages} style={{ ...inp, cursor: page === totalPages ? 'not-allowed' : 'pointer', opacity: page === totalPages ? 0.4 : 1 }}>›</button>
              <button onClick={() => setPage(totalPages)} disabled={page === totalPages} style={{ ...inp, cursor: page === totalPages ? 'not-allowed' : 'pointer', opacity: page === totalPages ? 0.4 : 1 }}>»</button>
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes kql-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default RawLogsViewer;
