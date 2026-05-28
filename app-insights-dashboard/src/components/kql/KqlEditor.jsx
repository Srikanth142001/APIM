import React, { useState, useRef } from 'react';
import { FaPlay, FaLightbulb, FaChevronDown, FaChevronUp } from 'react-icons/fa';
import { useTheme } from '../../context/ThemeContext';

export const TIME_RANGES = [
  { label: 'Last 5 min',   value: 'PT5M'  },
  { label: 'Last 15 min',  value: 'PT15M' },
  { label: 'Last 30 min',  value: 'PT30M' },
  { label: 'Last 1 hour',  value: 'PT1H'  },
  { label: 'Last 3 hours', value: 'PT3H'  },
  { label: 'Last 6 hours', value: 'PT6H'  },
  { label: 'Last 12 hours',value: 'PT12H' },
  { label: 'Last 24 hours',value: 'P1D'   },
  { label: 'Last 2 days',  value: 'P2D'   },
  { label: 'Last 7 days',  value: 'P7D'   },
  { label: 'Last 30 days', value: 'P30D'  },
];

const KqlEditor = ({
  value,
  onChange,
  onRun,
  running = false,
  timeRange,
  onTimeRangeChange,
  label = '',
  color = '#5794f2',
  showTimeRange = true,
  placeholder = 'requests\n| where timestamp > ago(1h)\n| summarize count() by bin(timestamp, 5m)\n| order by timestamp asc',
  suggestions = [],
  height = 180,
}) => {
  const { T } = useTheme();
  const [showSnippets, setShowSnippets] = useState(false);
  const textareaRef = useRef(null);

  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (onRun) onRun();
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = e.target.selectionStart;
      const end = e.target.selectionEnd;
      const newVal = value.substring(0, start) + '  ' + value.substring(end);
      onChange(newVal);
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = start + 2;
          textareaRef.current.selectionEnd = start + 2;
        }
      }, 0);
    }
  };

  const insertSnippet = (kql) => {
    onChange(kql);
    setShowSnippets(false);
    if (textareaRef.current) textareaRef.current.focus();
  };

  const btnBase = {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '4px 10px', fontSize: 11, fontWeight: 500,
    background: 'transparent',
    border: `1px solid ${T.border2}`,
    color: T.muted, cursor: 'pointer',
    transition: 'border-color 0.12s, color 0.12s',
    letterSpacing: '0.02em',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {label && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '3px 9px',
            background: `${color}18`,
            border: `1px solid ${color}44`,
            fontSize: 11, fontWeight: 600, color,
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, display: 'inline-block' }} />
            {label}
          </div>
        )}

        {showTimeRange && (
          <select
            value={timeRange || 'PT1H'}
            onChange={(e) => onTimeRangeChange && onTimeRangeChange(e.target.value)}
            style={{
              ...btnBase,
              background: T.surface,
              border: `1px solid ${T.border2}`,
              color: T.text,
              outline: 'none',
              cursor: 'pointer',
              padding: '4px 8px',
            }}
          >
            {TIME_RANGES.map(t => (
              <option key={t.value} value={t.value} style={{ background: T.surface }}>{t.label}</option>
            ))}
          </select>
        )}

        {suggestions.length > 0 && (
          <button
            onClick={() => setShowSnippets(v => !v)}
            style={{ ...btnBase }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = T.blue; e.currentTarget.style.color = T.text; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = T.border2; e.currentTarget.style.color = T.muted; }}
          >
            <FaLightbulb style={{ fontSize: 10, color: T.orange }} />
            Snippets
            {showSnippets
              ? <FaChevronUp style={{ fontSize: 9 }} />
              : <FaChevronDown style={{ fontSize: 9 }} />}
          </button>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, color: T.dim }}>Ctrl+Enter to run</span>
          {onRun && (
            <button
              onClick={onRun}
              disabled={running || !value?.trim()}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '5px 14px', fontSize: 11, fontWeight: 600,
                background: running ? `${T.blue}18` : `${T.blue}22`,
                border: `1px solid ${running ? T.border2 : T.blue + '55'}`,
                color: running || !value?.trim() ? T.dim : T.blue,
                cursor: running || !value?.trim() ? 'not-allowed' : 'pointer',
                transition: 'all 0.12s',
                letterSpacing: '0.02em',
              }}
              onMouseEnter={e => { if (!running && value?.trim()) { e.currentTarget.style.background = `${T.blue}33`; e.currentTarget.style.borderColor = T.blue; }}}
              onMouseLeave={e => { e.currentTarget.style.background = `${T.blue}22`; e.currentTarget.style.borderColor = `${T.blue}55`; }}
            >
              {running ? (
                <>
                  <svg style={{ width: 10, height: 10, animation: 'kql-spin 0.8s linear infinite' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
                  </svg>
                  Running…
                </>
              ) : (
                <>
                  <FaPlay style={{ fontSize: 9 }} />
                  Run Query
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* ── Snippets dropdown ── */}
      {showSnippets && suggestions.length > 0 && (
        <div style={{
          background: T.surface,
          border: `1px solid ${T.border}`,
          maxHeight: 260,
          overflowY: 'auto',
        }}>
          {suggestions.map((cat, ci) => (
            <div key={ci}>
              <div style={{
                padding: '6px 12px',
                fontSize: 10, fontWeight: 700, color: T.muted,
                letterSpacing: '0.08em', textTransform: 'uppercase',
                background: T.panel, borderBottom: `1px solid ${T.border}`,
              }}>
                {cat.category}
              </div>
              {cat.queries.map((q, qi) => (
                <button
                  key={qi}
                  onClick={() => insertSnippet(q.kql)}
                  style={{
                    width: '100%', padding: '8px 14px',
                    background: 'transparent',
                    border: 'none', borderBottom: `1px solid ${T.border}`,
                    color: T.text, fontSize: 12, cursor: 'pointer', textAlign: 'left',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = T.panel}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ fontWeight: 500, color: T.blue, marginBottom: 2 }}>{q.name}</div>
                  <div style={{ fontSize: 10, color: T.dim, fontFamily: 'monospace' }}>
                    {q.kql.split('\n')[0]}…
                  </div>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* ── Editor ── */}
      <div style={{
        position: 'relative',
        border: `1px solid ${T.border2}`,
        borderLeft: `3px solid ${color}`,
        background: T.chartBg,
        overflow: 'hidden',
      }}>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          spellCheck={false}
          style={{
            width: '100%',
            height: `${height}px`,
            padding: '10px 12px',
            background: 'transparent',
            border: 'none',
            color: T.text,
            fontFamily: '"Fira Code", "Cascadia Code", Consolas, monospace',
            fontSize: 12,
            lineHeight: 1.65,
            resize: 'vertical',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>

      <style>{`@keyframes kql-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default KqlEditor;
