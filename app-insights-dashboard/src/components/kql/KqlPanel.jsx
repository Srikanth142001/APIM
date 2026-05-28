import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../../config/apiConfig';
import { useTheme } from '../../context/ThemeContext';
import { FaSync, FaCopy, FaTrash, FaExpand, FaCompress, FaClock, FaTable } from 'react-icons/fa';
import TimeSeriesChart from './visualizations/TimeSeriesChart';
import TableViz from '../customDb/visualizations/TableViz';
import StatViz from '../customDb/visualizations/StatViz';
import BarChartViz from '../customDb/visualizations/BarChartViz';
import PieChartViz from '../customDb/visualizations/PieChartViz';
import GaugeViz from '../customDb/visualizations/GaugeViz';
import RawLogsViewer from './RawLogsViewer';

const MIN_W = 320;
const MIN_H = 180;
const MAX_H = 1200;
const DEFAULT_H = 300;

/* ── tiny icon button ─────────────────────────────────────────────────────── */
const PBtn = ({ onClick, disabled, title, children, T, danger, active }) => (
  <button onClick={onClick} disabled={disabled} title={title}
    style={{
      padding: '5px 6px',
      background: active ? `${T.blue}22` : 'transparent',
      border: active ? `1px solid ${T.blue}44` : '1px solid transparent',
      color: danger ? T.red : active ? T.blue : T.dim,
      cursor: disabled ? 'not-allowed' : 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      opacity: disabled ? 0.4 : 1, transition: 'color 0.12s, background 0.12s',
    }}
    onMouseEnter={e => { if (!disabled) e.currentTarget.style.color = danger ? T.red : T.text; }}
    onMouseLeave={e => { e.currentTarget.style.color = danger ? T.red : active ? T.blue : T.dim; }}
  >
    {children}
  </button>
);

