import { useMemo } from 'react';
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { useTheme } from '../../../context/ThemeContext';

const COLORS = ['#5794f2','#73bf69','#f2cc0c','#ff780a','#f2495c','#b877d9','#8ab8ff','#fade2a'];

const Tip = ({ active, payload, label, T }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border2}`, padding: '8px 12px', fontSize: 11, lineHeight: 1.8, boxShadow: '0 4px 16px rgba(0,0,0,0.3)' }}>
      <div style={{ fontWeight: 600, color: T.text, marginBottom: 4, borderBottom: `1px solid ${T.border}`, paddingBottom: 3 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: T.muted }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.stroke, display: 'inline-block' }} />
            {p.name}
          </span>
          <span style={{ color: p.stroke, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
            {typeof p.value === 'number' ? p.value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

const LineChartViz = ({ data, options = {} }) => {
  const { T } = useTheme();
  const { xAxisColumn, yAxisColumns, areaMode = false, smooth = true, unit = '' } = options;

  const { chartData, xCol, yCols } = useMemo(() => {
    if (!data?.rows?.length || !data?.fields?.length) return { chartData: [], xCol: '', yCols: [] };
    const fields = data.fields;

    const xColName = xAxisColumn || null;
    const yColNames = yAxisColumns?.length ? yAxisColumns : null;

    // Auto-detect x (first string/date col) and y (numeric cols)
    let xIdx = 0;
    const yIdxs = [];
    for (let i = 0; i < fields.length; i++) {
      const s = data.rows[0]?.[i];
      const isNum = typeof s === 'number' || (!isNaN(parseFloat(s)) && s !== null && String(s).trim() !== '');
      if (!isNum && xIdx === 0 && i === 0) xIdx = i;
      else if (isNum) yIdxs.push(i);
    }
    if (yIdxs.length === 0) { for (let i = 1; i < fields.length; i++) yIdxs.push(i); }

    const resolvedXCol = xColName || fields[xIdx]?.name;
    const resolvedYCols = yColNames || yIdxs.map(i => fields[i]?.name).filter(Boolean);

    const rows = data.rows.map(row => {
      const obj = {};
      fields.forEach((f, i) => {
        let v = row[i];
        // Parse string numbers (PostgreSQL returns bigint/numeric as strings)
        if (typeof v === 'string' && v !== '' && !isNaN(parseFloat(v))) v = parseFloat(v);
        if (f.name === resolvedXCol && typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) {
          try { v = new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }); } catch (_) {}
        }
        obj[f.name] = v;
      });
      return obj;
    });

    return { chartData: rows, xCol: resolvedXCol, yCols: resolvedYCols };
  }, [data, xAxisColumn, yAxisColumns]);

  if (!chartData.length) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: T.dim, fontSize: 12 }}>No data</div>;

  const fmtY = v => {
    if (typeof v !== 'number') return v;
    if (v >= 1e6) return `${(v/1e6).toFixed(1)}M${unit}`;
    if (v >= 1e3) return `${(v/1e3).toFixed(1)}K${unit}`;
    return `${v.toLocaleString(undefined, { maximumFractionDigits: 1 })}${unit}`;
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
        <defs>
          {yCols.map((col, i) => (
            <linearGradient key={col} id={`lg-${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0.25} />
              <stop offset="95%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0.02} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="0" stroke={T.gridLine} vertical={false} />
        <XAxis dataKey={xCol} tick={{ fill: T.muted, fontSize: 10 }} axisLine={{ stroke: T.border }} tickLine={false} interval="preserveStartEnd" minTickGap={40} />
        <YAxis tick={{ fill: T.muted, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={fmtY} width={52} />
        <Tooltip content={<Tip T={T} />} cursor={{ stroke: T.border2, strokeWidth: 1 }} />
        {yCols.length > 1 && <Legend wrapperStyle={{ fontSize: 11, color: T.muted, paddingTop: 6 }} />}
        {yCols.map((col, i) => areaMode ? (
          <Area key={col} type={smooth ? 'monotone' : 'linear'} dataKey={col}
            stroke={COLORS[i % COLORS.length]} strokeWidth={2}
            fill={`url(#lg-${i})`} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
        ) : (
          <Line key={col} type={smooth ? 'monotone' : 'linear'} dataKey={col}
            stroke={COLORS[i % COLORS.length]} strokeWidth={2}
            dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
        ))}
      </ComposedChart>
    </ResponsiveContainer>
  );
};

export default LineChartViz;
