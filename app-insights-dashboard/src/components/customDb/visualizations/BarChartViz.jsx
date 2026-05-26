import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const BarChartViz = ({ data, options = {} }) => {
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

  const { categoryColumn, valueColumns, orientation = 'vertical', stacked = false } = options;
  const catCol = categoryColumn || data.fields[0]?.name;
  const valColumns = valueColumns || data.fields.slice(1).map(f => f.name);

  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  const layout = orientation === 'horizontal' ? 'horizontal' : 'vertical';

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart 
        data={chartData} 
        layout={layout}
        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        {layout === 'vertical' ? (
          <>
            <XAxis dataKey={catCol} stroke="#9ca3af" />
            <YAxis stroke="#9ca3af" />
          </>
        ) : (
          <>
            <XAxis type="number" stroke="#9ca3af" />
            <YAxis dataKey={catCol} type="category" stroke="#9ca3af" />
          </>
        )}
        <Tooltip 
          contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '0.5rem' }}
          labelStyle={{ color: '#f3f4f6' }}
        />
        <Legend />
        {valColumns.map((col, idx) => (
          <Bar 
            key={col} 
            dataKey={col} 
            fill={colors[idx % colors.length]}
            stackId={stacked ? 'stack' : undefined}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
};

export default BarChartViz;
