import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config/apiConfig';
import Panel from '../components/customDb/Panel';
import ConnectionManager from '../components/customDb/ConnectionManager';
import PanelEditor from '../components/customDb/PanelEditor';

const CustomDbQuery = () => {
  const [dashboards, setDashboards] = useState([]);
  const [selectedDashboard, setSelectedDashboard] = useState('default');
  const [panels, setPanels] = useState([]);
  const [showPanelEditor, setShowPanelEditor] = useState(false);
  const [editingPanel, setEditingPanel] = useState(null);
  const [showConnectionManager, setShowConnectionManager] = useState(false);
  const [showDashboardForm, setShowDashboardForm] = useState(false);
  const [newDashboardName, setNewDashboardName] = useState('');

  useEffect(() => {
    loadDashboards();
  }, []);

  useEffect(() => {
    if (selectedDashboard) {
      loadPanels();
    }
  }, [selectedDashboard]);

  const loadDashboards = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/custom-db/dashboards`);
      if (response.data.success) {
        setDashboards(response.data.dashboards);
      }
    } catch (err) {
      console.error('Failed to load dashboards:', err);
    }
  };

  const loadPanels = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/custom-db/dashboards/${selectedDashboard}/panels`);
      if (response.data.success) {
        setPanels(response.data.panels);
      }
    } catch (err) {
      console.error('Failed to load panels:', err);
    }
  };

  const handleAddPanel = () => {
    setEditingPanel(null);
    setShowPanelEditor(true);
  };

  const handleEditPanel = (panel) => {
    setEditingPanel(panel);
    setShowPanelEditor(true);
  };

  const handleDeletePanel = async (panelId) => {
    if (!window.confirm('Delete this panel?')) return;
    
    try {
      await axios.delete(`${API_BASE_URL}/custom-db/panels/${panelId}`);
      loadPanels();
    } catch (err) {
      alert('Failed to delete panel: ' + err.message);
    }
  };

  const handleDuplicatePanel = async (panelId) => {
    try {
      await axios.post(`${API_BASE_URL}/custom-db/panels/${panelId}/duplicate`);
      loadPanels();
    } catch (err) {
      alert('Failed to duplicate panel: ' + err.message);
    }
  };

  const handleCreateDashboard = async () => {
    if (!newDashboardName.trim()) {
      alert('Please enter a dashboard name');
      return;
    }

    try {
      await axios.post(`${API_BASE_URL}/custom-db/dashboards`, {
        name: newDashboardName,
        description: ''
      });
      setNewDashboardName('');
      setShowDashboardForm(false);
      loadDashboards();
    } catch (err) {
      alert('Failed to create dashboard: ' + err.message);
    }
  };

  const handleDeleteDashboard = async () => {
    if (selectedDashboard === 'default') {
      alert('Cannot delete default dashboard');
      return;
    }

    if (!window.confirm('Delete this dashboard and all its panels?')) return;

    try {
      await axios.delete(`${API_BASE_URL}/custom-db/dashboards/${selectedDashboard}`);
      setSelectedDashboard('default');
      loadDashboards();
    } catch (err) {
      alert('Failed to delete dashboard: ' + err.message);
    }
  };

  const handleExportDashboard = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/custom-db/dashboards/${selectedDashboard}/export`);
      if (response.data.success) {
        const dataStr = JSON.stringify(response.data.data, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `dashboard-${selectedDashboard}-${Date.now()}.json`;
        link.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      alert('Failed to export dashboard: ' + err.message);
    }
  };

  return (
    <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            📊 Custom Database Query
          </h1>
          <select
            value={selectedDashboard}
            onChange={(e) => setSelectedDashboard(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            {dashboards.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowDashboardForm(!showDashboardForm)}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
            title="New Dashboard"
          >
            📁 New Dashboard
          </button>
          <button
            onClick={handleDeleteDashboard}
            disabled={selectedDashboard === 'default'}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50"
            title="Delete Dashboard"
          >
            🗑️
          </button>
          <button
            onClick={handleExportDashboard}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
            title="Export Dashboard"
          >
            📤 Export
          </button>
          <button
            onClick={() => setShowConnectionManager(true)}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
          >
            🔌 Connections
          </button>
          <button
            onClick={handleAddPanel}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            + Add Panel
          </button>
        </div>
      </div>

      {/* New Dashboard Form */}
      {showDashboardForm && (
        <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">Create New Dashboard</h3>
          <div className="flex gap-3">
            <input
              type="text"
              value={newDashboardName}
              onChange={(e) => setNewDashboardName(e.target.value)}
              placeholder="Dashboard name"
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <button
              onClick={handleCreateDashboard}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
            >
              Create
            </button>
            <button
              onClick={() => setShowDashboardForm(false)}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Safety Notice */}
      <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
        <div className="flex items-start gap-2">
          <span className="text-yellow-600 dark:text-yellow-400 text-xl">⚠️</span>
          <div className="text-sm text-yellow-800 dark:text-yellow-300">
            <strong>Safety Features Active:</strong> Read-only connections • Query validation • 30s timeout • Connection pooling • No database locking
          </div>
        </div>
      </div>

      {/* Panels Grid */}
      {panels.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-6xl mb-4">📊</div>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
            No panels yet
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Create your first panel to start visualizing data
          </p>
          <button
            onClick={handleAddPanel}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-lg"
          >
            + Add Your First Panel
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-4">
          {panels.map(panel => {
            const colSpan = Math.min(12, Math.max(1, panel.position.w));
            const height = Math.max(200, panel.position.h * 150);
            
            return (
              <div
                key={panel.id}
                className={`col-span-${colSpan}`}
                style={{ minHeight: `${height}px` }}
              >
                <Panel
                  panel={panel}
                  onEdit={handleEditPanel}
                  onDelete={handleDeletePanel}
                  onDuplicate={handleDuplicatePanel}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {showPanelEditor && (
        <PanelEditor
          panel={editingPanel}
          dashboardId={selectedDashboard}
          onClose={() => {
            setShowPanelEditor(false);
            loadPanels();
          }}
        />
      )}

      {showConnectionManager && (
        <ConnectionManager
          onClose={() => setShowConnectionManager(false)}
        />
      )}
    </div>
  );
};

export default CustomDbQuery;
