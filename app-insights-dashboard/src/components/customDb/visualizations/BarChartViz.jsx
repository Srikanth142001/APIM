import { useMemo } from 'react';
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, LabelList,
} from 'recharts';
import { useTheme } from '../../../context/ThemeContext';

const COLORS = [
  '#5794f2', '#73bf69', '#f2cc0c', '#ff780a', '#f2495c',
  '#b877d9', '#fade2a', '#37872d', '#c4162a', '#8ab8ff',
];

// Parse value — PostgreSQL returns bigint/numeric as strings
const parseVal = (v) => {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return v;
  const n = parseFloat(v);
  return isNaN(n) ? v : n;
};

const CustomTooltip = ({ active, payload, label, T }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: T.surface, border: `1px solid ${T.border2}`,
      padding: '8px 12px', fontSize: 11, lineHeight: 1.8,
      boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
    }}>
      <div style={{ fontWeight: 600, color: T.text, marginBottom: 4, borderBottom: `1px solid ${T.border}`, paddingBottom: 3 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
          <span style={{ color: T.muted }}>{p.name}</span>
          <span style={{ color: p.fill, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
            {typeof p.value === 'number' ? p.value.toLocaleString() : p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

const BarChartViz = ({ data, options = {} }) => {
  const { T } = useTheme();
  const {
    stacked = false,
    horizontal = false,
    unit = '',
    // seriesColors: override colors per Y column e.g. ['#f2495c', '#73bf69']
    seriesColors = [],
    // colorByValue: threshold coloring for single-series bars
    // e.g. [{value: 20000, color: '#f2495c'}, {value: 10000, color: '#f2cc0c'}]
    colorByValue = [],
  } = options;

  // Resolve color for a bar value (threshold-based)
  const getBarColor = (baseColor, value) => {
    if (!colorByValue.length || typeof value !== 'number') return baseColor;
    const sorted = [...colorByValue].sort((a, b) => b.value - a.value);
    for (const t of sorted) {
      if (value >= parseFloat(t.value)) return t.color;
    }
    return baseColor;
  };

  const { chartData, catCol, valCols } = useMemo(() => {
    if (!data?.rows?.length || !data?.fields?.length) {
      return { chartData: [], catCol: '', valCols: [] };
    }

    const fields = data.fields;

    // Use user-configured columns if set, otherwise auto-detect
    const xColName = options.xAxisColumn || null;
    const yColNames = options.yAxisColumns?.length ? options.yAxisColumns : null;

    // Auto-detect: first string/non-numeric col = category, rest = values
    let catIdx = 0;
    const valIdxs = [];

    for (let i = 0; i < fields.length; i++) {
      const sample = data.rows[0]?.[i];
      const isNum = typeof sample === 'number' || (!isNaN(parseFloat(sample)) && sample !== null && sample !== '');
      if (catIdx === 0 && !isNum && i === 0) {
        catIdx = i;
      } else if (isNum) {
        valIdxs.push(i);
      }
    }

    // If no numeric cols found, use all but first
    if (valIdxs.length === 0) {
      for (let i = 1; i < fields.length; i++) valIdxs.push(i);
    }

    // Apply user overrides
    const resolvedCatCol = xColName || fields[catIdx]?.name || fields[0]?.name;
    const resolvedValCols = yColNames || valIdxs.map(i => fields[i]?.name).filter(Boolean);

    const rows = data.rows.map(row => {
      const obj = {};
      fields.forEach((f, i) => {
        // Parse string numbers (PostgreSQL bigint/numeric come as strings)
        const v = row[i];
        obj[f.name] = (typeof v === 'string' && v !== '' && !isNaN(parseFloat(v))) ? parseFloat(v) : v;
      });
      return obj;
    });

    return {
      chartData: rows,
      catCol:    resolvedCatCol,
      valCols:   resolvedValCols,
    };
  }, [data, options]);

  if (!chartData.length) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: T.dim, fontSize: 12 }}>
        No data available
      </div>
    );
  }

  const axisStyle = { fill: T.muted, fontSize: 11 };

  const formatY = (v) => {
    if (typeof v !== 'number') return v;
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000)     return `${(v / 1_000).toFixed(1)}K`;
    return v.toLocaleString();
  };

  if (horizontal) {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="horizontal" margin={{ top: 8, right: 24, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="0" stroke={T.gridLine} horizontal={false} />
          <XAxis type="number" tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={formatY} />
          <YAxis type="category" dataKey={catCol} tick={axisStyle} axisLine={{ stroke: T.border }} tickLine={false} width={90} />
          <Tooltip content={<CustomTooltip T={T} />} cursor={{ fill: `${T.blue}11` }} />
          {valCols.length > 1 && <Legend wrapperStyle={{ fontSize: 11, color: T.muted }} />}
          {valCols.map((col, i) => {
            const baseColor = seriesColors[i] || COLORS[i % COLORS.length];
            return (
              <Bar key={col} dataKey={col} fill={baseColor}
                radius={[0, 3, 3, 0]} stackId={stacked ? 'stack' : undefined}
                maxBarSize={32}>
                {colorByValue.length > 0 && chartData.map((entry, idx) => (
                  <rect key={idx} fill={getBarColor(baseColor, parseVal(entry[col]))} />
                ))}
              </Bar>
            );
          })}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="0" stroke={T.gridLine} vertical={false} />
        <XAxis dataKey={catCol} tick={axisStyle} axisLine={{ stroke: T.border }} tickLine={false} />
        <YAxis tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={formatY} width={52} />
        <Tooltip content={<CustomTooltip T={T} />} cursor={{ fill: `${T.blue}11` }} />
        {valCols.length > 1 && <Legend wrapperStyle={{ fontSize: 11, color: T.muted, paddingTop: 6 }} />}
        {valCols.map((col, i) => {
          const baseColor = seriesColors[i] || COLORS[i % COLORS.length];
          // If colorByValue is set, use Cell for per-bar coloring
          const useCellColor = colorByValue.length > 0 && valCols.length === 1;
          return (
            <Bar key={col} dataKey={col}
              fill={useCellColor ? undefined : baseColor}
              radius={[3, 3, 0, 0]} stackId={stacked ? 'stack' : undefined}
              maxBarSize={60}>
              {useCellColor && chartData.map((entry, idx) => (
                <Cell key={idx} fill={getBarColor(baseColor, parseVal(entry[col]))} />
              ))}
              {chartData.length <= 8 && (
                <LabelList dataKey={col} position="top"
                  style={{ fill: T.muted, fontSize: 10, fontVariantNumeric: 'tabular-nums' }}
                  formatter={formatY} />
              )}
            </Bar>
          );
        })}
      </BarChart>
    </ResponsiveContainer>
  );
};

export default BarChartViz;
