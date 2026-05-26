import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const LineChartViz = ({ data, options = {} }) => {
  if (!data || !data.rows || data.rows.length === 0) {
    return <div className="p-4 text-center text-gray-500 dark:text-gray-400">No data available</div>;
  }

  // Transform data for recharts
  const chartData = data.rows.map(row => {
    const obj = {};
    data.fields.forEach((field, idx) => {
      obj[field.name] = row[idx];
    });
    return obj;
  });

  const { xAxisColumn, yAxisColumns, showGrid = true, showLegend = true } = options;
  const xCol = xAxisColumn || data.fields[0]?.name;
  const yColumns = yAxisColumns || data.fields.slice(1).map(f => f.name);

  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#374151" />}
        <XAxis dataKey={xCol} stroke="#9ca3af" />
        <YAxis stroke="#9ca3af" />
        <Tooltip 
          contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '0.5rem' }}
          labelStyle={{ color: '#f3f4f6' }}
        />
        {showLegend && <Legend />}
        {yColumns.map((col, idx) => (
          <Line 
            key={col} 
            type="monotone" 
            dataKey={col} 
            stroke={colors[idx % colors.length]}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
};

export default LineChartViz;
