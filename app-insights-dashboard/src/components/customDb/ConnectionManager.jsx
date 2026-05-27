import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../../config/apiConfig';

const ConnectionManager = ({ onClose }) => {
  const [connections, setConnections] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    host: '',
    port: '5432',
    database: '',
    username: '',
    password: '',
    ssl: false
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadConnections();
  }, []);

  const loadConnections = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/custom-db/connections`);
      if (response.data.success) {
        setConnections(response.data.connections);
      }
    } catch (err) {
      console.error('Failed to load connections:', err);
    }
  };

  const handleTestConnection = async () => {
    setLoading(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/api/custom-db/connections/test`, formData);
      if (response.data.success) {
        alert(`✅ Connection successful!\n\n${response.data.version}`);
      } else {
        alert(`❌ Connection failed:\n\n${response.data.message}`);
      }
    } catch (err) {
      alert(`❌ Connection failed:\n\n${err.response?.data?.message || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConnection = async () => {
    if (!formData.name || !formData.host || !formData.database || !formData.username) {
      alert('Please fill in all required fields (name, host, database, username)');
      return;
    }

    setLoading(true);
    try {
      const connId = formData.id || `conn_${Date.now()}`;
      await axios.post(`${API_BASE_URL}/api/custom-db/connections`, {
        ...formData,
        id: connId
      });
      
      alert('✅ Connection saved successfully!');
      setShowForm(false);
      setFormData({
        id: '',
        name: '',
        host: '',
        port: '5432',
        database: '',
        username: '',
        password: '',
        ssl: false
      });
      loadConnections();
    } catch (err) {
      alert(`❌ Failed to save connection:\n\n${err.response?.data?.message || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteConnection = async (connectionId) => {
    if (!window.confirm('Are you sure you want to delete this connection?')) {
      return;
    }

    try {
      await axios.delete(`${API_BASE_URL}/api/custom-db/connections/${connectionId}`);
      alert('✅ Connection deleted');
      loadConnections();
    } catch (err) {
      alert(`❌ Failed to delete connection:\n\n${err.response?.data?.message || err.message}`);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Database Connections
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {!showForm ? (
            <>
              <button
                onClick={() => setShowForm(true)}
                className="mb-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                + New Connection
              </button>

              {connections.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  No connections yet. Create one to get started.
                </div>
              ) : (
                <div className="space-y-3">
                  {connections.map((conn) => (
                    <div
                      key={conn.id}
                      className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="font-semibold text-gray-900 dark:text-white text-lg">
                            {conn.name}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            <div>Host: {conn.host}:{conn.port}</div>
                            <div>Database: {conn.database}</div>
                            <div>Username: {conn.username}</div>
                            <div className="text-xs mt-1">
                              Created: {new Date(conn.createdAt).toLocaleString()}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteConnection(conn.id)}
                          className="ml-4 px-3 py-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Connection Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Production DB"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Host *
                  </label>
                  <input
                    type="text"
                    value={formData.host}
                    onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="localhost or IP"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Port
                  </label>
                  <input
                    type="number"
                    value={formData.port}
                    onChange={(e) => setFormData({ ...formData, port: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Database *
                  </label>
                  <input
                    type="text"
                    value={formData.database}
                    onChange={(e) => setFormData({ ...formData, database: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="database_name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Username *
                  </label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="postgres"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="••••••••  (optional for passwordless auth)"
                  />
                </div>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.ssl}
                  onChange={(e) => setFormData({ ...formData, ssl: e.target.checked })}
                  className="mr-2"
                />
                <label className="text-sm text-gray-700 dark:text-gray-300">
                  Use SSL Connection
                </label>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleTestConnection}
                  disabled={loading}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition disabled:opacity-50"
                >
                  {loading ? 'Testing...' : '🔌 Test Connection'}
                </button>
                <button
                  onClick={handleSaveConnection}
                  disabled={loading}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                >
                  {loading ? 'Saving...' : '💾 Save Connection'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConnectionManager;
