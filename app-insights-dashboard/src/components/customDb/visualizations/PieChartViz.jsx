import React from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const PieChartViz = ({ data, options = {} }) => {
  if (!data || !data.rows || data.rows.length === 0) {
    return <div className="p-4 text-center text-gray-500 dark:text-gray-400">No data available</div>;
  }

  const { nameColumn, valueColumn, showPercentage = true, donutMode = false } = options;
  const nameCol = nameColumn || data.fields[0]?.name;
  const valueCol = valueColumn || data.fields[1]?.name;

  const nameIdx = data.fields.findIndex(f => f.name === nameCol);
  const valueIdx = data.fields.findIndex(f => f.name === valueCol);

  const chartData = data.rows.map(row => ({
    name: String(row[nameIdx]),
    value: parseFloat(row[valueIdx]) || 0
  }));

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

  const renderLabel = (entry) => {
    if (!showPercentage) return entry.name;
    const percent = ((entry.value / chartData.reduce((sum, item) => sum + item.value, 0)) * 100).toFixed(1);
    return `${entry.name} (${percent}%)`;
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={renderLabel}
          outerRadius={donutMode ? 100 : 120}
          innerRadius={donutMode ? 60 : 0}
          fill="#8884d8"
          dataKey="value"
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip 
          contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '0.5rem' }}
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
};

export default PieChartViz;
