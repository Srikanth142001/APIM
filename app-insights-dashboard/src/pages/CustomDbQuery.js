import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config/apiConfig';
import Panel from '../components/customDb/Panel';
import ConnectionManager from '../components/customDb/ConnectionManager';
import PanelEditor from '../components/customDb/PanelEditor';
import { useTheme } from '../context/ThemeContext';
import { FaDatabase, FaPlus, FaDownload, FaTrash, FaCog, FaChartBar } from 'react-icons/fa';

const CustomDbQuery = () => {
  const { T } = useTheme();
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
      const response = await axios.get(`${API_BASE_URL}/api/custom-db/dashboards`);
      if (response.data.success) {
        setDashboards(response.data.dashboards);
      }
    } catch (err) {
      console.error('Failed to load dashboards:', err);
    }
  };

  const loadPanels = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/custom-db/dashboards/${selectedDashboard}/panels`);
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
      await axios.delete(`${API_BASE_URL}/api/custom-db/panels/${panelId}`);
      loadPanels();
    } catch (err) {
      alert('Failed to delete panel: ' + err.message);
    }
  };

  const handleDuplicatePanel = async (panelId) => {
    try {
      await axios.post(`${API_BASE_URL}/api/custom-db/panels/${panelId}/duplicate`);
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
      await axios.post(`${API_BASE_URL}/api/custom-db/dashboards`, {
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
      await axios.delete(`${API_BASE_URL}/api/custom-db/dashboards/${selectedDashboard}`);
      setSelectedDashboard('default');
      loadDashboards();
    } catch (err) {
      alert('Failed to delete dashboard: ' + err.message);
    }
  };

  const handleExportDashboard = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/custom-db/dashboards/${selectedDashboard}/export`);
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
    <div style={{ minHeight: '100vh', background: T.bg, color: T.text }}>
      {/* Header */}
      <div style={{ 
        background: T.cardBg, 
        borderBottom: `1px solid ${T.border}`,
        padding: '20px 32px',
        position: 'sticky',
        top: 0,
        zIndex: 10,
        backdropFilter: 'blur(10px)',
        backgroundColor: T.cardBg + 'f0'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '1600px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <FaDatabase style={{ fontSize: '24px', color: T.primary }} />
              <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0, color: T.text }}>
                Custom Database Query
              </h1>
            </div>
            <select
              value={selectedDashboard}
              onChange={(e) => setSelectedDashboard(e.target.value)}
              style={{
                padding: '8px 16px',
                border: `1px solid ${T.border}`,
                borderRadius: '8px',
                background: T.inputBg,
                color: T.text,
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
                outline: 'none',
                minWidth: '200px'
              }}
            >
              {dashboards.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setShowDashboardForm(!showDashboardForm)}
              style={{
                padding: '10px 16px',
                background: T.cardBg,
                border: `1px solid ${T.border}`,
                borderRadius: '8px',
                color: T.text,
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.background = T.hoverBg}
              onMouseOut={(e) => e.currentTarget.style.background = T.cardBg}
            >
              <FaPlus /> New Dashboard
            </button>
            
            {selectedDashboard !== 'default' && (
              <button
                onClick={handleDeleteDashboard}
                style={{
                  padding: '10px 16px',
                  background: T.cardBg,
                  border: `1px solid ${T.border}`,
                  borderRadius: '8px',
                  color: '#ef4444',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = T.hoverBg}
                onMouseOut={(e) => e.currentTarget.style.background = T.cardBg}
              >
                <FaTrash />
              </button>
            )}
            
            <button
              onClick={handleExportDashboard}
              style={{
                padding: '10px 16px',
                background: T.cardBg,
                border: `1px solid ${T.border}`,
                borderRadius: '8px',
                color: T.text,
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.background = T.hoverBg}
              onMouseOut={(e) => e.currentTarget.style.background = T.cardBg}
            >
              <FaDownload /> Export
            </button>
            
            <button
              onClick={() => setShowConnectionManager(true)}
              style={{
                padding: '10px 16px',
                background: T.cardBg,
                border: `1px solid ${T.border}`,
                borderRadius: '8px',
                color: T.text,
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.background = T.hoverBg}
              onMouseOut={(e) => e.currentTarget.style.background = T.cardBg}
            >
              <FaCog /> Connections
            </button>
            
            <button
              onClick={handleAddPanel}
              style={{
                padding: '10px 20px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: 'none',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s',
                boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
              }}
              onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <FaPlus /> Add Panel
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '1600px', margin: '0 auto', padding: '24px 32px' }}>
        {/* New Dashboard Form */}
        {showDashboardForm && (
          <div style={{ 
            marginBottom: '24px', 
            padding: '20px', 
            background: T.cardBg, 
            borderRadius: '12px', 
            border: `1px solid ${T.border}`,
            boxShadow: T.shadow
          }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px', color: T.text }}>
              Create New Dashboard
            </h3>
            <div style={{ display: 'flex', gap: '12px' }}>
              <input
                type="text"
                value={newDashboardName}
                onChange={(e) => setNewDashboardName(e.target.value)}
                placeholder="Dashboard name"
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  border: `1px solid ${T.border}`,
                  borderRadius: '8px',
                  background: T.inputBg,
                  color: T.text,
                  fontSize: '14px',
                  outline: 'none'
                }}
              />
              <button
                onClick={handleCreateDashboard}
                style={{
                  padding: '10px 24px',
                  background: '#10b981',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                Create
              </button>
              <button
                onClick={() => setShowDashboardForm(false)}
                style={{
                  padding: '10px 24px',
                  background: T.cardBg,
                  border: `1px solid ${T.border}`,
                  borderRadius: '8px',
                  color: T.text,
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Safety Notice */}
        <div style={{ 
          marginBottom: '24px', 
          padding: '16px 20px', 
          background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.1) 0%, rgba(245, 158, 11, 0.1) 100%)',
          border: '1px solid rgba(251, 191, 36, 0.3)',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'start',
          gap: '12px'
        }}>
          <span style={{ fontSize: '20px' }}>🛡️</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#f59e0b', marginBottom: '4px' }}>
              Safety Features Active
            </div>
            <div style={{ fontSize: '13px', color: T.dim, lineHeight: '1.5' }}>
              Read-only connections • Query validation • 30s timeout • Connection pooling • No database locking
            </div>
          </div>
        </div>

        {/* Panels Grid */}
        {panels.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '80px 20px',
            background: T.cardBg,
            borderRadius: '16px',
            border: `2px dashed ${T.border}`
          }}>
            <div style={{ 
              width: '120px',
              height: '120px',
              margin: '0 auto 24px',
              background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <FaChartBar style={{ fontSize: '48px', color: T.primary }} />
            </div>
            <h2 style={{ fontSize: '24px', fontWeight: 700, color: T.text, marginBottom: '8px' }}>
              No panels yet
            </h2>
            <p style={{ fontSize: '15px', color: T.dim, marginBottom: '24px', maxWidth: '400px', margin: '0 auto 24px' }}>
              Create your first panel to start visualizing data from your PostgreSQL databases
            </p>
            <button
              onClick={handleAddPanel}
              style={{
                padding: '14px 32px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: 'none',
                borderRadius: '10px',
                color: '#fff',
                fontSize: '15px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '10px',
                transition: 'all 0.2s',
                boxShadow: '0 8px 20px rgba(102, 126, 234, 0.3)'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 12px 28px rgba(102, 126, 234, 0.4)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 8px 20px rgba(102, 126, 234, 0.3)';
              }}
            >
              <FaPlus /> Add Your First Panel
            </button>
          </div>
        ) : (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(500px, 1fr))',
            gap: '20px'
          }}>
            {panels.map(panel => {
              const height = Math.max(300, panel.position.h * 150);
              
              return (
                <div
                  key={panel.id}
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
      </div>

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
