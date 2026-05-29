import { useMemo } from 'react';
import { useTheme } from '../../../context/ThemeContext';

const StatViz = ({ data, options = {} }) => {
  const { T } = useTheme();
  const {
    columnIndex = 0,
    aggregation = 'last',
    unit = '',
    decimals = 0,
    showSparkline = false,
    showTrend = false,
    // Color coding: thresholds = [{value: 80, color: 'red'}, {value: 50, color: 'orange'}]
    // colorMode: 'none' | 'threshold' | 'fixed'
    colorMode = 'none',
    fixedColor = '',
    thresholds = [],  // [{value, color}] sorted desc
  } = options;

  const { value, trend, sparkline, fieldName } = useMemo(() => {
    const empty = { value: null, trend: null, sparkline: null, fieldName: 'Value' };
    if (!data?.rows?.length || !data?.fields?.length) return empty;

    const colIdx = Math.min(columnIndex, data.fields.length - 1);
    const fname  = data.fields[colIdx]?.name || 'Value';
    const rawVals = data.rows.map(r => r[colIdx]).filter(v => v !== null && v !== undefined);
    // Parse string numbers (PostgreSQL returns bigint/numeric as strings)
    const nums    = rawVals.map(v => parseFloat(v)).filter(v => !isNaN(v));
    if (!nums.length) return { ...empty, fieldName: fname };

    let result;
    switch (aggregation) {
      case 'first': result = nums[0]; break;
      case 'sum':   result = nums.reduce((a, b) => a + b, 0); break;
      case 'avg':   result = nums.reduce((a, b) => a + b, 0) / nums.length; break;
      case 'min':   result = Math.min(...nums); break;
      case 'max':   result = Math.max(...nums); break;
      case 'count': result = nums.length; break;
      default:      result = nums[nums.length - 1]; break;
    }

    let trendVal = null;
    if (showTrend && nums.length > 1) {
      const first = nums[0], last = nums[nums.length - 1];
      if (first !== 0) trendVal = ((last - first) / Math.abs(first)) * 100;
    }

    let sparkData = null;
    if (showSparkline && nums.length >= 2) {
      const mn = Math.min(...nums), mx = Math.max(...nums), rng = mx - mn || 1;
      sparkData = nums.map(v => ((v - mn) / rng) * 100);
    }

    return { value: result, trend: trendVal, sparkline: sparkData, fieldName: fname };
  }, [data, columnIndex, aggregation, showTrend, showSparkline]);

  if (value === null) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: T.dim, fontSize: 12 }}>No data</div>;
  }

  const display = typeof value === 'number' ? value.toFixed(decimals) : String(value);
  const trendUp = trend !== null && trend > 0;
  const trendColor = trend === null ? T.muted : trendUp ? T.green : T.red;

  // Determine value color based on colorMode
  const getValueColor = () => {
    if (colorMode === 'fixed' && fixedColor) return fixedColor;
    if (colorMode === 'threshold' && thresholds.length > 0 && typeof value === 'number') {
      const sorted = [...thresholds].sort((a, b) => b.value - a.value);
      for (const t of sorted) {
        if (value >= parseFloat(t.value)) {
          const colorMap = { red: T.red, orange: T.orange, green: T.green, blue: T.blue, yellow: T.orange };
          return colorMap[t.color] || t.color;
        }
      }
    }
    return T.blue;
  };
  const valueColor = getValueColor();

  const renderSparkline = () => {
    if (!sparkline) return null;
    const W = 140, H = 36;
    const pts = sparkline.map((y, i) => {
      const x = (i / (sparkline.length - 1)) * W;
      return `${x},${H - (y / 100) * (H - 4) - 2}`;
    }).join(' ');
    return (
      <svg width={W} height={H} style={{ marginTop: 8, opacity: 0.7 }}>
        <defs>
          <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={T.blue} stopOpacity={0.3} />
            <stop offset="100%" stopColor={T.blue} stopOpacity={0} />
          </linearGradient>
        </defs>
        <polyline points={pts} fill="none" stroke={T.blue} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <div style={{ textAlign: 'center' }}>
        {/* Big value */}
        <div style={{
          fontSize: 52, fontWeight: 700, color: valueColor,
          fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', lineHeight: 1,
        }}>
          {display}
          {unit && <span style={{ fontSize: 24, fontWeight: 400, color: T.muted, marginLeft: 4 }}>{unit}</span>}
        </div>

        {/* Trend */}
        {trend !== null && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 8 }}>
            <span style={{ fontSize: 18, color: trendColor }}>{trendUp ? '↑' : '↓'}</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: trendColor }}>{Math.abs(trend).toFixed(1)}%</span>
          </div>
        )}

        {/* Field name + aggregation */}
        <div style={{ fontSize: 13, color: T.muted, marginTop: 10 }}>
          {fieldName}
          {aggregation !== 'last' && (
            <span style={{ fontSize: 10, color: T.dim, marginLeft: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>({aggregation})</span>
          )}
        </div>

        {/* Sparkline */}
        {renderSparkline()}

        {/* Row count */}
        {data.rows.length > 1 && (
          <div style={{ fontSize: 10, color: T.dim, marginTop: 6 }}>{data.rows.length} data points</div>
        )}
      </div>
    </div>
  );
};

export default StatViz;
