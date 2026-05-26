import React from 'react';

const StatViz = ({ data, options = {} }) => {
  if (!data || !data.rows || data.rows.length === 0) {
    return <div className="p-4 text-center text-gray-500 dark:text-gray-400">No data available</div>;
  }

  const value = data.rows[0][0];
  const { unit = '', decimals = 0, colorMode = 'none', thresholds = [] } = options;

  const formatValue = (val) => {
    if (val === null) return 'N/A';
    if (typeof val === 'number') {
      return val.toFixed(decimals);
    }
    return val;
  };

  const getColor = () => {
    if (colorMode === 'none' || !thresholds.length) return 'text-gray-900 dark:text-white';
    
    const numValue = typeof value === 'number' ? value : parseFloat(value);
    if (isNaN(numValue)) return 'text-gray-900 dark:text-white';

    for (let i = thresholds.length - 1; i >= 0; i--) {
      if (numValue >= thresholds[i].value) {
        return `text-${thresholds[i].color}-600`;
      }
    }
    return 'text-gray-900 dark:text-white';
  };

  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <div className={`text-6xl font-bold ${getColor()}`}>
          {formatValue(value)}{unit}
        </div>
        <div className="text-lg text-gray-500 dark:text-gray-400 mt-3">
          {data.fields[0].name}
        </div>
      </div>
    </div>
  );
};

export default StatViz;
