import { useState } from 'react';
import { useTheme } from '../../../context/ThemeContext';

const TableViz = ({ data }) => {
  const { T } = useTheme();
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  if (!data || !data.rows || data.rows.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: T.dim, fontSize: 12 }}>
        No data available
      </div>
    );
  }

  const handleSort = (idx) => {
    if (sortCol === idx) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(idx); setSortDir('asc'); }
  };

  const sorted = [...data.rows].sort((a, b) => {
    if (sortCol === null) return 0;
    const av = a[sortCol], bv = b[sortCol];
    if (av === null) return 1;
    if (bv === null) return -1;
    if (typeof av === 'number' && typeof bv === 'number') return sortDir === 'asc' ? av - bv : bv - av;
    return sortDir === 'asc'
      ? String(av).localeCompare(String(bv))
      : String(bv).localeCompare(String(av));
  });

  // Format cell values
  const fmt = (val) => {
    if (val === null || val === undefined) return <span style={{ color: T.dim, fontStyle: 'italic' }}>null</span>;
    const s = String(val);
    // Format ISO timestamps to readable date
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(s)) {
      try {
        return new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      } catch (_) {}
    }
    return s;
  };

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
          <tr style={{ background: T.panel }}>
            {data.fields.map((field, i) => (
              <th
                key={i}
                onClick={() => handleSort(i)}
                style={{
                  padding: '8px 12px',
                  textAlign: 'left',
                  color: sortCol === i ? T.text : T.muted,
                  fontWeight: 600,
                  fontSize: 11,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  borderBottom: `1px solid ${T.border}`,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  userSelect: 'none',
                  transition: 'color 0.12s',
                }}
                onMouseEnter={e => e.currentTarget.style.color = T.text}
                onMouseLeave={e => e.currentTarget.style.color = sortCol === i ? T.text : T.muted}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {field.name}
                  <span style={{ fontSize: 9, color: sortCol === i ? T.blue : T.dim }}>
                    {sortCol === i ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                  </span>
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, ri) => (
            <tr
              key={ri}
              style={{ borderBottom: `1px solid ${T.border}`, transition: 'background 0.1s' }}
              onMouseEnter={e => e.currentTarget.style.background = T.panel}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {row.map((cell, ci) => {
                const isNum = typeof cell === 'number';
                return (
                  <td
                    key={ci}
                    style={{
                      padding: '7px 12px',
                      color: isNum ? T.green : T.text,
                      whiteSpace: 'nowrap',
                      fontVariantNumeric: isNum ? 'tabular-nums' : 'normal',
                      fontSize: 12,
                    }}
                  >
                    {fmt(cell)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TableViz;
