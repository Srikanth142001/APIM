import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../../config/apiConfig';
import { useTheme } from '../../context/ThemeContext';
import MultiQueryEditor from './MultiQueryEditor';
import TimeSeriesChart from './visualizations/TimeSeriesChart';
import { FaTimes, FaSave, FaPlay } from 'react-icons/fa';

const VIZ_TYPES = [
  { value: 'timeseries', label: '📈 Time Series' },
  { value: 'area',       label: '🌊 Area Chart'  },
  { value: 'bar',        label: '📊 Bar Chart'   },
  { value: 'table',      label: '📋 Table'       },
  { value: 'stat',       label: '🔢 Stat'        },
  { value: 'pie',        label: '🥧 Pie Chart'   },
];

const REFRESH_OPTIONS = [
  { value: 0,    label: 'Off'  },
  { value: 30,   label: '30s'  },
  { value: 60,   label: '1m'   },
  { value: 300,  label: '5m'   },
  { value: 600,  label: '10m'  },
  { value: 1800, label: '30m'  },
  { value: 3600, label: '1h'   },
];

const mkQuery = () => ({ id: `q_${Date.now()}`, label: 'Query A', kql: '', color: '#5794f2' });

const KqlPanelEditor = ({ panel, dashboardId, onClose, onSaved }) => {
  const { T } = useTheme();

  const [form, setForm] = useState({
    title:              panel?.title              || '',
    description:        panel?.description        || '',
    queries:            panel?.queries?.length > 0 ? panel.queries : [mkQuery()],
    visualizationType:  panel?.visualizationType  || 'timeseries',
    timeRange:          panel?.timeRange           || 'PT1H',
    refreshInterval:    panel?.refreshInterval     || 0,
    options:            panel?.options             || {},
  });

  const [testResult,  setTestResult]  = useState(null);
  const [running,     setRunning]     = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [tab,         setTab]         = useState('query'); // query | preview | options

  useEffect(() => {
    axios.get(`${API_BASE_URL}/api/kql/suggestions`)
      .then(r => { if (r.data.success) setSuggestions(r.data.suggestions); })
      .catch(() => {});
  }, []);

  /* ── run queries ── */
  const handleRun = async () => {
    const valid = form.queries.filter(q => q.kql?.trim());
    if (!valid.length) { setError('Enter at least one KQL query'); return; }
    setRunning(true); setError(null); setTestResult(null);
    try {
      let result;
      if (valid.length === 1) {
        const r = await axios.post(`${API_BASE_URL}/api/kql/query`, { query: valid[0].kql, timespan: form.timeRange });
        result = { single: true, data: r.data };
      } else {
        const r = await axios.post(`${API_BASE_URL}/api/kql/query/multiple`, { queries: valid, timespan: form.timeRange });
        result = { single: false, data: r.data };
      }
      setTestResult(result);
      setTab('preview');
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setRunning(false);
    }
  };

  /* ── save ── */
  const handleSave = async () => {
    if (!form.title.trim()) { setError('Panel title is required'); return; }
    const valid = form.queries.filter(q => q.kql?.trim());
    if (!valid.length) { setError('At least one KQL query is required'); return; }
    setSaving(true); setError(null);
    try {
      const payload = { ...form, queries: valid };
      if (panel) {
        await axios.put(`${API_BASE_URL}/api/kql/panels/${panel.id}`, payload);
      } else {
        await axios.post(`${API_BASE_URL}/api/kql/dashboards/${dashboardId}/panels`, payload);
      }
      onSaved && onSaved();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setSaving(false);
    }
  };

  /* ── preview renderer ── */
  const renderPreview = () => {
    if (!testResult) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 280, gap: 12, color: T.dim }}>
          <span style={{ fontSize: 36 }}>📊</span>
          <span style={{ fontSize: 12 }}>Run your queries to see a preview</span>
        </div>
      );
    }

    const viz = form.visualizationType;

    if (viz === 'table') {
      const table = testResult.single
        ? testResult.data?.tables?.[0]
        : testResult.data?.queries?.[0]?.data?.tables?.[0];
      if (!table) return <div style={{ color: T.dim, padding: 16, fontSize: 12 }}>No data</div>;
      return (
        <div style={{ overflowX: 'auto', maxHeight: 300, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ background: T.panel }}>
                {table.columns.map((col, i) => (
                  <th key={i} style={{ padding: '7px 12px', textAlign: 'left', color: T.muted, fontWeight: 600, borderBottom: `1px solid ${T.border}`, whiteSpace: 'nowrap' }}>
                    {col.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.slice(0, 50).map((row, ri) => (
                <tr key={ri} style={{ borderBottom: `1px solid ${T.border}` }}
                  onMouseEnter={e => e.currentTarget.style.background = T.panel}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  {row.map((cell, ci) => (
                    <td key={ci} style={{ padding: '6px 12px', color: T.text, whiteSpace: 'nowrap' }}>
                      {cell === null ? <span style={{ color: T.dim }}>null</span> : String(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {table.rows.length > 50 && (
            <div style={{ padding: '6px 12px', color: T.dim, fontSize: 10, textAlign: 'center' }}>
              Showing 50 of {table.rows.length} rows
            </div>
          )}
        </div>
      );
    }

    if (viz === 'stat') {
      const table = testResult.single
        ? testResult.data?.tables?.[0]
        : testResult.data?.queries?.[0]?.data?.tables?.[0];
      if (!table) return <div style={{ color: T.dim, padding: 16, fontSize: 12 }}>No data</div>;

      const colIdx = Math.min(form.options.columnIndex || 0, table.columns.length - 1);
      const agg    = form.options.aggregation || 'last';
      const unit   = form.options.unit || '';
      const decs   = form.options.decimals ?? 0;

      const rawVals = table.rows.map(r => r[colIdx]).filter(v => v !== null && v !== undefined);
      const nums    = rawVals.map(v => parseFloat(v)).filter(v => !isNaN(v));

      let val;
      switch (agg) {
        case 'first': val = rawVals[0]; break;
        case 'sum':   val = nums.reduce((a, b) => a + b, 0); break;
        case 'avg':   val = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null; break;
        case 'min':   val = nums.length ? Math.min(...nums) : null; break;
        case 'max':   val = nums.length ? Math.max(...nums) : null; break;
        case 'count': val = rawVals.length; break;
        default:      val = rawVals[rawVals.length - 1]; break;
      }

      const display = val === null || val === undefined ? 'N/A'
        : typeof val === 'number' ? val.toFixed(decs)
        : String(val);

      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 52, fontWeight: 700, color: T.blue, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
              {display}{unit}
            </div>
            <div style={{ fontSize: 13, color: T.muted, marginTop: 8 }}>
              {table.columns[colIdx]?.name || 'Value'}
              {agg !== 'last' && <span style={{ fontSize: 11, marginLeft: 6, color: T.dim }}>({agg})</span>}
            </div>
            <div style={{ fontSize: 11, color: T.dim, marginTop: 4 }}>{rawVals.length} data points</div>
          </div>
        </div>
      );
    }

    const chartType = viz === 'area' ? 'area' : viz === 'bar' ? 'bar' : 'line';
    const results = testResult.single ? [testResult.data] : [testResult.data];
    return (
      <div style={{ height: 260 }}>
        <TimeSeriesChart queryResults={results} options={{ chartType, showGrid: true, showLegend: true }} />
      </div>
    );
  };

  /* ── shared styles ── */
  const inputStyle = {
    padding: '7px 12px',
    background: T.inputBg,
    border: `1px solid ${T.border2}`,
    color: T.text,
    fontSize: 12,
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  };

  const tabBtn = (active) => ({
    padding: '8px 16px',
    background: 'transparent',
    border: 'none',
    borderBottom: active ? `2px solid ${T.blue}` : '2px solid transparent',
    color: active ? T.text : T.muted,
    fontSize: 12,
    fontWeight: active ? 600 : 400,
    cursor: 'pointer',
    transition: 'all 0.12s',
    letterSpacing: '0.02em',
  });

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.65)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 20,
    }}>
      <div style={{
        background: T.surface,
        border: `1px solid ${T.border}`,
        width: '100%', maxWidth: 920,
        maxHeight: '92vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
      }}>
        {/* ── modal header ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 18px',
          borderBottom: `1px solid ${T.border}`,
          background: T.panel,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 3, height: 16, background: T.blue, display: 'inline-block' }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>
              {panel ? 'Edit Panel' : 'Add Panel'}
            </span>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: T.muted, cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '2px 4px' }}
            onMouseEnter={e => e.currentTarget.style.color = T.text}
            onMouseLeave={e => e.currentTarget.style.color = T.muted}
          >
            <FaTimes />
          </button>
        </div>

        {/* ── title / viz / refresh row ── */}
        <div style={{ display: 'flex', gap: 8, padding: '12px 18px', borderBottom: `1px solid ${T.border}`, flexWrap: 'wrap' }}>
          <input
            type="text"
            value={form.title}
            onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
            placeholder="Panel title *"
            style={{ ...inputStyle, flex: 2, minWidth: 180, fontWeight: 600, fontSize: 13 }}
          />
          <select value={form.visualizationType} onChange={e => setForm(p => ({ ...p, visualizationType: e.target.value }))}
            style={{ ...inputStyle, flex: 1, minWidth: 150, cursor: 'pointer', width: 'auto' }}>
            {VIZ_TYPES.map(v => <option key={v.value} value={v.value} style={{ background: T.surface }}>{v.label}</option>)}
          </select>
          <select value={form.refreshInterval} onChange={e => setForm(p => ({ ...p, refreshInterval: parseInt(e.target.value) }))}
            style={{ ...inputStyle, cursor: 'pointer', width: 'auto' }}>
            {REFRESH_OPTIONS.map(r => <option key={r.value} value={r.value} style={{ background: T.surface }}>🔄 {r.label}</option>)}
          </select>
        </div>

        {/* ── tabs ── */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${T.border}`, padding: '0 18px', background: T.panel }}>
          <button style={tabBtn(tab === 'query')}   onClick={() => setTab('query')}>Query Editor</button>
          <button style={tabBtn(tab === 'preview')} onClick={() => setTab('preview')}>
            Preview {testResult ? '✓' : ''}
          </button>
          <button style={tabBtn(tab === 'options')} onClick={() => setTab('options')}>Options</button>
        </div>

        {/* ── tab body ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px' }}>

          {tab === 'query' && (
            <MultiQueryEditor
              queries={form.queries}
              onChange={queries => setForm(p => ({ ...p, queries }))}
              onRunAll={handleRun}
              running={running}
              timeRange={form.timeRange}
              onTimeRangeChange={tr => setForm(p => ({ ...p, timeRange: tr }))}
              suggestions={suggestions}
            />
          )}

          {tab === 'preview' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 11, color: T.muted }}>
                  {testResult ? `${form.visualizationType} visualization` : 'Run queries first to see a preview'}
                </span>
                <button onClick={handleRun} disabled={running}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '5px 12px', fontSize: 11, fontWeight: 600,
                    background: `${T.blue}22`, border: `1px solid ${T.blue}55`,
                    color: T.blue, cursor: 'pointer', transition: 'all 0.12s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = `${T.blue}33`}
                  onMouseLeave={e => e.currentTarget.style.background = `${T.blue}22`}
                >
                  <FaPlay style={{ fontSize: 9 }} /> Refresh
                </button>
              </div>
              <div style={{ background: T.chartBg, border: `1px solid ${T.border}`, padding: 14, minHeight: 280 }}>
                {renderPreview()}
              </div>
            </div>
          )}

          {tab === 'options' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Description */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: T.muted, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Description</label>
                <input type="text" value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Optional description" style={inputStyle} />
              </div>

              {/* ── Stat-specific options ── */}
              {form.visualizationType === 'stat' && (() => {
                const table = testResult?.single
                  ? testResult.data?.tables?.[0]
                  : testResult?.data?.queries?.[0]?.data?.tables?.[0];
                const cols = table?.columns || [];
                return (
                  <div style={{ background: T.panel, border: `1px solid ${T.border}`, padding: '14px 16px' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>
                      Stat Options
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      {/* Column picker */}
                      <div>
                        <label style={{ display: 'block', fontSize: 11, color: T.muted, marginBottom: 4 }}>Column to display</label>
                        <select value={form.options.columnIndex ?? 0}
                          onChange={e => setForm(p => ({ ...p, options: { ...p.options, columnIndex: parseInt(e.target.value) } }))}
                          style={{ ...inputStyle, cursor: 'pointer', width: '100%' }}>
                          {cols.length > 0
                            ? cols.map((col, i) => (
                                <option key={i} value={i} style={{ background: T.surface }}>
                                  [{i}] {col.name} ({col.type})
                                </option>
                              ))
                            : <option value={0} style={{ background: T.surface }}>Run query first to see columns</option>
                          }
                        </select>
                        {cols.length === 0 && (
                          <div style={{ fontSize: 10, color: T.orange, marginTop: 4 }}>
                            ⚠ Run query in Query Editor tab first
                          </div>
                        )}
                      </div>
                      {/* Aggregation */}
                      <div>
                        <label style={{ display: 'block', fontSize: 11, color: T.muted, marginBottom: 4 }}>Aggregation</label>
                        <select value={form.options.aggregation || 'last'}
                          onChange={e => setForm(p => ({ ...p, options: { ...p.options, aggregation: e.target.value } }))}
                          style={{ ...inputStyle, cursor: 'pointer', width: '100%' }}>
                          <option value="last"  style={{ background: T.surface }}>Last value</option>
                          <option value="first" style={{ background: T.surface }}>First value</option>
                          <option value="sum"   style={{ background: T.surface }}>Sum</option>
                          <option value="avg"   style={{ background: T.surface }}>Average</option>
                          <option value="min"   style={{ background: T.surface }}>Minimum</option>
                          <option value="max"   style={{ background: T.surface }}>Maximum</option>
                          <option value="count" style={{ background: T.surface }}>Count</option>
                        </select>
                      </div>
                      {/* Unit */}
                      <div>
                        <label style={{ display: 'block', fontSize: 11, color: T.muted, marginBottom: 4 }}>Unit suffix</label>
                        <input type="text" value={form.options.unit || ''}
                          onChange={e => setForm(p => ({ ...p, options: { ...p.options, unit: e.target.value } }))}
                          placeholder="e.g. ms, %, req/s"
                          style={{ ...inputStyle, width: '100%' }} />
                      </div>
                      {/* Decimals */}
                      <div>
                        <label style={{ display: 'block', fontSize: 11, color: T.muted, marginBottom: 4 }}>Decimal places</label>
                        <input type="number" min={0} max={6}
                          value={form.options.decimals ?? 0}
                          onChange={e => setForm(p => ({ ...p, options: { ...p.options, decimals: parseInt(e.target.value) || 0 } }))}
                          style={{ ...inputStyle, width: '100%' }} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 20, marginTop: 14 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 7, color: T.text, fontSize: 12, cursor: 'pointer' }}>
                        <input type="checkbox" checked={form.options.showSparkline === true}
                          onChange={e => setForm(p => ({ ...p, options: { ...p.options, showSparkline: e.target.checked } }))} />
                        Show sparkline
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 7, color: T.text, fontSize: 12, cursor: 'pointer' }}>
                        <input type="checkbox" checked={form.options.showTrend === true}
                          onChange={e => setForm(p => ({ ...p, options: { ...p.options, showTrend: e.target.checked } }))} />
                        Show trend %
                      </label>
                    </div>
                  </div>
                );
              })()}

              {/* ── Time series / area options ── */}
              {(form.visualizationType === 'timeseries' || form.visualizationType === 'area') && (
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: T.muted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Chart Options</label>
                  <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                    {[['smooth','Smooth lines'],['showGrid','Show grid'],['stacked','Stacked']].map(([key, label]) => (
                      <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 7, color: T.text, fontSize: 12, cursor: 'pointer' }}>
                        <input type="checkbox"
                          checked={key === 'stacked' ? form.options.stacked === true : form.options[key] !== false}
                          onChange={e => setForm(p => ({ ...p, options: { ...p.options, [key]: e.target.checked } }))} />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Unit (non-stat) */}
              {form.visualizationType !== 'stat' && (
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: T.muted, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Unit Suffix</label>
                  <input type="text" value={form.options.unit || ''}
                    onChange={e => setForm(p => ({ ...p, options: { ...p.options, unit: e.target.value } }))}
                    placeholder="e.g. ms, %, req/s"
                    style={{ ...inputStyle, width: 200 }} />
                </div>
              )}

            </div>
          )}
        </div>

        {/* ── error bar ── */}
        {error && (
          <div style={{ margin: '0 18px', padding: '8px 12px', background: `${T.red}14`, border: `1px solid ${T.red}44`, color: T.red, fontSize: 12 }}>
            ⚠ {error}
          </div>
        )}

        {/* ── footer ── */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: 8,
          padding: '12px 18px',
          borderTop: `1px solid ${T.border}`,
          background: T.panel,
        }}>
          <button onClick={onClose}
            style={{ padding: '6px 18px', background: 'transparent', border: `1px solid ${T.border2}`, color: T.muted, fontSize: 12, cursor: 'pointer', transition: 'all 0.12s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = T.text; e.currentTarget.style.color = T.text; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = T.border2; e.currentTarget.style.color = T.muted; }}
          >
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '6px 20px',
              background: saving ? T.border : T.green,
              border: 'none',
              color: '#fff', fontSize: 12, fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer',
              transition: 'all 0.12s',
            }}
          >
            <FaSave style={{ fontSize: 11 }} />
            {saving ? 'Saving…' : 'Save Panel'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default KqlPanelEditor;
