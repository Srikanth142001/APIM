import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../../config/apiConfig';
import { useTheme } from '../../context/ThemeContext';
import { FaTimes, FaSave, FaPlay, FaDatabase, FaCheckCircle, FaPlus } from 'react-icons/fa';

const VIZ_TYPES = [
  { value: 'table',   label: '📋 Table'        },
  { value: 'stat',    label: '🔢 Stat'         },
  { value: 'line',    label: '📈 Line Chart'   },
  { value: 'area',    label: '🌊 Area Chart'   },
  { value: 'bar',     label: '📊 Bar Chart'    },
  { value: 'pie',     label: '🥧 Pie Chart'    },
  { value: 'gauge',   label: '🎯 Gauge'        },
  { value: 'scatter', label: '⚡ Scatter Plot'  },
];

const REFRESH_OPTIONS = [
  { value: 0,    label: 'Off (manual)' },
  { value: 30,   label: '30 seconds'   },
  { value: 60,   label: '1 minute'     },
  { value: 300,  label: '5 minutes'    },
  { value: 900,  label: '15 minutes'   },
  { value: 1800, label: '30 minutes'   },
  { value: 3600, label: '1 hour'       },
];

const QUERY_COLORS = ['#5794f2','#73bf69','#f2cc0c','#ff780a','#f2495c','#b877d9','#8ab8ff','#fade2a'];

const mkQuery = (connId, idx) => ({
  id: 'q_' + Date.now() + '_' + idx,
  label: 'Query ' + String.fromCharCode(65 + idx),
  connectionId: connId || '',
  query: '',
  color: QUERY_COLORS[idx % QUERY_COLORS.length],
});

