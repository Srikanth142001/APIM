import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../../config/apiConfig';
import TableViz from './visualizations/TableViz';
import StatViz from './visualizations/StatViz';
import LineChartViz from './visualizations/LineChartViz';
import BarChartViz from './visualizations/BarChartViz';
import PieChartViz from './visualizations/PieChartViz';
import GaugeViz from './visualizations/GaugeViz';

const Panel = ({ panel, onEdit, onDelete, onDuplicate }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const intervalRef = useRef(null);

  const executeQuery = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post(`${API_BASE_URL}/custom-db/panels/${panel.id}/execute`);
      if (response.data.success) {
        setData(response.data);
        setLastUpdate(new Date());
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    executeQuery();

    // Setup auto-refresh
    if (panel.refreshInterval > 0) {
      intervalRef.current = setInterval(executeQuery, panel.refreshInterval * 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [panel.id, panel.refreshInterval, panel.query]);

  const renderVisualization = () => {
    if (loading && !data) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-gray-500 dark:text-gray-400">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <div>Loading...</div>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="p-4">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <span className="text-red-600 dark:text-red-400 text-xl">⚠️</span>
              <div className="text-sm text-red-800 dark:text-red-300">
                <strong>Error:</strong> {error}
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (!data) {
      return <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">No data</div>;
    }

    switch (panel.visualizationType) {
      case 'table':
        return <TableViz data={data} options={panel.options} />;
      case 'stat':
        return <StatViz data={data} options={panel.options} />;
      case 'line':
        return <LineChartViz data={data} options={panel.options} />;
      case 'bar':
        return <BarChartViz data={data} options={panel.options} />;
      case 'pie':
        return <PieChartViz data={data} options={panel.options} />;
      case 'gauge':
        return <GaugeViz data={data} options={panel.options} />;
      default:
        return <div className="p-4 text-gray-500">Unknown visualization type: {panel.visualizationType}</div>;
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg h-full flex flex-col border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="flex justify-between items-center px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white truncate">
            {panel.title}
          </h3>
          {lastUpdate && (
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Updated: {lastUpdate.toLocaleTimeString()}
              {loading && <span className="ml-2 text-blue-600">⟳ Refreshing...</span>}
            </div>
          )}
        </div>
        <div className="flex gap-1 ml-2">
          <button
            onClick={executeQuery}
            disabled={loading}
            className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition disabled:opacity-50"
            title="Refresh"
          >
            <span className={loading ? 'inline-block animate-spin' : ''}>🔄</span>
          </button>
          <button
            onClick={() => onEdit(panel)}
            className="p-1.5 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition"
            title="Edit"
          >
            ✏️
          </button>
          <button
            onClick={() => onDuplicate(panel.id)}
            className="p-1.5 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition"
            title="Duplicate"
          >
            📋
          </button>
          <button
            onClick={() => onDelete(panel.id)}
            className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition"
            title="Delete"
          >
            🗑️
          </button>
        </div>
      </div>

      {/* Visualization */}
      <div className="flex-1 min-h-0 p-2">
        {renderVisualization()}
      </div>
    </div>
  );
};

export default Panel;
