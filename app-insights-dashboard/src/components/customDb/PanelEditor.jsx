import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../../config/apiConfig';
import { useTheme } from '../../context/ThemeContext';
import { FaTimes, FaSave, FaPlay, FaDatabase, FaCheckCircle } from 'react-icons/fa';

const VIZ_TYPES = [
  { value: 'table',  label: '📋 Table'       },
  { value: 'stat',   label: '🔢 Stat'        },
  { value: 'line',   label: '📈 Line Chart'  },
  { value: 'area',   label: '🌊 Area Chart'  },
  { value: 'bar',    label: '📊 Bar Chart'   },
  { value: 'pie',    label: '🥧 Pie Chart'   },
  { value: 'gauge',  label: '🎯 Gauge'       },
  { value: 'scatter',label: '⚡ Scatter Plot' },
];

const REFRESH_OPTIONS = [
  { value: 0,    label: 'Off (manual)'  },
  { value: 10,   label: '10 seconds'    },
  { value: 30,   label: '30 seconds'    },
  { value: 60,   label: '1 minute'      },
  { value: 300,  label: '5 minutes'     },
  { value: 900,  label: '15 minutes'    },
  { value: 1800, label: '30 minutes'    },
  { value: 3600, label: '1 hour'        },
];

const PanelEditor = ({ panel, dashboardId, onClose }) => {
  const { T } = useTheme();
  const [connections, setConnections] = useState([]);
  const [form, setForm] = useState({
    title:             panel?.title             || '',
    description:       panel?.description       || '',
    connectionId:      panel?.connectionId      || '',
    query:             panel?.query             || '',
    visualizationType: panel?.visualizationType || 'table',
    refreshInterval:   panel?.refreshInterval   || 0,
    position:          panel?.position          || { x: 0, y: 0, w: 6, h: 4 },
    options:           panel?.options           || {},
  });
  const [testResult, setTestResult] = useState(null);
  const [testing,    setTesting]    = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState(null);
  const [tab,        setTab]        = useState('query');
  const textareaRef = useRef(null);

  useEffect(() => {
    axios.get(`${API_BASE_URL}/api/custom-db/connections`)
      .then(r => {
        if (r.data.success) {
          setConnections(r.data.connections);
          if (!form.connectionId && r.data.connections.length > 0) {
            setForm(p => ({ ...p, connectionId: r.data.connections[0].id }));
          }
        }
      })
      .catch(err => console.error('Failed to load connections:', err));
  }, []); // eslint-disable-line

  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); handleTest(); }
    if (e.key === 'Tab') {
      e.preventDefault();
      const s = e.target.selectionStart, en = e.target.selectionEnd;
      const v = form.query.substring(0, s) + '  ' + form.query.substring(en);
      setForm(p => ({ ...p, query: v }));
      setTimeout(() => { if (textareaRef.current) { textareaRef.current.selectionStart = s + 2; textareaRef.current.selectionEnd = s + 2; } }, 0);
    }
  };

  const handleTest = async () => {
    if (!form.connectionId) { setError('Select a connection first'); return; }
    if (!form.query.trim()) { setError('Enter a SQL query'); return; }
    setTesting(true); setError(null); setTestResult(null);
    try {
      const r = await axios.post(`${API_BASE_URL}/api/custom-db/query`, { connectionId: form.connectionId, query: form.query });
      if (r.data.success) { setTestResult(r.data); setTab('preview'); }
      else setError(r.data.message);
    } catch (err) { setError(err.response?.data?.message || err.message); }
    finally { setTesting(false); }
  };

  const handleSave = async () => {
    if (!form.title.trim())    { setError('Panel title is required'); return; }
    if (!form.connectionId)    { setError('Select a connection'); return; }
    if (!form.query.trim())    { setError('SQL query is required'); return; }
    setSaving(true); setError(null);
    try {
      if (panel) { await axios.put(`${API_BASE_URL}/api/custom-db/panels/${panel.id}`, form); }
      else       { await axios.post(`${API_BASE_URL}/api/custom-db/dashboards/${dashboardId}/panels`, form); }
      onClose();
    } catch (err) { setError(err.response?.data?.message || err.message); }
    finally { setSaving(false); }
  };

  const inp = { padding: '7px 12px', fontSize: 12, background: T.inputBg, border: `1px solid ${T.border2}`, color: T.text, outline: 'none', width: '100%', boxSizing: 'border-box' };
  const lbl = (text, req) => (
    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: T.muted, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
      {text}{req && <span style={{ color: T.red, marginLeft: 2 }}>*</span>}
    </label>
  );
  const tabBtn = (active) => ({
    padding: '8px 16px', background: 'transparent', border: 'none',
    borderBottom: active ? `2px solid ${T.blue}` : '2px solid transparent',
    color: active ? T.text : T.muted, fontSize: 12, fontWeight: active ? 600 : 400,
    cursor: 'pointer', transition: 'all 0.12s',
  });

  const selectedConn = connections.find(c => c.id === form.connectionId);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, width: '100%', maxWidth: 960, maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }}>

        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderBottom: `1px solid ${T.border}`, background: T.panel, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 3, height: 16, background: T.blue, display: 'inline-block' }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{panel ? 'Edit Panel' : 'Add Panel'}</span>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: T.muted, cursor: 'pointer', fontSize: 18, lineHeight: 1 }}
            onMouseEnter={e => e.currentTarget.style.color = T.text} onMouseLeave={e => e.currentTarget.style.color = T.muted}>
            <FaTimes />
          </button>
        </div>

        {/* title + viz + refresh row */}
        <div style={{ display: 'flex', gap: 8, padding: '12px 18px', borderBottom: `1px solid ${T.border}`, flexWrap: 'wrap', flexShrink: 0 }}>
          <input type="text" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
            placeholder="Panel title *"
            style={{ ...inp, flex: 2, minWidth: 180, fontWeight: 600, fontSize: 13 }} />
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
        <div style={{ display: 'flex', borderBottom: `1px solid ${T.border}`, padding: '0 18px', background: T.panel, flexShrink: 0 }}>
          <button style={tabBtn(tab === 'query')}   onClick={() => setTab('query')}>Query</button>
          <button style={tabBtn(tab === 'preview')} onClick={() => setTab('preview')}>Preview {testResult ? '✓' : ''}</button>
          <button style={tabBtn(tab === 'options')} onClick={() => setTab('options')}>Options</button>
        </div>

        {/* tab body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px' }}>

          {/* ── QUERY TAB ── */}
          {tab === 'query' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* connection cards */}
              <div>
                {lbl('Connection', true)}
                {connections.length === 0 ? (
                  <div style={{ padding: '16px', background: T.panel, border: `1px solid ${T.border}`, fontSize: 12, color: T.muted, textAlign: 'center' }}>
                    No connections saved. Go to <strong style={{ color: T.blue }}>Connections</strong> to add one.
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {connections.map(conn => {
                      const active = form.connectionId === conn.id;
                      return (
                        <div key={conn.id} onClick={() => setForm(p => ({ ...p, connectionId: conn.id }))}
                          style={{
                            padding: '10px 14px', cursor: 'pointer',
                            background: active ? `${T.blue}18` : T.panel,
                            border: `1px solid ${active ? T.blue : T.border}`,
                            borderLeft: `3px solid ${active ? T.blue : T.border2}`,
                            transition: 'all 0.12s', minWidth: 180, flex: '1 1 180px',
                          }}
                          onMouseEnter={e => { if (!active) e.currentTarget.style.borderColor = T.blue; }}
                          onMouseLeave={e => { if (!active) e.currentTarget.style.borderColor = T.border; }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
                            {active && <FaCheckCircle style={{ color: T.blue, fontSize: 11, flexShrink: 0 }} />}
                            <FaDatabase style={{ color: active ? T.blue : T.muted, fontSize: 11, flexShrink: 0 }} />
                            <span style={{ fontSize: 12, fontWeight: 600, color: active ? T.blue : T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{conn.name}</span>
                          </div>
                          <div style={{ fontSize: 10, color: T.dim, lineHeight: 1.6 }}>
                            <div>{conn.host}:{conn.port}</div>
                            <div>{conn.database} · {conn.username}</div>
                            {conn.ssl && <div style={{ color: T.green }}>SSL enabled</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* selected connection info bar */}
              {selectedConn && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', background: `${T.blue}0a`, border: `1px solid ${T.blue}22`, fontSize: 11, color: T.muted }}>
                  <FaDatabase style={{ color: T.blue, fontSize: 10 }} />
                  <span style={{ color: T.blue, fontWeight: 600 }}>{selectedConn.name}</span>
                  <span style={{ color: T.dim }}>·</span>
                  <span>{selectedConn.host}:{selectedConn.port}/{selectedConn.database}</span>
                </div>
              )}

              {/* SQL editor */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                  {lbl('SQL Query', true)}
                  <span style={{ fontSize: 10, color: T.dim }}>Ctrl+Enter to run</span>
                </div>
                <div style={{ position: 'relative', border: `1px solid ${T.border2}`, borderLeft: `3px solid ${T.blue}`, background: T.chartBg }}>
                  <textarea
                    ref={textareaRef}
                    value={form.query}
                    onChange={e => setForm(p => ({ ...p, query: e.target.value }))}
                    onKeyDown={handleKeyDown}
                    placeholder={'SELECT *\nFROM table_name\nLIMIT 100;'}
                    spellCheck={false}
                    style={{
                      width: '100%', height: 180, padding: '10px 12px',
                      background: 'transparent', border: 'none', color: T.text,
                      fontFamily: '"Fira Code", Consolas, monospace', fontSize: 12,
                      lineHeight: 1.65, resize: 'vertical', outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div style={{ marginTop: 8 }}>
                  <button onClick={handleTest} disabled={testing || !form.connectionId || !form.query.trim()}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '6px 16px', fontSize: 11, fontWeight: 600,
                      background: testing ? T.border : `${T.blue}22`,
                      border: `1px solid ${T.blue}55`, color: T.blue,
                      cursor: testing || !form.connectionId || !form.query.trim() ? 'not-allowed' : 'pointer',
                      opacity: !form.connectionId || !form.query.trim() ? 0.5 : 1,
                      transition: 'all 0.12s',
                    }}
                    onMouseEnter={e => { if (!testing && form.connectionId && form.query.trim()) { e.currentTarget.style.background = `${T.blue}33`; e.currentTarget.style.borderColor = T.blue; }}}
                    onMouseLeave={e => { e.currentTarget.style.background = `${T.blue}22`; e.currentTarget.style.borderColor = `${T.blue}55`; }}
                  >
                    {testing ? (
                      <><svg style={{ width: 10, height: 10, animation: 'cdb-spin 0.8s linear infinite' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg> Running…</>
                    ) : (
                      <><FaPlay style={{ fontSize: 9 }} /> Run Query</>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── PREVIEW TAB ── */}
          {tab === 'preview' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 11, color: T.muted }}>
                  {testResult ? `${testResult.rowCount} rows · ${testResult.executionTime}ms` : 'Run query to see preview'}
                </span>
                <button onClick={handleTest} disabled={testing}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', fontSize: 11, fontWeight: 600, background: `${T.blue}22`, border: `1px solid ${T.blue}55`, color: T.blue, cursor: 'pointer', transition: 'all 0.12s' }}
                  onMouseEnter={e => e.currentTarget.style.background = `${T.blue}33`}
                  onMouseLeave={e => e.currentTarget.style.background = `${T.blue}22`}
                >
                  <FaPlay style={{ fontSize: 9 }} /> Refresh
                </button>
              </div>
              {testResult ? (
                <div style={{ background: T.chartBg, border: `1px solid ${T.border}`, overflowX: 'auto', maxHeight: 360, overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <thead style={{ position: 'sticky', top: 0 }}>
                      <tr style={{ background: T.panel }}>
                        {testResult.fields.map((f, i) => (
                          <th key={i} style={{ padding: '7px 12px', textAlign: 'left', color: T.muted, fontWeight: 600, borderBottom: `1px solid ${T.border}`, whiteSpace: 'nowrap' }}>
                            {f.name}
                            <div style={{ fontSize: 9, color: T.dim, fontWeight: 400 }}>{f.dataTypeID ? `type:${f.dataTypeID}` : ''}</div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {testResult.rows.slice(0, 100).map((row, ri) => (
                        <tr key={ri} style={{ borderBottom: `1px solid ${T.border}` }}
                          onMouseEnter={e => e.currentTarget.style.background = T.panel}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          {row.map((cell, ci) => (
                            <td key={ci} style={{ padding: '6px 12px', color: T.text, whiteSpace: 'nowrap', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis' }}
                              title={String(cell ?? '')}>
                              {cell === null ? <span style={{ color: T.dim }}>null</span> : String(cell)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {testResult.rows.length > 100 && (
                    <div style={{ padding: '6px 12px', color: T.dim, fontSize: 10, textAlign: 'center', borderTop: `1px solid ${T.border}` }}>
                      Showing 100 of {testResult.rowCount} rows
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: T.dim, fontSize: 12, border: `2px dashed ${T.border2}` }}>
                  Run your query first to see a preview
                </div>
              )}
            </div>
          )}

          {/* ── OPTIONS TAB ── */}
          {tab === 'options' && (() => {
            const fields = testResult?.fields || [];
            const noFields = fields.length === 0;
            const viz = form.visualizationType;
            const setOpt = (key, val) => setForm(p => ({ ...p, options: { ...p.options, [key]: val } }));

            const FieldSelect = ({ label: lbText, optKey, placeholder }) => (
              <div>
                {lbl(lbText)}
                {noFields
                  ? <div style={{ ...inp, color: T.dim, fontSize: 11 }}>Run query first</div>
                  : <select value={form.options[optKey] || ''} onChange={e => setOpt(optKey, e.target.value)}
                      style={{ ...inp, cursor: 'pointer' }}>
                      <option value="" style={{ background: T.surface }}>{placeholder || '— auto detect —'}</option>
                      {fields.map((f, i) => <option key={i} value={f.name} style={{ background: T.surface }}>{f.name}</option>)}
                    </select>
                }
              </div>
            );

            const MultiFieldSelect = ({ label: lbText, optKey }) => (
              <div>
                {lbl(lbText)}
                {noFields
                  ? <div style={{ ...inp, color: T.dim, fontSize: 11 }}>Run query first</div>
                  : <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {fields.map((f, i) => {
                        const sel = (form.options[optKey] || []).includes(f.name);
                        return (
                          <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 8px', background: sel ? `${T.blue}14` : 'transparent', border: `1px solid ${sel ? T.blue + '44' : T.border}`, cursor: 'pointer', fontSize: 12, color: sel ? T.blue : T.text, transition: 'all 0.1s' }}>
                            <input type="checkbox" checked={sel} onChange={e => {
                              const cur = form.options[optKey] || [];
                              setOpt(optKey, e.target.checked ? [...cur, f.name] : cur.filter(n => n !== f.name));
                            }} />
                            {f.name}
                          </label>
                        );
                      })}
                    </div>
                }
              </div>
            );

            // Color threshold builder
            const ThresholdBuilder = ({ optKey, label: lbText }) => {
              const thresholds = form.options[optKey] || [];
              const PRESET_COLORS = ['#f2495c','#ff780a','#f2cc0c','#73bf69','#5794f2','#b877d9'];
              return (
                <div style={{ background: T.panel, border: `1px solid ${T.border}`, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{lbText}</div>
                    <button onClick={() => setOpt(optKey, [...thresholds, { value: 0, color: '#f2495c' }])}
                      style={{ padding: '3px 10px', background: `${T.blue}22`, border: `1px solid ${T.blue}44`, color: T.blue, fontSize: 11, cursor: 'pointer' }}>
                      + Add
                    </button>
                  </div>
                  {thresholds.length === 0
                    ? <div style={{ fontSize: 11, color: T.dim }}>No thresholds — add one to enable color coding</div>
                    : thresholds.map((t, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <span style={{ fontSize: 11, color: T.muted, width: 60, flexShrink: 0 }}>≥ value</span>
                          <input type="number" value={t.value} onChange={e => {
                            const next = [...thresholds]; next[i] = { ...t, value: parseFloat(e.target.value) || 0 };
                            setOpt(optKey, next);
                          }} style={{ ...inp, width: 90 }} />
                          <span style={{ fontSize: 11, color: T.muted, flexShrink: 0 }}>color</span>
                          <div style={{ display: 'flex', gap: 4 }}>
                            {PRESET_COLORS.map(c => (
                              <button key={c} onClick={() => {
                                const next = [...thresholds]; next[i] = { ...t, color: c };
                                setOpt(optKey, next);
                              }} style={{ width: 18, height: 18, borderRadius: 3, background: c, border: t.color === c ? '2px solid #fff' : '2px solid transparent', cursor: 'pointer', padding: 0 }} />
                            ))}
                          </div>
                          <input type="text" value={t.color} onChange={e => {
                            const next = [...thresholds]; next[i] = { ...t, color: e.target.value };
                            setOpt(optKey, next);
                          }} style={{ ...inp, width: 80, fontFamily: 'monospace', fontSize: 11 }} placeholder="#hex" />
                          <button onClick={() => setOpt(optKey, thresholds.filter((_, j) => j !== i))}
                            style={{ padding: '3px 6px', background: 'transparent', border: 'none', color: T.red, cursor: 'pointer', fontSize: 13 }}>×</button>
                        </div>
                      ))
                  }
                  {thresholds.length > 0 && (
                    <div style={{ fontSize: 10, color: T.dim, marginTop: 6 }}>
                      Thresholds are checked from highest to lowest value
                    </div>
                  )}
                </div>
              );
            };

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Description */}
                <div>
                  {lbl('Description')}
                  <input type="text" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                    placeholder="Optional panel description" style={inp} />
                </div>

                {noFields && (
                  <div style={{ padding: '10px 14px', background: `${T.orange}14`, border: `1px solid ${T.orange}44`, color: T.orange, fontSize: 12 }}>
                    ⚠ Run your query in the Query tab first to configure axis and color options
                  </div>
                )}

                {/* ── BAR / LINE / AREA ── */}
                {(viz === 'bar' || viz === 'line' || viz === 'area') && (
                  <>
                    <div style={{ background: T.panel, border: `1px solid ${T.border}`, padding: '14px 16px' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Axis Configuration</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <FieldSelect label="X Axis (Category)" optKey="xAxisColumn" placeholder="— auto (first column) —" />
                        <MultiFieldSelect label="Y Axis (Values — check all you want)" optKey="yAxisColumns" />
                      </div>
                      <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
                        {viz === 'bar' && (
                          <>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 7, color: T.text, fontSize: 12, cursor: 'pointer' }}>
                              <input type="checkbox" checked={form.options.stacked === true} onChange={e => setOpt('stacked', e.target.checked)} />
                              Stacked
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 7, color: T.text, fontSize: 12, cursor: 'pointer' }}>
                              <input type="checkbox" checked={form.options.horizontal === true} onChange={e => setOpt('horizontal', e.target.checked)} />
                              Horizontal bars
                            </label>
                          </>
                        )}
                        {(viz === 'line' || viz === 'area') && (
                          <label style={{ display: 'flex', alignItems: 'center', gap: 7, color: T.text, fontSize: 12, cursor: 'pointer' }}>
                            <input type="checkbox" checked={form.options.areaMode === true} onChange={e => setOpt('areaMode', e.target.checked)} />
                            Area fill
                          </label>
                        )}
                      </div>
                      <div style={{ marginTop: 12 }}>
                        {lbl('Y Axis unit suffix')}
                        <input type="text" value={form.options.unit || ''} onChange={e => setOpt('unit', e.target.value)}
                          placeholder="e.g. ms, $, %" style={{ ...inp, width: 140 }} />
                      </div>
                    </div>

                    {/* Color coding for bar */}
                    {viz === 'bar' && (
                      <ThresholdBuilder optKey="colorByValue" label="Color Coding — Bar Thresholds" />
                    )}

                    {/* Series colors */}
                    <div style={{ background: T.panel, border: `1px solid ${T.border}`, padding: '14px 16px' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Series Colors</div>
                      <div style={{ fontSize: 11, color: T.dim, marginBottom: 8 }}>Override default colors for each Y column (leave blank for auto)</div>
                      {(form.options.yAxisColumns?.length > 0 ? form.options.yAxisColumns : fields.slice(1).map(f => f.name)).map((col, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <span style={{ fontSize: 12, color: T.text, minWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>{col}</span>
                          <input type="color" value={(form.options.seriesColors || [])[i] || '#5794f2'}
                            onChange={e => {
                              const cur = [...(form.options.seriesColors || [])];
                              cur[i] = e.target.value;
                              setOpt('seriesColors', cur);
                            }}
                            style={{ width: 36, height: 28, border: `1px solid ${T.border2}`, cursor: 'pointer', background: 'transparent', padding: 2 }}
                          />
                          <span style={{ fontSize: 11, color: T.dim }}>{(form.options.seriesColors || [])[i] || 'auto'}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* ── PIE ── */}
                {viz === 'pie' && (
                  <div style={{ background: T.panel, border: `1px solid ${T.border}`, padding: '14px 16px' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Pie Chart Configuration</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <FieldSelect label="Label Column (Name)" optKey="nameColumn" placeholder="— auto (first string col) —" />
                      <FieldSelect label="Value Column" optKey="valueColumn" placeholder="— auto (first numeric col) —" />
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 7, color: T.text, fontSize: 12, cursor: 'pointer', marginTop: 12 }}>
                      <input type="checkbox" checked={form.options.donutMode === true} onChange={e => setOpt('donutMode', e.target.checked)} />
                      Donut mode
                    </label>
                  </div>
                )}

                {/* ── STAT ── */}
                {viz === 'stat' && (
                  <>
                    <div style={{ background: T.panel, border: `1px solid ${T.border}`, padding: '14px 16px' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Stat Configuration</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                          {lbl('Column to display')}
                          <select value={form.options.columnIndex ?? 0} onChange={e => setOpt('columnIndex', parseInt(e.target.value))}
                            style={{ ...inp, cursor: 'pointer' }}>
                            {fields.length > 0
                              ? fields.map((f, i) => <option key={i} value={i} style={{ background: T.surface }}>[{i}] {f.name}</option>)
                              : <option value={0} style={{ background: T.surface }}>Run query first</option>}
                          </select>
                        </div>
                        <div>
                          {lbl('Aggregation')}
                          <select value={form.options.aggregation || 'last'} onChange={e => setOpt('aggregation', e.target.value)}
                            style={{ ...inp, cursor: 'pointer' }}>
                            {[['last','Last'],['first','First'],['sum','Sum'],['avg','Average'],['min','Min'],['max','Max'],['count','Count']].map(([v,l]) =>
                              <option key={v} value={v} style={{ background: T.surface }}>{l}</option>)}
                          </select>
                        </div>
                        <div>
                          {lbl('Unit suffix')}
                          <input type="text" value={form.options.unit || ''} onChange={e => setOpt('unit', e.target.value)} placeholder="ms, %, $" style={inp} />
                        </div>
                        <div>
                          {lbl('Decimal places')}
                          <input type="number" min={0} max={6} value={form.options.decimals ?? 0} onChange={e => setOpt('decimals', parseInt(e.target.value) || 0)} style={inp} />
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 20, marginTop: 12 }}>
                        {[['showSparkline','Sparkline'],['showTrend','Trend %']].map(([key, label]) => (
                          <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 7, color: T.text, fontSize: 12, cursor: 'pointer' }}>
                            <input type="checkbox" checked={form.options[key] === true} onChange={e => setOpt(key, e.target.checked)} />
                            {label}
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Stat color coding */}
                    <div style={{ background: T.panel, border: `1px solid ${T.border}`, padding: '14px 16px' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Color Mode</div>
                      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                        {[['none','None'],['threshold','Threshold'],['fixed','Fixed']].map(([v,l]) => (
                          <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 6, color: form.options.colorMode === v ? T.blue : T.text, fontSize: 12, cursor: 'pointer' }}>
                            <input type="radio" name="colorMode" value={v} checked={(form.options.colorMode || 'none') === v} onChange={() => setOpt('colorMode', v)} />
                            {l}
                          </label>
                        ))}
                      </div>
                      {form.options.colorMode === 'fixed' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {lbl('Color')}
                          <input type="color" value={form.options.fixedColor || '#5794f2'} onChange={e => setOpt('fixedColor', e.target.value)}
                            style={{ width: 36, height: 28, border: `1px solid ${T.border2}`, cursor: 'pointer', background: 'transparent', padding: 2 }} />
                        </div>
                      )}
                      {form.options.colorMode === 'threshold' && (
                        <ThresholdBuilder optKey="thresholds" label="Thresholds" />
                      )}
                    </div>
                  </>
                )}

                {/* ── GAUGE ── */}
                {viz === 'gauge' && (
                  <div style={{ background: T.panel, border: `1px solid ${T.border}`, padding: '14px 16px' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Gauge Configuration</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                      <FieldSelect label="Value Column" optKey="valueColumn" placeholder="— auto —" />
                      <div>
                        {lbl('Min value')}
                        <input type="number" value={form.options.minValue ?? 0} onChange={e => setOpt('minValue', parseFloat(e.target.value) || 0)} style={inp} />
                      </div>
                      <div>
                        {lbl('Max value')}
                        <input type="number" value={form.options.maxValue ?? 100} onChange={e => setOpt('maxValue', parseFloat(e.target.value) || 100)} style={inp} />
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                      <div>
                        {lbl('Unit suffix')}
                        <input type="text" value={form.options.unit || ''} onChange={e => setOpt('unit', e.target.value)} placeholder="%" style={inp} />
                      </div>
                      <div>
                        {lbl('Decimal places')}
                        <input type="number" min={0} max={4} value={form.options.decimals ?? 1} onChange={e => setOpt('decimals', parseInt(e.target.value) || 0)} style={inp} />
                      </div>
                    </div>
                    <div style={{ marginTop: 12 }}>
                      <ThresholdBuilder optKey="thresholds" label="Color Thresholds" />
                    </div>
                  </div>
                )}

                {/* ── TABLE ── */}
                {viz === 'table' && !noFields && (
                  <div style={{ background: T.panel, border: `1px solid ${T.border}`, padding: '14px 16px' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Visible Columns</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {fields.map((f, i) => {
                        const hidden = (form.options.hiddenColumns || []).includes(f.name);
                        return (
                          <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, color: T.text, fontSize: 12, cursor: 'pointer' }}>
                            <input type="checkbox" checked={!hidden} onChange={e => {
                              const cur = form.options.hiddenColumns || [];
                              setOpt('hiddenColumns', e.target.checked ? cur.filter(n => n !== f.name) : [...cur, f.name]);
                            }} />
                            {f.name}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* error */}
        {error && (
          <div style={{ margin: '0 18px', padding: '8px 12px', background: `${T.red}14`, border: `1px solid ${T.red}44`, color: T.red, fontSize: 12, flexShrink: 0 }}>
            ⚠ {error}
          </div>
        )}

        {/* footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 18px', borderTop: `1px solid ${T.border}`, background: T.panel, flexShrink: 0 }}>
          <button onClick={onClose}
            style={{ padding: '6px 18px', background: 'transparent', border: `1px solid ${T.border2}`, color: T.muted, fontSize: 12, cursor: 'pointer', transition: 'all 0.12s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = T.text; e.currentTarget.style.color = T.text; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = T.border2; e.currentTarget.style.color = T.muted; }}
          >
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 20px', background: saving ? T.border : T.green, border: 'none', color: '#fff', fontSize: 12, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', transition: 'all 0.12s' }}
          >
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