const PanelEditor = ({ panel, dashboardId, onClose }) => {
  const { T } = useTheme();
  const [connections, setConnections] = useState([]);

  const initQueries = () => {
    if (panel?.queries?.length > 0) return panel.queries;
    if (panel?.connectionId || panel?.query) {
      return [{ id: 'q_legacy', label: 'Query A', connectionId: panel.connectionId || '', query: panel.query || '', color: QUERY_COLORS[0] }];
    }
    return [mkQuery('', 0)];
  };

  const [form, setForm] = useState({
    title:             panel?.title             || '',
    description:       panel?.description       || '',
    connectionId:      panel?.connectionId      || '',
    query:             panel?.query             || '',
    queries:           initQueries(),
    visualizationType: panel?.visualizationType || 'table',
    refreshInterval:   panel?.refreshInterval   || 0,
    position:          panel?.position          || { x: 0, y: 0, w: 6, h: 4 },
    options:           panel?.options           || {},
  });

  const [testResults, setTestResults] = useState({});
  const [testResult,  setTestResult]  = useState(null);
  const [testing,     setTesting]     = useState(null);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState(null);
  const [tab,         setTab]         = useState('query');
  const textareaRef = useRef(null);

  useEffect(() => {
    axios.get(API_BASE_URL + '/api/custom-db/connections')
      .then(r => {
        if (r.data.success) {
          setConnections(r.data.connections);
          // Only auto-select if no connection is set yet AND no queries have connections
          setForm(p => {
            const hasConn = p.queries.some(q => q.connectionId);
            if (!hasConn && r.data.connections.length > 0) {
              const qs = p.queries.map((q, i) => i === 0 ? { ...q, connectionId: r.data.connections[0].id } : q);
              return { ...p, queries: qs };
            }
            return p;
          });
        }
      })
      .catch(err => console.error('Failed to load connections:', err));
  }, []); // eslint-disable-line

  const updateQuery = (idx, field, value) => {
    setForm(p => {
      const qs = [...p.queries];
      qs[idx] = { ...qs[idx], [field]: value };
      return { ...p, queries: qs };
    });
  };

  const addQuery = () => {
    const connId = connections[0]?.id || '';
    setForm(p => ({ ...p, queries: [...p.queries, mkQuery(connId, p.queries.length)] }));
  };

  const removeQuery = (idx) => {
    if (form.queries.length <= 1) return;
    setForm(p => ({ ...p, queries: p.queries.filter((_, i) => i !== idx) }));
  };

  const handleTest = async (qi) => {
    const q = form.queries[qi];
    if (!q?.connectionId) { setError('Select a connection first'); return; }
    if (!q?.query?.trim()) { setError('Enter a SQL query'); return; }
    setTesting(qi); setError(null);
    try {
      const r = await axios.post(API_BASE_URL + '/api/custom-db/query', { connectionId: q.connectionId, query: q.query });
      if (r.data.success) {
        setTestResults(prev => ({ ...prev, [q.id]: r.data }));
        setTestResult(r.data);
        setTab('preview');
      } else setError(r.data.message);
    } catch (err) { setError(err.response?.data?.message || err.message); }
    finally { setTesting(null); }
  };

  const handleSave = async () => {
    if (!form.title.trim()) { setError('Panel title is required'); return; }
    // Include ALL queries that have a connection, even if query is empty (user might be editing)
    const valid = form.queries.filter(q => q.connectionId && q.query?.trim());
    // But save ALL queries regardless (don't filter out incomplete ones during save)
    const allQueries = form.queries.filter(q => q.connectionId);
    if (allQueries.length === 0) { setError('At least one query with a connection is required'); return; }
    setSaving(true); setError(null);
    try {
      const payload = {
        ...form,
        queries: form.queries, // save ALL queries, not just valid ones
        connectionId: form.queries[0]?.connectionId || '',
        query: form.queries[0]?.query || '',
      };
      if (panel) { await axios.put(API_BASE_URL + '/api/custom-db/panels/' + panel.id, payload); }
      else       { await axios.post(API_BASE_URL + '/api/custom-db/dashboards/' + dashboardId + '/panels', payload); }
      onClose();
    } catch (err) { setError(err.response?.data?.message || err.message); }
    finally { setSaving(false); }
  };

  const inp = { padding: '7px 12px', fontSize: 12, background: T.inputBg, border: '1px solid ' + T.border2, color: T.text, outline: 'none', width: '100%', boxSizing: 'border-box' };
  const lbl = (text, req) => (
    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: T.muted, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
      {text}{req && <span style={{ color: T.red, marginLeft: 2 }}>*</span>}
    </label>
  );
  const tabBtn = (active) => ({
    padding: '8px 16px', background: 'transparent', border: 'none',
    borderBottom: active ? '2px solid ' + T.blue : '2px solid transparent',
    color: active ? T.text : T.muted, fontSize: 12, fontWeight: active ? 600 : 400, cursor: 'pointer',
  });

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div style={{ background: T.surface, border: '1px solid ' + T.border, width: '100%', maxWidth: 960, maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }}>

        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderBottom: '1px solid ' + T.border, background: T.panel, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 3, height: 16, background: T.blue, display: 'inline-block' }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{panel ? 'Edit Panel' : 'Add Panel'}</span>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: T.muted, cursor: 'pointer', fontSize: 18 }}
            onMouseEnter={e => e.currentTarget.style.color = T.text} onMouseLeave={e => e.currentTarget.style.color = T.muted}>
            <FaTimes />
          </button>
        </div>

        {/* title + viz + refresh */}
        <div style={{ display: 'flex', gap: 8, padding: '12px 18px', borderBottom: '1px solid ' + T.border, flexWrap: 'wrap', flexShrink: 0 }}>
          <input type="text" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
            placeholder="Panel title *" style={{ ...inp, flex: 2, minWidth: 180, fontWeight: 600, fontSize: 13 }} />
          <select value={form.visualizationType} onChange={e => setForm(p => ({ ...p, visualizationType: e.target.value }))}
            style={{ ...inp, flex: 1, minWidth: 150, cursor: 'pointer', width: 'auto' }}>
            {VIZ_TYPES.map(v => <option key={v.value} value={v.value} style={{ background: T.surface }}>{v.label}</option>)}
          </select>
          <select value={form.refreshInterval} onChange={e => setForm(p => ({ ...p, refreshInterval: parseInt(e.target.value) }))}
            style={{ ...inp, cursor: 'pointer', width: 'auto' }}>
            {REFRESH_OPTIONS.map(r => <option key={r.value} value={r.value} style={{ background: T.surface }}>🔄 {r.label}</option>)}
          </select>
        </div>

        {/* tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid ' + T.border, padding: '0 18px', background: T.panel, flexShrink: 0 }}>
          <button style={tabBtn(tab === 'query')}   onClick={() => setTab('query')}>Query</button>
          <button style={tabBtn(tab === 'preview')} onClick={() => setTab('preview')}>Preview {testResult ? '✓' : ''}</button>
          <button style={tabBtn(tab === 'options')} onClick={() => setTab('options')}>Options</button>
        </div>

        {/* tab body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px' }}>

          {/* QUERY TAB */}
          {tab === 'query' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: T.muted }}>{form.queries.length} {form.queries.length === 1 ? 'query' : 'queries'}{form.queries.length > 1 && <span style={{ color: T.dim, marginLeft: 8 }}>— results merged on same chart</span>}</span>
                <button onClick={addQuery} disabled={form.queries.length >= 8}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', fontSize: 11, fontWeight: 600, background: T.blue + '22', border: '1px solid ' + T.blue + '55', color: T.blue, cursor: 'pointer', opacity: form.queries.length >= 8 ? 0.4 : 1 }}>
                  <FaPlus style={{ fontSize: 9 }} /> Add Query
                </button>
              </div>

              {form.queries.map((q, qi) => {
                const qConn = connections.find(c => c.id === q.connectionId);
                const isRunning = testing === qi;
                const qResult = testResults[q.id];
                return (
                  <div key={q.id} style={{ background: T.panel, border: '1px solid ' + q.color + '44', borderTop: '3px solid ' + q.color }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: '1px solid ' + T.border, background: T.chartBg }}>
                      <div style={{ width: 12, height: 12, borderRadius: '50%', background: q.color, flexShrink: 0 }} />
                      <input type="text" value={q.label} onChange={e => updateQuery(qi, 'label', e.target.value)}
                        style={{ background: 'transparent', border: 'none', color: q.color, fontSize: 12, fontWeight: 600, outline: 'none', flex: 1 }} />
                      <div style={{ display: 'flex', gap: 3 }}>
                        {QUERY_COLORS.map(c => (
                          <button key={c} onClick={() => updateQuery(qi, 'color', c)}
                            style={{ width: 14, height: 14, borderRadius: '50%', background: c, border: q.color === c ? '2px solid #fff' : '2px solid transparent', cursor: 'pointer', padding: 0 }} />
                        ))}
                      </div>
                      {form.queries.length > 1 && (
                        <button onClick={() => removeQuery(qi)}
                          style={{ padding: '3px 6px', background: 'transparent', border: 'none', color: T.dim, cursor: 'pointer', fontSize: 14 }}
                          onMouseEnter={e => e.currentTarget.style.color = T.red}
                          onMouseLeave={e => e.currentTarget.style.color = T.dim}>×</button>
                      )}
                    </div>
                    <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div>
                        {lbl('Connection', true)}
                        {connections.length === 0 ? (
                          <div style={{ ...inp, color: T.dim, fontSize: 11 }}>No connections — add one in Connections panel</div>
                        ) : (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {connections.map(conn => {
                              const active = q.connectionId === conn.id;
                              return (
                                <div key={conn.id} onClick={() => updateQuery(qi, 'connectionId', conn.id)}
                                  style={{ padding: '7px 12px', cursor: 'pointer', background: active ? T.blue + '18' : T.surface, border: '1px solid ' + (active ? T.blue : T.border), borderLeft: '3px solid ' + (active ? T.blue : T.border2), minWidth: 140, flex: '1 1 140px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                                    {active && <FaCheckCircle style={{ color: T.blue, fontSize: 10 }} />}
                                    <FaDatabase style={{ color: active ? T.blue : T.muted, fontSize: 10 }} />
                                    <span style={{ fontSize: 11, fontWeight: 600, color: active ? T.blue : T.text }}>{conn.name}</span>
                                  </div>
                                  <div style={{ fontSize: 10, color: T.dim }}>{conn.host}:{conn.port} / {conn.database}</div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {qConn && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', background: T.blue + '0a', border: '1px solid ' + T.blue + '22', fontSize: 10, color: T.muted, marginTop: 6 }}>
                            <FaDatabase style={{ color: T.blue, fontSize: 9 }} />
                            <span style={{ color: T.blue, fontWeight: 600 }}>{qConn.name}</span>
                            <span style={{ color: T.dim }}>·</span>
                            <span>{qConn.host}:{qConn.port}/{qConn.database}</span>
                          </div>
                        )}
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                          {lbl('SQL Query', true)}
                          <span style={{ fontSize: 10, color: T.dim }}>Ctrl+Enter to run</span>
                        </div>
                        <div style={{ border: '1px solid ' + T.border2, borderLeft: '3px solid ' + q.color, background: T.chartBg }}>
                          <textarea value={q.query} onChange={e => updateQuery(qi, 'query', e.target.value)}
                            onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); handleTest(qi); } }}
                            placeholder={'SELECT *\nFROM table_name\nLIMIT 100;'} spellCheck={false}
                            style={{ width: '100%', height: 140, padding: '10px 12px', background: 'transparent', border: 'none', color: T.text, fontFamily: '"Fira Code", Consolas, monospace', fontSize: 12, lineHeight: 1.65, resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                          <button onClick={() => handleTest(qi)} disabled={isRunning || !q.connectionId || !q.query?.trim()}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 14px', fontSize: 11, fontWeight: 600, background: q.color + '22', border: '1px solid ' + q.color + '55', color: q.color, cursor: isRunning || !q.connectionId || !q.query?.trim() ? 'not-allowed' : 'pointer', opacity: !q.connectionId || !q.query?.trim() ? 0.5 : 1 }}>
                            {isRunning ? (<><svg style={{ width: 10, height: 10, animation: 'cdb-spin 0.8s linear infinite' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg> Running…</>) : (<><FaPlay style={{ fontSize: 9 }} /> Run Query</>)}
                          </button>
                          {qResult && <span style={{ fontSize: 11, color: T.green }}>✓ {qResult.rowCount} rows · {qResult.executionTime}ms</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* PREVIEW TAB */}
          {tab === 'preview' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 11, color: T.muted }}>
                  {testResult ? testResult.rowCount + ' rows · ' + testResult.executionTime + 'ms' : 'Run query to see preview'}
                </span>
                <button onClick={() => handleTest(0)} disabled={testing !== null}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', fontSize: 11, fontWeight: 600, background: T.blue + '22', border: '1px solid ' + T.blue + '55', color: T.blue, cursor: 'pointer' }}>
                  <FaPlay style={{ fontSize: 9 }} /> Refresh
                </button>
              </div>
              {testResult ? (
                <div style={{ background: T.chartBg, border: '1px solid ' + T.border, overflowX: 'auto', maxHeight: 360, overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <thead style={{ position: 'sticky', top: 0 }}>
                      <tr style={{ background: T.panel }}>
                        {testResult.fields.map((f, i) => (
                          <th key={i} style={{ padding: '7px 12px', textAlign: 'left', color: T.muted, fontWeight: 600, borderBottom: '1px solid ' + T.border, whiteSpace: 'nowrap' }}>
                            {f.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {testResult.rows.slice(0, 100).map((row, ri) => (
                        <tr key={ri} style={{ borderBottom: '1px solid ' + T.border }}
                          onMouseEnter={e => e.currentTarget.style.background = T.panel}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          {row.map((cell, ci) => (
                            <td key={ci} style={{ padding: '6px 12px', color: T.text, whiteSpace: 'nowrap', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {cell === null ? <span style={{ color: T.dim }}>null</span> : String(cell)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {testResult.rows.length > 100 && (
                    <div style={{ padding: '6px 12px', color: T.dim, fontSize: 10, textAlign: 'center', borderTop: '1px solid ' + T.border }}>
                      Showing 100 of {testResult.rowCount} rows
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: T.dim, fontSize: 12, border: '2px dashed ' + T.border2 }}>
                  Run your query first to see a preview
                </div>
              )}
            </div>
          )}

          {/* OPTIONS TAB */}
          {tab === 'options' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                {lbl('Description')}
                <input type="text" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Optional panel description" style={inp} />
              </div>

              {!testResult && (
                <div style={{ padding: '10px 14px', background: T.orange + '14', border: '1px solid ' + T.orange + '44', color: T.orange, fontSize: 12 }}>
                  ⚠ Run your query in the Query tab first to configure axis and color options
                </div>
              )}

              {/* Axis config for bar/line/area */}
              {(form.visualizationType === 'bar' || form.visualizationType === 'line' || form.visualizationType === 'area') && testResult && (
                <div style={{ background: T.panel, border: '1px solid ' + T.border, padding: '14px 16px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Axis Configuration</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      {lbl('X Axis (Category)')}
                      <select value={form.options.xAxisColumn || ''} onChange={e => setForm(p => ({ ...p, options: { ...p.options, xAxisColumn: e.target.value } }))}
                        style={{ ...inp, cursor: 'pointer' }}>
                        <option value="" style={{ background: T.surface }}>— auto detect —</option>
                        {testResult.fields.map((f, i) => <option key={i} value={f.name} style={{ background: T.surface }}>{f.name}</option>)}
                      </select>
                    </div>
                    <div>
                      {lbl('Y Axis (check all you want)')}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {testResult.fields.map((f, i) => {
                          const sel = (form.options.yAxisColumns || []).includes(f.name);
                          return (
                            <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 8px', background: sel ? T.blue + '14' : 'transparent', border: '1px solid ' + (sel ? T.blue + '44' : T.border), cursor: 'pointer', fontSize: 12, color: sel ? T.blue : T.text }}>
                              <input type="checkbox" checked={sel} onChange={e => {
                                const cur = form.options.yAxisColumns || [];
                                setForm(p => ({ ...p, options: { ...p.options, yAxisColumns: e.target.checked ? [...cur, f.name] : cur.filter(n => n !== f.name) } }));
                              }} />
                              {f.name}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
                    {form.visualizationType === 'bar' && (
                      <>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 7, color: T.text, fontSize: 12, cursor: 'pointer' }}>
                          <input type="checkbox" checked={form.options.stacked === true} onChange={e => setForm(p => ({ ...p, options: { ...p.options, stacked: e.target.checked } }))} />
                          Stacked
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 7, color: T.text, fontSize: 12, cursor: 'pointer' }}>
                          <input type="checkbox" checked={form.options.horizontal === true} onChange={e => setForm(p => ({ ...p, options: { ...p.options, horizontal: e.target.checked } }))} />
                          Horizontal
                        </label>
                      </>
                    )}
                  </div>
                  <div style={{ marginTop: 12 }}>
                    {lbl('Y Axis unit suffix')}
                    <input type="text" value={form.options.unit || ''} onChange={e => setForm(p => ({ ...p, options: { ...p.options, unit: e.target.value } }))}
                      placeholder="e.g. ms, $, %" style={{ ...inp, width: 140 }} />
                  </div>
                </div>
              )}

              {/* Series colors */}
              {(form.visualizationType === 'bar' || form.visualizationType === 'line' || form.visualizationType === 'area') && testResult && (
                <div style={{ background: T.panel, border: '1px solid ' + T.border, padding: '14px 16px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Series Colors</div>
                  {(form.options.yAxisColumns?.length > 0 ? form.options.yAxisColumns : testResult.fields.slice(1).map(f => f.name)).map((col, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 12, color: T.text, minWidth: 120 }}>{col}</span>
                      <input type="color" value={(form.options.seriesColors || [])[i] || '#5794f2'}
                        onChange={e => {
                          const cur = [...(form.options.seriesColors || [])];
                          cur[i] = e.target.value;
                          setForm(p => ({ ...p, options: { ...p.options, seriesColors: cur } }));
                        }}
                        style={{ width: 36, height: 28, border: '1px solid ' + T.border2, cursor: 'pointer', background: 'transparent', padding: 2 }} />
                    </div>
                  ))}
                </div>
              )}

              {/* Pie config */}
              {form.visualizationType === 'pie' && testResult && (
                <div style={{ background: T.panel, border: '1px solid ' + T.border, padding: '14px 16px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Pie Chart</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      {lbl('Label Column')}
                      <select value={form.options.nameColumn || ''} onChange={e => setForm(p => ({ ...p, options: { ...p.options, nameColumn: e.target.value } }))} style={{ ...inp, cursor: 'pointer' }}>
                        <option value="" style={{ background: T.surface }}>— auto —</option>
                        {testResult.fields.map((f, i) => <option key={i} value={f.name} style={{ background: T.surface }}>{f.name}</option>)}
                      </select>
                    </div>
                    <div>
                      {lbl('Value Column')}
                      <select value={form.options.valueColumn || ''} onChange={e => setForm(p => ({ ...p, options: { ...p.options, valueColumn: e.target.value } }))} style={{ ...inp, cursor: 'pointer' }}>
                        <option value="" style={{ background: T.surface }}>— auto —</option>
                        {testResult.fields.map((f, i) => <option key={i} value={f.name} style={{ background: T.surface }}>{f.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 7, color: T.text, fontSize: 12, cursor: 'pointer', marginTop: 12 }}>
                    <input type="checkbox" checked={form.options.donutMode === true} onChange={e => setForm(p => ({ ...p, options: { ...p.options, donutMode: e.target.checked } }))} />
                    Donut mode
                  </label>
                </div>
              )}

              {/* Stat config */}
              {form.visualizationType === 'stat' && (
                <div style={{ background: T.panel, border: '1px solid ' + T.border, padding: '14px 16px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Stat Options</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      {lbl('Column')}
                      <select value={form.options.columnIndex ?? 0} onChange={e => setForm(p => ({ ...p, options: { ...p.options, columnIndex: parseInt(e.target.value) } }))} style={{ ...inp, cursor: 'pointer' }}>
                        {testResult ? testResult.fields.map((f, i) => <option key={i} value={i} style={{ background: T.surface }}>[{i}] {f.name}</option>) : <option value={0} style={{ background: T.surface }}>Run query first</option>}
                      </select>
                    </div>
                    <div>
                      {lbl('Aggregation')}
                      <select value={form.options.aggregation || 'last'} onChange={e => setForm(p => ({ ...p, options: { ...p.options, aggregation: e.target.value } }))} style={{ ...inp, cursor: 'pointer' }}>
                        {[['last','Last'],['first','First'],['sum','Sum'],['avg','Average'],['min','Min'],['max','Max'],['count','Count']].map(([v,l]) => <option key={v} value={v} style={{ background: T.surface }}>{l}</option>)}
                      </select>
                    </div>
                    <div>
                      {lbl('Unit suffix')}
                      <input type="text" value={form.options.unit || ''} onChange={e => setForm(p => ({ ...p, options: { ...p.options, unit: e.target.value } }))} placeholder="ms, %, $" style={inp} />
                    </div>
                    <div>
                      {lbl('Decimal places')}
                      <input type="number" min={0} max={6} value={form.options.decimals ?? 0} onChange={e => setForm(p => ({ ...p, options: { ...p.options, decimals: parseInt(e.target.value) || 0 } }))} style={inp} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 20, marginTop: 12 }}>
                    {[['showSparkline','Sparkline'],['showTrend','Trend %']].map(([key, label]) => (
                      <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 7, color: T.text, fontSize: 12, cursor: 'pointer' }}>
                        <input type="checkbox" checked={form.options[key] === true} onChange={e => setForm(p => ({ ...p, options: { ...p.options, [key]: e.target.checked } }))} />
                        {label}
                      </label>
                    ))}
                  </div>
                  <div style={{ marginTop: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Color Mode</div>
                    <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
                      {[['none','None'],['threshold','Threshold'],['fixed','Fixed']].map(([v,l]) => (
                        <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 6, color: (form.options.colorMode || 'none') === v ? T.blue : T.text, fontSize: 12, cursor: 'pointer' }}>
                          <input type="radio" name="colorMode" value={v} checked={(form.options.colorMode || 'none') === v} onChange={() => setForm(p => ({ ...p, options: { ...p.options, colorMode: v } }))} />
                          {l}
                        </label>
                      ))}
                    </div>
                    {form.options.colorMode === 'fixed' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 11, color: T.muted }}>Color:</span>
                        <input type="color" value={form.options.fixedColor || '#5794f2'} onChange={e => setForm(p => ({ ...p, options: { ...p.options, fixedColor: e.target.value } }))}
                          style={{ width: 36, height: 28, border: '1px solid ' + T.border2, cursor: 'pointer', background: 'transparent', padding: 2 }} />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Gauge config */}
              {form.visualizationType === 'gauge' && (
                <div style={{ background: T.panel, border: '1px solid ' + T.border, padding: '14px 16px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Gauge Options</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                    <div>
                      {lbl('Value Column')}
                      <select value={form.options.valueColumn || ''} onChange={e => setForm(p => ({ ...p, options: { ...p.options, valueColumn: e.target.value } }))} style={{ ...inp, cursor: 'pointer' }}>
                        <option value="" style={{ background: T.surface }}>— auto —</option>
                        {testResult && testResult.fields.map((f, i) => <option key={i} value={f.name} style={{ background: T.surface }}>{f.name}</option>)}
                      </select>
                    </div>
                    <div>
                      {lbl('Min value')}
                      <input type="number" value={form.options.minValue ?? 0} onChange={e => setForm(p => ({ ...p, options: { ...p.options, minValue: parseFloat(e.target.value) || 0 } }))} style={inp} />
                    </div>
                    <div>
                      {lbl('Max value')}
                      <input type="number" value={form.options.maxValue ?? 100} onChange={e => setForm(p => ({ ...p, options: { ...p.options, maxValue: parseFloat(e.target.value) || 100 } }))} style={inp} />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                    <div>
                      {lbl('Unit suffix')}
                      <input type="text" value={form.options.unit || ''} onChange={e => setForm(p => ({ ...p, options: { ...p.options, unit: e.target.value } }))} placeholder="%" style={inp} />
                    </div>
                    <div>
                      {lbl('Decimal places')}
                      <input type="number" min={0} max={4} value={form.options.decimals ?? 1} onChange={e => setForm(p => ({ ...p, options: { ...p.options, decimals: parseInt(e.target.value) || 0 } }))} style={inp} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* error */}
        {error && (
          <div style={{ margin: '0 18px', padding: '8px 12px', background: T.red + '14', border: '1px solid ' + T.red + '44', color: T.red, fontSize: 12, flexShrink: 0 }}>
            ⚠ {error}
          </div>
        )}

        {/* footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 18px', borderTop: '1px solid ' + T.border, background: T.panel, flexShrink: 0 }}>
          <button onClick={onClose}
            style={{ padding: '6px 18px', background: 'transparent', border: '1px solid ' + T.border2, color: T.muted, fontSize: 12, cursor: 'pointer' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = T.text; e.currentTarget.style.color = T.text; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = T.border2; e.currentTarget.style.color = T.muted; }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 20px', background: saving ? T.border : T.green, border: 'none', color: '#fff', fontSize: 12, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>
            <FaSave style={{ fontSize: 11 }} />
            {saving ? 'Saving…' : 'Save Panel'}
          </button>
        </div>
      </div>
      <style>{`@keyframes cdb-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default PanelEditor;
