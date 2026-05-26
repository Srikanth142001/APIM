import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../../config/apiConfig';

const PanelEditor = ({ panel, dashboardId, onClose }) => {
  const [connections, setConnections] = useState([]);
  const [formData, setFormData] = useState({
    title: panel?.title || '',
    description: panel?.description || '',
    connectionId: panel?.connectionId || '',
    query: panel?.query || '',
    visualizationType: panel?.visualizationType || 'table',
    refreshInterval: panel?.refreshInterval || 0,
    position: panel?.position || { x: 0, y: 0, w: 6, h: 4 },
    options: panel?.options || {}
  });
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadConnections();
  }, []);

  const loadConnections = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/custom-db/connections`);
      if (response.data.success) {
        setConnections(response.data.connections);
        if (!formData.connectionId && response.data.connections.length > 0) {
          setFormData(prev => ({ ...prev, connectionId: response.data.connections[0].id }));
        }
      }
    } catch (err) {
      console.error('Failed to load connections:', err);
    }
  };

  const handleTestQuery = async () => {
    if (!formData.connectionId || !formData.query) {
      alert('Please select a connection and enter a query');
      return;
    }

    setTesting(true);
    setError(null);
    setTestResult(null);

    try {
      const response = await axios.post(`${API_BASE_URL}/custom-db/query`, {
        connectionId: formData.connectionId,
        query: formData.query
      });

      if (response.data.success) {
        setTestResult(response.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!formData.title || !formData.connectionId || !formData.query) {
      alert('Please fill in all required fields');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (panel) {
        // Update existing panel
        await axios.put(`${API_BASE_URL}/custom-db/panels/${panel.id}`, formData);
      } else {
        // Create new panel
        await axios.post(`${API_BASE_URL}/custom-db/dashboards/${dashboardId}/panels`, formData);
      }
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {panel ? 'Edit Panel' : 'Add Panel'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Panel Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="My Panel"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Panel description"
            />
          </div>

          {/* Connection & Visualization Type */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Connection *
              </label>
              <select
                value={formData.connectionId}
                onChange={(e) => setFormData({ ...formData, connectionId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Select connection</option>
                {connections.map(conn => (
                  <option key={conn.id} value={conn.id}>{conn.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Visualization Type *
              </label>
              <select
                value={formData.visualizationType}
                onChange={(e) => setFormData({ ...formData, visualizationType: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="table">📊 Table</option>
                <option value="stat">📈 Stat</option>
                <option value="line">📉 Line Chart</option>
                <option value="bar">📊 Bar Chart</option>
                <option value="pie">🥧 Pie Chart</option>
                <option value="gauge">🎯 Gauge</option>
              </select>
            </div>
          </div>

          {/* Query Editor */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              SQL Query *
            </label>
            <textarea
              value={formData.query}
              onChange={(e) => setFormData({ ...formData, query: e.target.value })}
              className="w-full h-48 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm"
              placeholder="SELECT * FROM table_name LIMIT 100;"
            />
            <div className="mt-2 flex gap-2">
              <button
                onClick={handleTestQuery}
                disabled={testing}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
              >
                {testing ? '⏳ Testing...' : '▶ Test Query'}
              </button>
            </div>
          </div>

          {/* Refresh Interval */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Auto-Refresh Interval
            </label>
            <select
              value={formData.refreshInterval}
              onChange={(e) => setFormData({ ...formData, refreshInterval: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="0">Manual (No auto-refresh)</option>
              <option value="10">10 seconds</option>
              <option value="30">30 seconds</option>
              <option value="60">1 minute</option>
              <option value="300">5 minutes</option>
              <option value="900">15 minutes</option>
              <option value="1800">30 minutes</option>
              <option value="3600">1 hour</option>
            </select>
          </div>

          {/* Test Result */}
          {testResult && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <div className="text-sm text-green-800 dark:text-green-300">
                <strong>✅ Query successful!</strong>
                <div className="mt-2">
                  Rows: {testResult.rowCount} | Execution time: {testResult.executionTime}ms
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <div className="text-sm text-red-800 dark:text-red-300">
                <strong>❌ Error:</strong> {error}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
          >
            {saving ? 'Saving...' : '💾 Save Panel'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PanelEditor;
