import React from 'react';
import { FaPlus, FaTrash } from 'react-icons/fa';
import KqlEditor from './KqlEditor';
import { useTheme } from '../../context/ThemeContext';

const QUERY_COLORS = [
  '#5794f2', '#73bf69', '#f2cc0c', '#ff780a', '#f2495c',
  '#b877d9', '#fade2a', '#37872d', '#c4162a', '#8ab8ff',
];

const MultiQueryEditor = ({
  queries,
  onChange,
  onRunAll,
  running = false,
  timeRange,
  onTimeRangeChange,
  suggestions = [],
}) => {
  const { T } = useTheme();

  const addQuery = () => {
    const newQuery = {
      id: `q_${Date.now()}`,
      label: `Query ${queries.length + 1}`,
      kql: '',
      color: QUERY_COLORS[queries.length % QUERY_COLORS.length],
    };
    onChange([...queries, newQuery]);
  };

  const removeQuery = (id) => {
    if (queries.length <= 1) return;
    onChange(queries.filter(q => q.id !== id));
  };

  const updateQuery = (id, field, value) => {
    onChange(queries.map(q => q.id === id ? { ...q, [field]: value } : q));
  };

  const btnBase = (active, color) => ({
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '5px 11px', fontSize: 11, fontWeight: 500,
    background: active ? `${color}18` : 'transparent',
    border: `1px solid ${active ? color + '55' : T.border2}`,
    color: active ? color : T.muted,
    cursor: 'pointer', transition: 'all 0.12s', letterSpacing: '0.02em',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 11, color: T.muted }}>
          {queries.length} {queries.length === 1 ? 'query' : 'queries'}
          {queries.length > 1 && (
            <span style={{ marginLeft: 8, color: T.dim }}>
              — results overlaid on same chart
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={addQuery}
            disabled={queries.length >= 10}
            style={{ ...btnBase(false, T.blue), opacity: queries.length >= 10 ? 0.4 : 1 }}
            onMouseEnter={e => { if (queries.length < 10) { e.currentTarget.style.borderColor = T.blue; e.currentTarget.style.color = T.text; }}}
            onMouseLeave={e => { e.currentTarget.style.borderColor = T.border2; e.currentTarget.style.color = T.muted; }}
          >
            <FaPlus style={{ fontSize: 9 }} />
            Add Query
          </button>
          {onRunAll && (
            <button
              onClick={onRunAll}
              disabled={running || queries.every(q => !q.kql?.trim())}
              style={{
                ...btnBase(true, T.blue),
                opacity: running || queries.every(q => !q.kql?.trim()) ? 0.5 : 1,
                cursor: running ? 'not-allowed' : 'pointer',
              }}
            >
              {running ? (
                <>
                  <svg style={{ width: 10, height: 10, animation: 'kql-spin 0.8s linear infinite' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
                  </svg>
                  Running…
                </>
              ) : (
                `▶ Run All (${queries.filter(q => q.kql?.trim()).length})`
              )}
            </button>
          )}
        </div>
      </div>

      {/* Query editors */}
      {queries.map((query, idx) => (
        <div
          key={query.id}
          style={{
            background: T.surface,
            border: `1px solid ${T.border}`,
            borderTop: `2px solid ${query.color}`,
          }}
        >
          {/* Query header bar */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 12px',
            background: T.panel,
            borderBottom: `1px solid ${T.border}`,
          }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: query.color, flexShrink: 0, display: 'inline-block' }} />

            <input
              type="text"
              value={query.label}
              onChange={(e) => updateQuery(query.id, 'label', e.target.value)}
              style={{
                background: 'transparent', border: 'none',
                color: query.color, fontSize: 12, fontWeight: 600,
                outline: 'none', flex: 1, minWidth: 0,
              }}
              placeholder={`Query ${idx + 1}`}
            />

            {/* Color swatches */}
            <div style={{ display: 'flex', gap: 3 }}>
              {QUERY_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => updateQuery(query.id, 'color', c)}
                  title={c}
                  style={{
                    width: 12, height: 12, borderRadius: '50%', background: c,
                    border: query.color === c ? `2px solid ${T.text}` : '2px solid transparent',
                    cursor: 'pointer', padding: 0, flexShrink: 0,
                    transition: 'transform 0.1s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.4)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                />
              ))}
            </div>

            {queries.length > 1 && (
              <button
                onClick={() => removeQuery(query.id)}
                style={{
                  padding: '3px 6px', background: 'transparent', border: 'none',
                  color: T.dim, cursor: 'pointer', display: 'flex', alignItems: 'center',
                  transition: 'color 0.12s',
                }}
                onMouseEnter={e => e.currentTarget.style.color = T.red}
                onMouseLeave={e => e.currentTarget.style.color = T.dim}
                title="Remove query"
              >
                <FaTrash style={{ fontSize: 11 }} />
              </button>
            )}
          </div>

          {/* KQL editor */}
          <div style={{ padding: 12 }}>
            <KqlEditor
              value={query.kql}
              onChange={(val) => updateQuery(query.id, 'kql', val)}
              color={query.color}
              showTimeRange={idx === 0}
              timeRange={timeRange}
              onTimeRangeChange={onTimeRangeChange}
              suggestions={idx === 0 ? suggestions : []}
              height={130}
              placeholder={`// ${query.label}\nrequests\n| summarize count() by bin(timestamp, 5m)\n| order by timestamp asc`}
            />
          </div>
        </div>
      ))}

      <style>{`@keyframes kql-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default MultiQueryEditor;
