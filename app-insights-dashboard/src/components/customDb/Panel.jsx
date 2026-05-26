import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../../config/apiConfig';
import { useTheme } from '../../context/ThemeContext';
import { FaSync, FaEdit, FaCopy, FaTrash, FaExpand } from 'react-icons/fa';
import TableViz from './visualizations/TableViz';
import StatViz from './visualizations/StatViz';
import LineChartViz from './visualizations/LineChartViz';
import BarChartViz from './visualizations/BarChartViz';
import PieChartViz from './visualizations/PieChartViz';
import GaugeViz from './visualizations/GaugeViz';

const Panel = ({ panel, onEdit, onDelete, onDuplicate }) => {
  const { T } = useTheme();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const intervalRef = useRef(null);

  const executeQuery = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post(`${API_BASE_URL}/api/custom-db/panels/${panel.id}/execute`);
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
    <div style={{ 
      background: T.cardBg, 
      borderRadius: '12px', 
      boxShadow: T.shadow,
      border: `1px solid ${T.border}`,
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      overflow: 'hidden',
      transition: 'all 0.2s'
    }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        padding: '16px 20px', 
        borderBottom: `1px solid ${T.border}`,
        background: T.cardBg
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ 
            fontSize: '15px', 
            fontWeight: 600, 
            color: T.text, 
            margin: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {panel.title}
          </h3>
          {lastUpdate && (
            <div style={{ fontSize: '12px', color: T.dim, marginTop: '4px' }}>
              Updated: {lastUpdate.toLocaleTimeString()}
              {loading && <span style={{ marginLeft: '8px', color: '#667eea' }}>⟳ Refreshing...</span>}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '4px', marginLeft: '12px' }}>
          <button
            onClick={executeQuery}
            disabled={loading}
            style={{
              padding: '8px',
              background: 'transparent',
              border: 'none',
              borderRadius: '6px',
              color: loading ? T.dim : '#667eea',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
              opacity: loading ? 0.5 : 1
            }}
            title="Refresh"
            onMouseOver={(e) => !loading && (e.currentTarget.style.background = T.hoverBg)}
            onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <FaSync style={{ fontSize: '14px', animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          </button>
          <button
            onClick={() => onEdit(panel)}
            style={{
              padding: '8px',
              background: 'transparent',
              border: 'none',
              borderRadius: '6px',
              color: T.dim,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s'
            }}
            title="Edit"
            onMouseOver={(e) => {
              e.currentTarget.style.background = T.hoverBg;
              e.currentTarget.style.color = T.text;
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = T.dim;
            }}
          >
            <FaEdit style={{ fontSize: '14px' }} />
          </button>
          <button
            onClick={() => onDuplicate(panel.id)}
            style={{
              padding: '8px',
              background: 'transparent',
              border: 'none',
              borderRadius: '6px',
              color: T.dim,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s'
            }}
            title="Duplicate"
            onMouseOver={(e) => {
              e.currentTarget.style.background = T.hoverBg;
              e.currentTarget.style.color = T.text;
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = T.dim;
            }}
          >
            <FaCopy style={{ fontSize: '14px' }} />
          </button>
          <button
            onClick={() => onDelete(panel.id)}
            style={{
              padding: '8px',
              background: 'transparent',
              border: 'none',
              borderRadius: '6px',
              color: T.dim,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s'
            }}
            title="Delete"
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
              e.currentTarget.style.color = '#ef4444';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = T.dim;
            }}
          >
            <FaTrash style={{ fontSize: '14px' }} />
          </button>
        </div>
      </div>

      {/* Visualization */}
      <div style={{ flex: 1, minHeight: 0, padding: '16px', overflow: 'auto' }}>
        {renderVisualization()}
      </div>
    </div>
  );
};

// Add keyframes for spin animation
const style = document.createElement('style');
style.textContent = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;
document.head.appendChild(style);

export default Panel;
