import React from 'react';

const GaugeViz = ({ data, options = {} }) => {
  if (!data || !data.rows || data.rows.length === 0) {
    return <div className="p-4 text-center text-gray-500 dark:text-gray-400">No data available</div>;
  }

  const value = parseFloat(data.rows[0][0]) || 0;
  const { min = 0, max = 100, unit = '%', thresholds = [] } = options;

  const percentage = ((value - min) / (max - min)) * 100;
  const clampedPercentage = Math.max(0, Math.min(100, percentage));

  const getColor = () => {
    if (!thresholds.length) return '#3b82f6';
    
    for (let i = thresholds.length - 1; i >= 0; i--) {
      if (value >= thresholds[i].value) {
        const colorMap = {
          'green': '#10b981',
          'yellow': '#f59e0b',
          'red': '#ef4444',
          'blue': '#3b82f6'
        };
        return colorMap[thresholds[i].color] || '#3b82f6';
      }
    }
    return '#3b82f6';
  };

  const color = getColor();
  const rotation = (clampedPercentage / 100) * 180 - 90;

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <div className="relative" style={{ width: '200px', height: '120px' }}>
        {/* Background arc */}
        <svg width="200" height="120" viewBox="0 0 200 120">
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke="#374151"
            strokeWidth="20"
            strokeLinecap="round"
          />
          {/* Value arc */}
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke={color}
            strokeWidth="20"
            strokeLinecap="round"
            strokeDasharray={`${(clampedPercentage / 100) * 251.2} 251.2`}
          />
          {/* Needle */}
          <line
            x1="100"
            y1="100"
            x2="100"
            y2="30"
            stroke={color}
            strokeWidth="3"
            strokeLinecap="round"
            transform={`rotate(${rotation} 100 100)`}
          />
          {/* Center dot */}
          <circle cx="100" cy="100" r="5" fill={color} />
        </svg>
        
        {/* Value display */}
        <div className="absolute inset-0 flex items-end justify-center pb-2">
          <div className="text-center">
            <div className="text-3xl font-bold text-gray-900 dark:text-white">
              {value.toFixed(1)}{unit}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {min} - {max}
            </div>
          </div>
        </div>
      </div>
      
      <div className="text-sm text-gray-500 dark:text-gray-400 mt-2">
        {data.fields[0].name}
      </div>
    </div>
  );
};

export default GaugeViz;
