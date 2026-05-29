import { useMemo } from 'react';
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ZAxis, Legend,
} from 'recharts';
import { useTheme } from '../../../context/ThemeContext';

const COLORS = ['#5794f2','#73bf69','#f2cc0c','#ff780a','#f2495c','#b877d9'];

const CustomTooltip = ({ active, payload, T }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border2}`, padding: '8px 12px', fontSize: 11, lineHeight: 1.8, boxShadow: '0 4px 16px rgba(0,0,0,0.3)' }}>
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ color: T.muted }}>{p.name}</span>
          <span style={{ color: T.text, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
            {typeof p.value === 'number' ? p.value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

const ScatterViz = ({ data, options = {} }) => {
  const { T } = useTheme();
  const { xAxisColumn, yAxisColumn, sizeColumn, unit = '' } = options;

  const { points, xCol, yCol } = useMemo(() => {
    if (!data?.rows?.length || !data?.fields?.length) return { points: [], xCol: '', yCol: '' };
    const fields = data.fields;

    // Auto-detect: first numeric = x, second numeric = y
    const numericCols = [];
    for (let i = 0; i < fields.length; i++) {
      const s = data.rows[0]?.[i];
      if (typeof s === 'number' || (!isNaN(parseFloat(s)) && s !== null && String(s).trim() !== '')) {
        numericCols.push(i);
      }
    }

    const xIdx = xAxisColumn ? fields.findIndex(f => f.name === xAxisColumn) : (numericCols[0] ?? 0);
    const yIdx = yAxisColumn ? fields.findIndex(f => f.name === yAxisColumn) : (numericCols[1] ?? 1);
    const zIdx = sizeColumn  ? fields.findIndex(f => f.name === sizeColumn)  : -1;

    const pts = data.rows.map(row => {
      const obj = {
        x: parseFloat(row[xIdx]) || 0,
        y: parseFloat(row[yIdx]) || 0,
      };
      if (zIdx >= 0) obj.z = parseFloat(row[zIdx]) || 1;
      // Add label from first string column
      for (let i = 0; i < fields.length; i++) {
        const v = row[i];
        if (typeof v === 'string' && isNaN(parseFloat(v))) { obj.label = v; break; }
      }
      return obj;
    });

    return { points: pts, xCol: fields[xIdx]?.name || 'x', yCol: fields[yIdx]?.name || 'y' };
  }, [data, xAxisColumn, yAxisColumn, sizeColumn]);

  if (!points.length) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: T.dim, fontSize: 12 }}>No data</div>;

  const fmtAxis = v => {
    if (typeof v !== 'number') return v;
    if (v >= 1e6) return `${(v/1e6).toFixed(1)}M`;
    if (v >= 1e3) return `${(v/1e3).toFixed(1)}K`;
    return v.toLocaleString(undefined, { maximumFractionDigits: 1 });
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ScatterChart margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="0" stroke={T.gridLine} />
        <XAxis type="number" dataKey="x" name={xCol} tick={{ fill: T.muted, fontSize: 10 }} axisLine={{ stroke: T.border }} tickLine={false} tickFormatter={fmtAxis} label={{ value: xCol, position: 'insideBottom', offset: -2, fill: T.muted, fontSize: 10 }} />
        <YAxis type="number" dataKey="y" name={yCol} tick={{ fill: T.muted, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={fmtAxis} width={52} />
        {points[0]?.z !== undefined && <ZAxis type="number" dataKey="z" range={[40, 400]} />}
        <Tooltip content={<CustomTooltip T={T} />} cursor={{ strokeDasharray: '3 3', stroke: T.border2 }} />
        <Scatter data={points} fill={COLORS[0]} fillOpacity={0.8} />
      </ScatterChart>
    </ResponsiveContainer>
  );
};

export default ScatterViz;