/* ══ main component ═══════════════════════════════════════════════════════════ */
const KqlPanel = ({ panel, isAdmin, onEdit, onDelete, onDuplicate }) => {
  const { T } = useTheme();
  const [queryResults, setQueryResults] = useState(null);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState(null);
  const [lastUpdate,   setLastUpdate]   = useState(null);
  const [expanded,     setExpanded]     = useState(false);
  const [showLogs,     setShowLogs]     = useState(false);
  const [saving,       setSaving]       = useState(false);

  /* ── resize — init from saved panel.position.pixelH / pixelW ── */
  const [panelH,   setPanelH]   = useState(panel.position?.pixelH || Math.max(DEFAULT_H, (panel.position?.h || 4) * 72));
  const [panelW,   setPanelW]   = useState(panel.position?.pixelW || null);
  const [resizing, setResizing] = useState(null); // 'v' | 'h' | 'corner' | null

  const resizeRef    = useRef({ startX: 0, startY: 0, startW: 0, startH: 0 });
  const containerRef = useRef(null);
  const intervalRef  = useRef(null);
  const saveTimerRef = useRef(null);

  /* ── persist size to backend ── */
  const persistSize = useCallback(async (h, w) => {
    setSaving(true);
    try {
      await axios.put(`${API_BASE_URL}/api/kql/panels/${panel.id}`, {
        position: { ...panel.position, pixelH: Math.round(h), pixelW: w ? Math.round(w) : null },
      });
    } catch (err) {
      console.warn('Failed to save panel size:', err.message);
    } finally {
      setSaving(false);
    }
  }, [panel.id, panel.position]);

  /* ── query execution ── */
  const executeQueries = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await axios.post(`${API_BASE_URL}/api/kql/panels/${panel.id}/execute`);
      setQueryResults(res.data);
      setLastUpdate(new Date());
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally { setLoading(false); }
  }, [panel.id]);

  useEffect(() => {
    executeQueries();
    if (panel.refreshInterval > 0) {
      intervalRef.current = setInterval(executeQueries, panel.refreshInterval * 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [panel.id, panel.refreshInterval, executeQueries]);

  /* ── resize start ── */
  const startResize = useCallback((type) => (e) => {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    resizeRef.current = {
      startX: e.clientX, startY: e.clientY,
      startW: rect?.width || panelW || 500,
      startH: panelH,
    };
    setResizing(type);
  }, [panelH, panelW]);

  /* ── resize move + up ── */
  useEffect(() => {
    if (!resizing) return;
    let latestH = panelH;
    let latestW = panelW;

    const onMove = (e) => {
      const dx = e.clientX - resizeRef.current.startX;
      const dy = e.clientY - resizeRef.current.startY;
      if (resizing === 'v' || resizing === 'corner') {
        latestH = Math.min(MAX_H, Math.max(MIN_H, resizeRef.current.startH + dy));
        setPanelH(latestH);
      }
      if (resizing === 'h' || resizing === 'corner') {
        latestW = Math.max(MIN_W, resizeRef.current.startW + dx);
        setPanelW(latestW);
      }
    };

    const onUp = () => {
      setResizing(null);
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => persistSize(latestH, latestW), 400);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };
  }, [resizing, panelH, panelW, persistSize]);

  useEffect(() => () => clearTimeout(saveTimerRef.current), []);

  const displayH = expanded ? 600 : panelH;

  /* ── convert API result → {fields, rows} ── */
  const getTableData = () => {
    if (!queryResults) return null;
    const table = queryResults.queries
      ? queryResults.queries.find(q => q.success && q.data?.tables?.[0])?.data?.tables?.[0]
      : queryResults.tables?.[0];
    if (!table) return null;
    return { fields: table.columns.map(c => ({ name: c.name, type: c.type })), rows: table.rows, rowCount: table.rows.length };
  };

  const renderViz = () => {
    if (loading && !queryResults) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10 }}>
          <svg style={{ width: 26, height: 26, animation: 'kql-spin 0.8s linear infinite' }} viewBox="0 0 24 24" fill="none" stroke={T.blue} strokeWidth="2.5">
            <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
          </svg>
          <span style={{ fontSize: 11, color: T.dim }}>Loading…</span>
        </div>
      );
    }
    if (error) {
      return (
        <div style={{ padding: 12 }}>
          <div style={{ background: `${T.red}14`, border: `1px solid ${T.red}44`, padding: '10px 14px', display: 'flex', gap: 10 }}>
            <span style={{ color: T.red, fontSize: 14, flexShrink: 0 }}>⚠</span>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: T.red, marginBottom: 3 }}>Query Error</div>
              <div style={{ fontSize: 11, color: T.textSub }}>{error}</div>
            </div>
          </div>
        </div>
      );
    }
    if (!queryResults) {
      return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: T.dim, fontSize: 12 }}>No data</div>;
    }

    const viz = panel.visualizationType;
    if (viz === 'timeseries' || viz === 'area') {
      return (
        <TimeSeriesChart
          queryResults={queryResults.queries ? [queryResults] : [queryResults]}
          options={{ ...panel.options, chartType: viz === 'area' ? 'area' : 'line' }}
        />
      );
    }
    const td = getTableData();
    if (!td) {
      return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: T.dim, fontSize: 12 }}>No data returned</div>;
    }
    switch (viz) {
      case 'table': return <TableViz    data={td} options={panel.options} />;
      case 'stat':  return <StatViz     data={td} options={panel.options} />;
      case 'bar':   return <BarChartViz data={td} options={panel.options} />;
      case 'pie':   return <PieChartViz data={td} options={panel.options} />;
      case 'gauge': return <GaugeViz    data={td} options={panel.options} />;
      default:      return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: T.dim, fontSize: 12 }}>Unknown viz: {viz}</div>;
    }
  };

  /* ── resize handle base style ── */
  const hBase = (cursor, pos) => ({
    position: 'absolute', ...pos, cursor, zIndex: 10,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  });

  const gripDots = (dir, active) => (
    <div style={{ display: 'flex', flexDirection: dir === 'h' ? 'column' : 'row', gap: 3, pointerEvents: 'none' }}>
      {[0,1,2,3,4].map(i => (
        <div key={i} style={{ width: 3, height: 3, borderRadius: '50%', background: active ? T.blue : T.border2 }} />
      ))}
    </div>
  );

  return (
    <>
      <div ref={containerRef} style={{
        background: T.surface,
        border: `1px solid ${resizing ? T.blue : T.border}`,
        display: 'flex', flexDirection: 'column',
        height: displayH,
        width: '100%',   // always fill the wrapper — wrapper controls actual width
        overflow: 'hidden',
        transition: resizing ? 'none' : 'border-color 0.15s',
        position: 'relative',
        userSelect: resizing ? 'none' : 'auto',
        boxSizing: 'border-box',
      }}>

        {/* ── header ── */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '8px 14px', borderBottom: `1px solid ${T.border}`, background: T.panel, gap: 8, flexShrink: 0 }}>
          {loading && (
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: T.blue, flexShrink: 0, animation: 'kql-pulse 1s ease-in-out infinite', display: 'inline-block' }} />
          )}

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {panel.title}
            </div>
            {lastUpdate && (
              <div style={{ fontSize: 10, color: T.dim, display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
                <FaClock style={{ fontSize: 9 }} />
                {lastUpdate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                {panel.refreshInterval > 0 && <span style={{ color: T.blue }}>· auto {panel.refreshInterval}s</span>}
              </div>
            )}
          </div>

          {resizing && (
            <span style={{ fontSize: 10, color: T.blue, fontVariantNumeric: 'tabular-nums' }}>
              {panelW ? `${Math.round(panelW)}w × ` : ''}{Math.round(displayH)}h px
            </span>
          )}
          {saving && !resizing && (
            <span style={{ fontSize: 10, color: T.dim }}>saving…</span>
          )}

          <div style={{ display: 'flex', gap: 0, flexShrink: 0 }}>
            <PBtn onClick={executeQueries} disabled={loading} title="Refresh" T={T}>
              <FaSync style={{ fontSize: 11, animation: loading ? 'kql-spin 0.8s linear infinite' : 'none' }} />
            </PBtn>
            <PBtn onClick={() => setShowLogs(true)} title="View raw logs" T={T} active={showLogs}>
              <FaTable style={{ fontSize: 11 }} />
            </PBtn>
            <PBtn onClick={() => setExpanded(v => !v)} title={expanded ? 'Collapse' : 'Expand'} T={T}>
              {expanded ? <FaCompress style={{ fontSize: 11 }} /> : <FaExpand style={{ fontSize: 11 }} />}
            </PBtn>
            {isAdmin && (
              <>
                <PBtn onClick={() => onEdit(panel)} title="Edit" T={T}>
                  <svg style={{ width: 11, height: 11 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </PBtn>
                <PBtn onClick={() => onDuplicate(panel.id)} title="Duplicate" T={T}>
                  <FaCopy style={{ fontSize: 11 }} />
                </PBtn>
                <PBtn onClick={() => onDelete(panel.id)} title="Delete" T={T} danger>
                  <FaTrash style={{ fontSize: 11 }} />
                </PBtn>
              </>
            )}
          </div>
        </div>

        {/* ── viz area ── */}
        <div style={{ flex: 1, minHeight: 0, padding: '10px 12px', overflow: 'hidden', background: T.chartBg }}>
          {renderViz()}
        </div>

        {/* ── bottom handle (height) ── */}
        {!expanded && (
          <div onMouseDown={startResize('v')} title="Drag to resize height"
            style={{ ...hBase('ns-resize', { bottom: 0, left: 0, right: 16, height: 8 }) }}
            onMouseEnter={e => e.currentTarget.style.background = `${T.blue}18`}
            onMouseLeave={e => { if (resizing !== 'v') e.currentTarget.style.background = 'transparent'; }}
          >
            {gripDots('v', resizing === 'v' || resizing === 'corner')}
          </div>
        )}

        {/* ── right handle (width) ── */}
        {!expanded && (
          <div onMouseDown={startResize('h')} title="Drag to resize width"
            style={{ ...hBase('ew-resize', { right: 0, top: 0, bottom: 8, width: 8 }) }}
            onMouseEnter={e => e.currentTarget.style.background = `${T.blue}18`}
            onMouseLeave={e => { if (resizing !== 'h') e.currentTarget.style.background = 'transparent'; }}
          >
            {gripDots('h', resizing === 'h' || resizing === 'corner')}
          </div>
        )}

        {/* ── corner handle (both) ── */}
        {!expanded && (
          <div onMouseDown={startResize('corner')} title="Drag to resize both"
            style={{ ...hBase('nwse-resize', { bottom: 0, right: 0, width: 16, height: 16 }) }}
            onMouseEnter={e => e.currentTarget.style.background = `${T.blue}22`}
            onMouseLeave={e => { if (resizing !== 'corner') e.currentTarget.style.background = 'transparent'; }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" style={{ pointerEvents: 'none', opacity: 0.5 }}>
              <line x1="10" y1="3" x2="3" y2="10" stroke={T.blue} strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="10" y1="6" x2="6" y2="10" stroke={T.blue} strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="10" y1="9" x2="9" y2="10" stroke={T.blue} strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
        )}
      </div>

      {showLogs && (
        <RawLogsViewer panel={panel} onClose={() => setShowLogs(false)} />
      )}

      <style>{`
        @keyframes kql-spin  { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes kql-pulse { 0%,100% { opacity:1; } 50% { opacity:0.25; } }
      `}</style>
    </>
  );
};

export default KqlPanel;
