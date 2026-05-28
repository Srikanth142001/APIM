import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../../config/apiConfig';
import { useTheme } from '../../context/ThemeContext';
import { FaSync, FaEdit, FaCopy, FaTrash, FaExpand, FaCompress, FaClock } from 'react-icons/fa';
import TableViz from './visualizations/TableViz';
import StatViz from './visualizations/StatViz';
import LineChartViz from './visualizations/LineChartViz';
import BarChartViz from './visualizations/BarChartViz';
import PieChartViz from './visualizations/PieChartViz';
import GaugeViz from './visualizations/GaugeViz';

const MIN_H = 180;
const MAX_H = 1200;
const MIN_W = 320;
const DEFAULT_H = 300;

/* ── icon button ─────────────────────────────────────────────────────────── */
const PBtn = ({ onClick, disabled, title, children, T, danger }) => (
  <button onClick={onClick} disabled={disabled} title={title}
    style={{
      padding: '5px 6px', background: 'transparent', border: 'none',
      color: danger ? T.red : T.dim,
      cursor: disabled ? 'not-allowed' : 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      opacity: disabled ? 0.4 : 1, transition: 'color 0.12s',
    }}
    onMouseEnter={e => { if (!disabled) e.currentTarget.style.color = danger ? T.red : T.text; }}
    onMouseLeave={e => { e.currentTarget.style.color = danger ? T.red : T.dim; }}
  >
    {children}
  </button>
);

