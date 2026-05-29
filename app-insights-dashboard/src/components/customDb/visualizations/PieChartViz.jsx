import { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useTheme } from '../../../context/ThemeContext';

const COLORS = [
  '#5794f2', '#73bf69', '#f2cc0c', '#ff780a', '#f2495c',
  '#b877d9', '#fade2a', '#37872d', '#c4162a', '#8ab8ff',
];

const CustomTooltip = ({ active, payload, T }) => {
  if (!active || !payload?.length) return null;
  const { name, value, percent } = payload[0];
  return (
    <div style={{
      background: T.surface, border: `1px solid ${T.border2}`,
      padding: '8px 12px', fontSize: 11, lineHeight: 1.8,
      boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
    }}>
      <div style={{ fontWeight: 600, color: T.text, marginBottom: 3 }}>{name}</div>
      <div style={{ color: T.muted }}>
        Value: <span style={{ color: payload[0].fill, fontWeight: 600 }}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </span>
      </div>
      <div style={{ color: T.muted }}>
        Share: <span style={{ color: T.text, fontWeight: 600 }}>
          {(percent * 100).toFixed(1)}%
        </span>
      </div>
    </div>
  );
};

const PieChartViz = ({ data, options = {} }) => {
  const { T } = useTheme();

  const { donutMode = false } = options;

  const chartData = useMemo(() => {
    if (!data?.rows?.length || !data?.fields?.length) return [];

    // Auto-detect: first non-numeric column = name, first numeric column = value
    const fields = data.fields;
    let nameIdx = -1;
    let valueIdx = -1;

    // Try to find a string column for name and numeric for value
    for (let i = 0; i < fields.length; i++) {
      const sample = data.rows[0]?.[i];
      if (nameIdx === -1 && (typeof sample === 'string' || isNaN(parseFloat(sample)))) {
        nameIdx = i;
      } else if (valueIdx === -1 && typeof parseFloat(sample) === 'number' && !isNaN(parseFloat(sample))) {
        valueIdx = i;
      }
    }

    // Fallback: first col = name, second = value
    if (nameIdx === -1) nameIdx = 0;
    if (valueIdx === -1) valueIdx = fields.length > 1 ? 1 : 0;

    return data.rows
      .map(row => ({
        name: String(row[nameIdx] ?? ''),
        value: parseFloat(row[valueIdx]) || 0,
      }))
      .filter(d => d.value > 0);
  }, [data]);

  if (!chartData.length) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: T.dim, fontSize: 12 }}>
        No data available
      </div>
    );
  }

  const total = chartData.reduce((s, d) => s + d.value, 0);

  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }) => {
    // Only show label if slice is big enough (>8%)
    if (percent < 0.08) return null;
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.55;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return (
      <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central"
        style={{ fontSize: 11, fontWeight: 600, pointerEvents: 'none' }}>
        {(percent * 100).toFixed(0)}%
      </text>
    );
  };

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <ResponsiveContainer width="100%" height="75%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={renderCustomLabel}
            outerRadius="80%"
            innerRadius={donutMode ? '45%' : 0}
            dataKey="value"
            strokeWidth={2}
            stroke={T.chartBg}
          >
            {chartData.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip T={T} />} />
        </PieChart>
      </ResponsiveContainer>

      {/* Custom legend below chart */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: '6px 16px',
        justifyContent: 'center', padding: '4px 12px',
        overflowY: 'auto', maxHeight: '25%',
      }}>
        {chartData.map((entry, i) => {
          const pct = total > 0 ? ((entry.value / total) * 100).toFixed(1) : '0';
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: T.muted }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: COLORS[i % COLORS.length], flexShrink: 0 }} />
              <span style={{ color: T.text }}>{entry.name}</span>
              <span style={{ color: T.dim }}>({pct}%)</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PieChartViz;
