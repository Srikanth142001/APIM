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

/* ══ KqlPanel — resize/drag handled by PanelGrid parent ══════════════════════ */
const KqlPanel = ({ panel, isAdmin, onEdit, onDelete, onDuplicate, height }) => {
  const { T } = useTheme();
  const [queryResults, setQueryResults] = useState(null);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState(null);
  const [lastUpdate,   setLastUpdate]   = useState(null);
  const [expanded,     setExpanded]     = useState(false);
  const [showLogs,     setShowLogs]     = useState(false);

  const intervalRef = useRef(null);

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

  const displayH = expanded ? 600 : (height || 300);

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
    if (!queryResults) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: T.dim, fontSize: 12 }}>No data</div>;

    const viz = panel.visualizationType;
    if (viz === 'timeseries' || viz === 'area') {
      return <TimeSeriesChart queryResults={queryResults.queries ? [queryResults] : [queryResults]} options={{ ...panel.options, chartType: viz === 'area' ? 'area' : 'line' }} />;
    }
    const td = getTableData();
    if (!td) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: T.dim, fontSize: 12 }}>No data returned</div>;
    switch (viz) {
      case 'table': return <TableViz    data={td} options={panel.options} />;
      case 'stat':  return <StatViz     data={td} options={panel.options} />;
      case 'bar':   return <BarChartViz data={td} options={panel.options} />;
      case 'pie':   return <PieChartViz data={td} options={panel.options} />;
      case 'gauge': return <GaugeViz    data={td} options={panel.options} />;
      default:      return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: T.dim, fontSize: 12 }}>Unknown viz: {viz}</div>;
    }
  };

  return (
    <>
      <div style={{
        background: T.surface,
        border: `1px solid ${T.border}`,
        display: 'flex', flexDirection: 'column',
        height: displayH, width: '100%',
        overflow: 'hidden',
        position: 'relative',
        boxSizing: 'border-box',
      }}>
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '8px 14px', borderBottom: `1px solid ${T.border}`, background: T.panel, gap: 8, flexShrink: 0 }}>
          {loading && <span style={{ width: 7, height: 7, borderRadius: '50%', background: T.blue, flexShrink: 0, animation: 'kql-pulse 1s ease-in-out infinite', display: 'inline-block' }} />}

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
                <PBtn onClick={() => onDuplicate(panel.id)} title="Duplicate" T={T}><FaCopy style={{ fontSize: 11 }} /></PBtn>
                <PBtn onClick={() => onDelete(panel.id)} title="Delete" T={T} danger><FaTrash style={{ fontSize: 11 }} /></PBtn>
              </>
            )}
          </div>
        </div>

        {/* viz */}
        <div style={{ flex: 1, minHeight: 0, padding: panel.visualizationType === 'table' ? 0 : '10px 12px', overflow: 'auto', background: T.chartBg }}>
          {renderViz()}
        </div>
      </div>

      {showLogs && <RawLogsViewer panel={panel} onClose={() => setShowLogs(false)} />}

      <style>{`
        @keyframes kql-spin  { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes kql-pulse { 0%,100% { opacity:1; } 50% { opacity:0.25; } }
      `}</style>
    </>
  );
};

export default KqlPanel;