const Panel = ({ panel, onEdit, onDelete, onDuplicate }) => {
  const { T } = useTheme();
  const [data,       setData]       = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [expanded,   setExpanded]   = useState(false);
  const [saving,     setSaving]     = useState(false);

  /* ── resize ── */
  const [panelH,   setPanelH]   = useState(panel.position?.pixelH || Math.max(DEFAULT_H, (panel.position?.h || 4) * 72));
  const [panelW,   setPanelW]   = useState(panel.position?.pixelW || null);
  const [resizing, setResizing] = useState(null);

  const resizeRef    = useRef({ startX: 0, startY: 0, startW: 0, startH: 0 });
  const containerRef = useRef(null);
  const intervalRef  = useRef(null);
  const saveTimerRef = useRef(null);

  /* ── persist size ── */
  const persistSize = useCallback(async (h, w) => {
    setSaving(true);
    try {
      await axios.put(`${API_BASE_URL}/api/custom-db/panels/${panel.id}`, {
        position: { ...panel.position, pixelH: Math.round(h), pixelW: w ? Math.round(w) : null },
      });
    } catch (err) { console.warn('Failed to save panel size:', err.message); }
    finally { setSaving(false); }
  }, [panel.id, panel.position]);

  /* ── query ── */
  const executeQuery = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await axios.post(`${API_BASE_URL}/api/custom-db/panels/${panel.id}/execute`);
      if (r.data.success) { setData(r.data); setLastUpdate(new Date()); }
    } catch (err) { setError(err.response?.data?.message || err.message); }
    finally { setLoading(false); }
  }, [panel.id]);

  useEffect(() => {
    executeQuery();
    if (panel.refreshInterval > 0) {
      intervalRef.current = setInterval(executeQuery, panel.refreshInterval * 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [panel.id, panel.refreshInterval, executeQuery]);

  /* ── resize handlers ── */
  const startResize = useCallback((type) => (e) => {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    resizeRef.current = { startX: e.clientX, startY: e.clientY, startW: rect?.width || panelW || 500, startH: panelH };
    setResizing(type);
  }, [panelH, panelW]);

  useEffect(() => {
    if (!resizing) return;
    let lH = panelH, lW = panelW;
    const onMove = (e) => {
      const dx = e.clientX - resizeRef.current.startX;
      const dy = e.clientY - resizeRef.current.startY;
      if (resizing === 'v' || resizing === 'corner') { lH = Math.min(MAX_H, Math.max(MIN_H, resizeRef.current.startH + dy)); setPanelH(lH); }
      if (resizing === 'h' || resizing === 'corner') { lW = Math.max(MIN_W, resizeRef.current.startW + dx); setPanelW(lW); }
    };
    const onUp = () => {
      setResizing(null);
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => persistSize(lH, lW), 400);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [resizing, panelH, panelW, persistSize]);

  useEffect(() => () => clearTimeout(saveTimerRef.current), []);

  const displayH = expanded ? 600 : panelH;

  /* ── visualization ── */
  const renderViz = () => {
    if (loading && !data) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10 }}>
          <svg style={{ width: 26, height: 26, animation: 'cdb-spin 0.8s linear infinite' }} viewBox="0 0 24 24" fill="none" stroke={T.blue} strokeWidth="2.5">
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
    if (!data) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: T.dim, fontSize: 12 }}>No data</div>;

    switch (panel.visualizationType) {
      case 'table': return <TableViz    data={data} options={panel.options} />;
      case 'stat':  return <StatViz     data={data} options={panel.options} />;
      case 'line':  return <LineChartViz data={data} options={panel.options} />;
      case 'bar':   return <BarChartViz data={data} options={panel.options} />;
      case 'pie':   return <PieChartViz data={data} options={panel.options} />;
      case 'gauge': return <GaugeViz    data={data} options={panel.options} />;
      default:      return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: T.dim, fontSize: 12 }}>Unknown viz: {panel.visualizationType}</div>;
    }
  };

  const hBase = (cursor, pos) => ({ position: 'absolute', ...pos, cursor, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' });
  const dots  = (dir, active) => (
    <div style={{ display: 'flex', flexDirection: dir === 'h' ? 'column' : 'row', gap: 3, pointerEvents: 'none' }}>
      {[0,1,2,3,4].map(i => <div key={i} style={{ width: 3, height: 3, borderRadius: '50%', background: active ? T.blue : T.border2 }} />)}
    </div>
  );

  return (
    <>
      <div ref={containerRef} style={{
        background: T.surface,
        border: `1px solid ${resizing ? T.blue : T.border}`,
        display: 'flex', flexDirection: 'column',
        height: displayH, width: '100%',
        overflow: 'hidden',
        transition: resizing ? 'none' : 'border-color 0.15s',
        position: 'relative',
        userSelect: resizing ? 'none' : 'auto',
        boxSizing: 'border-box',
      }}>
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '8px 14px', borderBottom: `1px solid ${T.border}`, background: T.panel, gap: 8, flexShrink: 0 }}>
          {loading && <span style={{ width: 7, height: 7, borderRadius: '50%', background: T.blue, flexShrink: 0, animation: 'cdb-pulse 1s ease-in-out infinite', display: 'inline-block' }} />}

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{panel.title}</div>
            {lastUpdate && (
              <div style={{ fontSize: 10, color: T.dim, display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
                <FaClock style={{ fontSize: 9 }} />
                {lastUpdate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                {panel.refreshInterval > 0 && <span style={{ color: T.blue }}>· auto {panel.refreshInterval}s</span>}
              </div>
            )}
          </div>

          {resizing && <span style={{ fontSize: 10, color: T.blue, fontVariantNumeric: 'tabular-nums' }}>{panelW ? `${Math.round(panelW)}w × ` : ''}{Math.round(displayH)}h px</span>}
          {saving && !resizing && <span style={{ fontSize: 10, color: T.dim }}>saving…</span>}

          <div style={{ display: 'flex', gap: 0, flexShrink: 0 }}>
            <PBtn onClick={executeQuery} disabled={loading} title="Refresh" T={T}>
              <FaSync style={{ fontSize: 11, animation: loading ? 'cdb-spin 0.8s linear infinite' : 'none' }} />
            </PBtn>
            <PBtn onClick={() => setExpanded(v => !v)} title={expanded ? 'Collapse' : 'Expand'} T={T}>
              {expanded ? <FaCompress style={{ fontSize: 11 }} /> : <FaExpand style={{ fontSize: 11 }} />}
            </PBtn>
            <PBtn onClick={() => onEdit(panel)} title="Edit" T={T}>
              <FaEdit style={{ fontSize: 11 }} />
            </PBtn>
            <PBtn onClick={() => onDuplicate(panel.id)} title="Duplicate" T={T}>
              <FaCopy style={{ fontSize: 11 }} />
            </PBtn>
            <PBtn onClick={() => onDelete(panel.id)} title="Delete" T={T} danger>
              <FaTrash style={{ fontSize: 11 }} />
            </PBtn>
          </div>
        </div>

        {/* viz */}
        <div style={{ flex: 1, minHeight: 0, padding: '10px 12px', overflow: 'hidden', background: T.chartBg }}>
          {renderViz()}
        </div>

        {/* resize handles */}
        {!expanded && (
          <div onMouseDown={startResize('v')} title="Drag to resize height"
            style={{ ...hBase('ns-resize', { bottom: 0, left: 0, right: 16, height: 8 }) }}
            onMouseEnter={e => e.currentTarget.style.background = `${T.blue}18`}
            onMouseLeave={e => { if (resizing !== 'v') e.currentTarget.style.background = 'transparent'; }}
          >
            {dots('v', resizing === 'v' || resizing === 'corner')}
          </div>
        )}
        {!expanded && (
          <div onMouseDown={startResize('h')} title="Drag to resize width"
            style={{ ...hBase('ew-resize', { right: 0, top: 0, bottom: 8, width: 8 }) }}
            onMouseEnter={e => e.currentTarget.style.background = `${T.blue}18`}
            onMouseLeave={e => { if (resizing !== 'h') e.currentTarget.style.background = 'transparent'; }}
          >
            {dots('h', resizing === 'h' || resizing === 'corner')}
          </div>
        )}
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

      <style>{`
        @keyframes cdb-spin  { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes cdb-pulse { 0%,100% { opacity:1; } 50% { opacity:0.25; } }
      `}</style>
    </>
  );
};

export default Panel;
