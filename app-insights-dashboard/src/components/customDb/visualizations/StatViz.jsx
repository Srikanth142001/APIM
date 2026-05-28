import React, { useMemo } from 'react';

const StatViz = ({ data, options = {} }) => {
  const {
    columnIndex = 0,
    aggregation = 'last', // last, first, sum, avg, min, max, count
    unit = '',
    decimals = 0,
    colorMode = 'none',
    thresholds = [],
    showSparkline = false,
    showTrend = false
  } = options;

  // Always call all hooks unconditionally — compute even if data is empty
  const statResult = useMemo(() => {
    const empty = { value: null, trend: null };
    if (!data || !data.rows || data.rows.length === 0) return empty;

    const colIdx = Math.min(columnIndex, (data.fields || []).length - 1);
    if (colIdx < 0) return empty;

    const values = data.rows
      .map(row => row[colIdx])
      .filter(v => v !== null && v !== undefined);

    if (values.length === 0) return empty;

    let result;
    switch (aggregation) {
      case 'first':
        result = values[0];
        break;
      case 'sum':
        result = values.reduce((acc, val) => acc + (parseFloat(val) || 0), 0);
        break;
      case 'avg':
        result = values.reduce((acc, val) => acc + (parseFloat(val) || 0), 0) / values.length;
        break;
      case 'min':
        result = Math.min(...values.map(v => parseFloat(v) || 0));
        break;
      case 'max':
        result = Math.max(...values.map(v => parseFloat(v) || 0));
        break;
      case 'count':
        result = values.length;
        break;
      case 'last':
      default:
        result = values[values.length - 1];
        break;
    }

    let trendValue = null;
    if (showTrend && values.length > 1 && aggregation === 'last') {
      const first = parseFloat(values[0]) || 0;
      const last = parseFloat(result) || 0;
      if (first !== 0) {
        trendValue = ((last - first) / first) * 100;
      }
    }

    return { value: result, trend: trendValue };
  }, [data, columnIndex, aggregation, showTrend]);

  const sparklineData = useMemo(() => {
    if (!data || !data.rows || data.rows.length < 2 || !showSparkline) return null;

    const colIdx = Math.min(columnIndex, (data.fields || []).length - 1);
    if (colIdx < 0) return null;

    const values = data.rows.map(row => parseFloat(row[colIdx]) || 0);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    return values.map(v => ((v - min) / range) * 100);
  }, [data, columnIndex, showSparkline]);

  // Early return AFTER all hooks
  if (!data || !data.rows || data.rows.length === 0) {
    return <div className="p-4 text-center text-gray-500 dark:text-gray-400">No data available</div>;
  }

  const { value, trend } = statResult;

  const formatValue = (val) => {
    if (val === null || val === undefined) return 'N/A';
    if (typeof val === 'number') return val.toFixed(decimals);
    return val;
  };

  const getColor = () => {
    if (colorMode === 'none' || !thresholds.length) return 'text-gray-900 dark:text-white';
    const numValue = typeof value === 'number' ? value : parseFloat(value);
    if (isNaN(numValue)) return 'text-gray-900 dark:text-white';
    const sorted = [...thresholds].sort((a, b) => b.value - a.value);
    for (const threshold of sorted) {
      if (numValue >= threshold.value) {
        return `text-${threshold.color}-600 dark:text-${threshold.color}-400`;
      }
    }
    return 'text-gray-900 dark:text-white';
  };

  const getTrendColor = () => {
    if (trend === null) return '';
    if (trend > 0) return 'text-green-600 dark:text-green-400';
    if (trend < 0) return 'text-red-600 dark:text-red-400';
    return 'text-gray-600 dark:text-gray-400';
  };

  const getTrendIcon = () => {
    if (trend === null) return null;
    if (trend > 0) return '↑';
    if (trend < 0) return '↓';
    return '→';
  };

  const renderSparkline = () => {
    if (!sparklineData) return null;
    const width = 120;
    const height = 30;
    const points = sparklineData.map((y, i) => {
      const x = (i / (sparklineData.length - 1)) * width;
      return `${x},${height - (y / 100) * height}`;
    }).join(' ');
    return (
      <svg width={width} height={height} className="mt-2 opacity-60">
        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  };

  const fieldName = data.fields[Math.min(columnIndex, data.fields.length - 1)]?.name || 'Value';

  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <div className={`text-6xl font-bold ${getColor()}`}>
          {formatValue(value)}{unit}
        </div>

        {showTrend && trend !== null && (
          <div className={`text-xl font-semibold mt-2 ${getTrendColor()}`}>
            {getTrendIcon()} {Math.abs(trend).toFixed(1)}%
          </div>
        )}

        <div className="text-lg text-gray-500 dark:text-gray-400 mt-3">
          {fieldName}
          {aggregation !== 'last' && (
            <span className="text-sm ml-2">({aggregation.toUpperCase()})</span>
          )}
        </div>

        {showSparkline && renderSparkline()}

        {data.rows.length > 1 && (
          <div className="text-xs text-gray-400 dark:text-gray-500 mt-2">
            {data.rows.length} data points
          </div>
        )}
      </div>
    </div>
  );
};

export default StatViz;
