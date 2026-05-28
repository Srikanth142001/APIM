import React, { useMemo } from 'react';
import {
  ComposedChart, Line, Area, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { useTheme } from '../../../context/ThemeContext';

const SERIES_COLORS = [
  '#5794f2', '#73bf69', '#f2cc0c', '#ff780a', '#f2495c',
  '#b877d9', '#fade2a', '#37872d', '#c4162a', '#8ab8ff',
];

/* ── smart timestamp formatter ──────────────────────────────────────────── */
const formatTimestamp = (val, spanDays) => {
  if (!val) return String(val ?? '');
  try {
    const d = new Date(val);
    if (isNaN(d)) return String(val);
    if (spanDays > 7) {
      // "Apr 28" — day-level granularity
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
    if (spanDays > 1) {
      // "Apr 28 14:30"
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
        + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    // same day — time only
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch (_) { return String(val); }
};

const getSpanDays = (rawXValues) => {
  if (!rawXValues || rawXValues.length < 2) return 0;
  try {
    const t0 = new Date(rawXValues[0]).getTime();
    const t1 = new Date(rawXValues[rawXValues.length - 1]).getTime();
    return Math.abs(t1 - t0) / (1000 * 60 * 60 * 24);
  } catch (_) { return 0; }
};

/* ── custom tooltip ─────────────────────────────────────────────────────── */
const CustomTooltip = ({ active, payload, label, T }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: T.surface, border: `1px solid ${T.border2}`,
      padding: '10px 14px', fontSize: 11, lineHeight: 1.9,
      minWidth: 160, boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
    }}>
      <div style={{ color: T.muted, fontSize: 10, marginBottom: 6, borderBottom: `1px solid ${T.border}`, paddingBottom: 4, fontWeight: 600 }}>
        {label}
      </div>
      {payload.map((entry, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 20 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: T.muted }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: entry.color, flexShrink: 0, display: 'inline-block' }} />
            {entry.name}
          </span>
          <span style={{ color: entry.color, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
            {typeof entry.value === 'number'
              ? entry.value.toLocaleString(undefined, { maximumFractionDigits: 2 })
              : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
};

/* ══ main component ══════════════════════════════════════════════════════════ */
const TimeSeriesChart = ({ queryResults, options = {} }) => {
  const { T } = useTheme();
  const {
    chartType    = 'line',
    showGrid     = true,
    showLegend   = true,
    smooth       = true,
    fillOpacity  = 0.12,
    stacked      = false,
    unit         = '',
    xAxisKey:    xAxisKeyOpt  = null,
    yAxisKeys:   yAxisKeysOpt = null,
  } = options;

  const { chartData, xKey, yKeys, seriesColors } = useMemo(() => {
    const empty = { chartData: [], xKey: null, yKeys: [], seriesColors: [] };
    if (!queryResults || queryResults.length === 0) return empty;

    const first = queryResults[0];

    /* ── multi-query comparison ── */
    if (first?.queries) {
      const valid = first.queries.filter(q => q.success && q.data?.tables?.[0]);
      if (!valid.length) return empty;

      // collect all raw timestamps to compute span
      const allRaw = [];
      valid.forEach(qr => {
        const tbl  = qr.data.tables[0];
        const cols = tbl.columns.map(c => c.name);
        const xCol = cols.find(c => c.toLowerCase().includes('timestamp') || c.toLowerCase().includes('time') || c.toLowerCase().includes('date')) || cols[0];
        tbl.rows.forEach(row => {
          const obj = {};
          cols.forEach((col, i) => { obj[col] = row[i]; });
          allRaw.push(obj[xCol]);
        });
      });
      const span = getSpanDays(allRaw);

      const mergedMap = new Map();
      const yKeysArr  = [];
      const colorsArr = [];

      valid.forEach((qr, qi) => {
        const tbl  = qr.data.tables[0];
        const cols = tbl.columns.map(c => c.name);
        const xCol = cols.find(c => c.toLowerCase().includes('timestamp') || c.toLowerCase().includes('time') || c.toLowerCase().includes('date')) || cols[0];
        const yCol = cols.find(c => c !== xCol) || cols[0];
        const key  = qr.label || `Query ${qi + 1}`;
        yKeysArr.push(key);
        colorsArr.push(qr.color || SERIES_COLORS[qi % SERIES_COLORS.length]);

        tbl.rows.forEach(row => {
          const obj = {};
          cols.forEach((col, i) => { obj[col] = row[i]; });
          const displayX = formatTimestamp(obj[xCol], span);
          if (!mergedMap.has(displayX)) mergedMap.set(displayX, { _x: displayX });
          mergedMap.get(displayX)[key] = parseFloat(obj[yCol]) || 0;
        });
      });

      return { chartData: Array.from(mergedMap.values()), xKey: '_x', yKeys: yKeysArr, seriesColors: colorsArr };
    }

    /* ── single query ── */
    if (!first?.tables?.[0]) return empty;
    const tbl  = first.tables[0];
    const cols = tbl.columns.map(c => c.name);

    const xCol  = xAxisKeyOpt || cols.find(c => c.toLowerCase().includes('timestamp') || c.toLowerCase().includes('time') || c.toLowerCase().includes('date')) || cols[0];
    const yCols = yAxisKeysOpt || cols.filter(c => c !== xCol);

    // compute span from raw values
    const allRaw = tbl.rows.map(row => {
      const obj = {};
      cols.forEach((col, i) => { obj[col] = row[i]; });
      return obj[xCol];
    });
    const span = getSpanDays(allRaw);

    const data = tbl.rows.map(row => {
      const obj = {};
      cols.forEach((col, i) => {
        let val = row[i];
        if (col === xCol && val) val = formatTimestamp(val, span);
        obj[col] = typeof val === 'number' ? val : (parseFloat(val) || val);
      });
      return obj;
    });

    return { chartData: data, xKey: xCol, yKeys: yCols, seriesColors: SERIES_COLORS };
  }, [queryResults, xAxisKeyOpt, yAxisKeysOpt]);

  if (!chartData.length) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: T.dim, fontSize: 12 }}>
        No data available
      </div>
    );
  }

  const axisStyle = { fill: T.muted, fontSize: 10 };

  const formatY = (val) => {
    if (typeof val !== 'number') return val;
    if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M${unit}`;
    if (val >= 1_000)     return `${(val / 1_000).toFixed(1)}K${unit}`;
    return `${val.toLocaleString(undefined, { maximumFractionDigits: 1 })}${unit}`;
  };

  const renderSeries = () =>
    yKeys.map((key, i) => {
      const color = seriesColors[i % seriesColors.length];
      if (chartType === 'area') {
        return (
          <Area key={key} type={smooth ? 'monotone' : 'linear'} dataKey={key}
            stroke={color} fill={color} fillOpacity={fillOpacity} strokeWidth={2}
            dot={false} activeDot={{ r: 4, strokeWidth: 0 }}
            stackId={stacked ? 'stack' : undefined} />
        );
      }
      if (chartType === 'bar') {
        return (
          <Bar key={key} dataKey={key} fill={color} fillOpacity={0.85}
            radius={[2, 2, 0, 0]} stackId={stacked ? 'stack' : undefined} />
        );
      }
      return (
        <Line key={key} type={smooth ? 'monotone' : 'linear'} dataKey={key}
          stroke={color} strokeWidth={2} dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }} />
      );
    });

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={chartData} margin={{ top: 6, right: 8, left: 0, bottom: 2 }}>
        {showGrid && <CartesianGrid strokeDasharray="0" stroke={T.gridLine} vertical={false} />}
        <XAxis
          dataKey={xKey}
          tick={{ ...axisStyle, fontSize: 9 }}
          axisLine={{ stroke: T.border }}
          tickLine={false}
          interval="preserveStartEnd"
          minTickGap={60}
        />
        <YAxis tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={formatY} width={56} />
        <Tooltip content={<CustomTooltip T={T} />} cursor={{ stroke: T.border2, strokeWidth: 1 }} />
        {showLegend && <Legend wrapperStyle={{ fontSize: 11, color: T.muted, paddingTop: 6 }} />}
        {renderSeries()}
      </ComposedChart>
    </ResponsiveContainer>
  );
};

export default TimeSeriesChart;
