import { useState, useEffect } from "react";
import axios from "axios";
import { API_ENDPOINTS } from "../config/apiConfig";
import { useTheme } from "../context/ThemeContext";
import { FaPlus, FaTrash, FaCheck, FaTimes, FaSync, FaSearch, FaSave } from "react-icons/fa";

export default function Setup() {
  const { T } = useTheme();
  const [environments, setEnvironments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEnv, setSelectedEnv] = useState(null);
  const [form, setForm] = useState({
    name: "",
    type: "production",
    tenantId: "",
    subscriptionId: "",
    resourceGroup: "",
    appInsightsAppId: "",
    appInsightsApiKey: "",
    clientId: "",
    clientSecret: "",
    aksClusterName: "",
    mysqlServerName: "",
    logAnalyticsWorkspaceId: "",
  });
  const [testResults, setTestResults] = useState(null);
  const [testing, setTesting] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchEnvironments();
  }, []);

  const fetchEnvironments = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(API_ENDPOINTS.environments);
      setEnvironments(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleNew = () => {
    setSelectedEnv(null);
    setForm({
      name: "",
      type: "production",
      tenantId: "",
      subscriptionId: "",
      resourceGroup: "",
      appInsightsAppId: "",
      appInsightsApiKey: "",
      clientId: "",
      clientSecret: "",
      aksClusterName: "",
      mysqlServerName: "",
      logAnalyticsWorkspaceId: "",
    });
    setTestResults(null);
  };

  const handleEdit = (env) => {
    setSelectedEnv(env);
    setForm({
      name: env.name,
      type: env.type,
      tenantId: env.tenantId || "",
      subscriptionId: env.subscriptionId,
      resourceGroup: env.resourceGroup,
      appInsightsAppId: env.appInsightsAppId,
      appInsightsApiKey: env.appInsightsApiKey,
      clientId: env.clientId || "",
      clientSecret: env.clientSecret || "",
      aksClusterName: env.aksClusterName || "",
      mysqlServerName: env.mysqlServerName || "",
      logAnalyticsWorkspaceId: env.logAnalyticsWorkspaceId || "",
    });
    setTestResults(null);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this environment?")) return;
    try {
      await axios.delete(`${API_ENDPOINTS.environments}/${id}`);
      fetchEnvironments();
      if (selectedEnv?.id === id) handleNew();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to delete");
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResults(null);
    try {
      const { data } = await axios.post(API_ENDPOINTS.testConnection, form);
      setTestResults(data);
    } catch (err) {
      setTestResults({ error: err.response?.data?.error || err.message });
    } finally {
      setTesting(false);
    }
  };

  const handleDiscover = async () => {
    setDiscovering(true);
    try {
      const { data } = await axios.post(API_ENDPOINTS.discoverResources, form);
      if (data.discovered) {
        setForm((prev) => ({
          ...prev,
          aksClusterName: data.discovered.aksClusterName || prev.aksClusterName,
          mysqlServerName: data.discovered.mysqlServerName || prev.mysqlServerName,
          logAnalyticsWorkspaceId: data.discovered.logAnalyticsWorkspaceId || prev.logAnalyticsWorkspaceId,
        }));
        alert(`Discovered ${data.resourceCount} resources`);
      }
    } catch (err) {
      alert(err.response?.data?.error || "Discovery failed");
    } finally {
      setDiscovering(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (selectedEnv) {
        await axios.put(`${API_ENDPOINTS.environments}/${selectedEnv.id}`, form);
      } else {
        await axios.post(API_ENDPOINTS.environments, form);
      }
      fetchEnvironments();
      handleNew();
      alert("Environment saved successfully");
    } catch (err) {
      alert(err.response?.data?.error || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    width: "100%",
    boxSizing: "border-box",
    background: T.inputBg,
    border: `1px solid ${T.border2}`,
    borderRadius: 4,
    color: T.text,
    fontSize: 13,
    padding: "8px 10px",
    outline: "none",
    transition: "border-color 0.15s",
  };

  return (
    <div style={{ background: T.bg, minHeight: "100vh", padding: "16px", color: T.text }}>
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, color: T.text }}>
          Environment Configuration
        </h1>

        <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 16 }}>
          {/* Left: Environment List */}
          <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 4, padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: T.textSub, textTransform: "uppercase" }}>
                Environments
              </span>
              <button
                onClick={handleNew}
                className="gf-btn gf-btn-primary"
                style={{ fontSize: 11, padding: "4px 10px" }}
              >
                <FaPlus style={{ fontSize: 10 }} /> New
              </button>
            </div>

            {loading ? (
              <div className="gf-skeleton" style={{ height: 40, marginBottom: 8 }} />
            ) : environments.length === 0 ? (
              <div style={{ fontSize: 12, color: T.muted, textAlign: "center", padding: "20px 0" }}>
                No environments configured
              </div>
            ) : (
              environments.map((env) => (
                <div
                  key={env.id}
                  onClick={() => handleEdit(env)}
                  style={{
                    padding: "10px 12px",
                    marginBottom: 6,
                    background: selectedEnv?.id === env.id ? T.surface : "transparent",
                    border: `1px solid ${selectedEnv?.id === env.id ? T.blue : T.border}`,
                    borderRadius: 4,
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    if (selectedEnv?.id !== env.id) e.currentTarget.style.background = T.surface;
                  }}
                  onMouseLeave={(e) => {
                    if (selectedEnv?.id !== env.id) e.currentTarget.style.background = "transparent";
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{env.name}</div>
                      <div style={{ fontSize: 10, color: T.muted, marginTop: 2 }}>
                        <span
                          className={`gf-badge ${
                            env.type === "production"
                              ? "gf-badge-red"
                              : env.type === "staging"
                              ? "gf-badge-yellow"
                              : "gf-badge-blue"
                          }`}
                          style={{ fontSize: 9, padding: "1px 6px" }}
                        >
                          {env.type}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(env.id);
                      }}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: T.red,
                        cursor: "pointer",
                        fontSize: 12,
                        padding: 4,
                      }}
                      title="Delete"
                    >
                      <FaTrash />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Right: Form */}
          <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 4, padding: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: T.text }}>
              {selectedEnv ? `Edit: ${selectedEnv.name}` : "Add New Environment"}
            </h2>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {/* Name */}
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: T.textSub, marginBottom: 4 }}>
                  Environment Name *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Production"
                  style={inputStyle}
                />
              </div>

              {/* Type */}
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: T.textSub, marginBottom: 4 }}>
                  Environment Type
                </label>
                <div style={{ display: "flex", gap: 6 }}>
                  {["development", "staging", "production"].map((type) => (
                    <button
                      key={type}
                      onClick={() => setForm({ ...form, type })}
                      className={`gf-badge ${
                        form.type === type
                          ? type === "production"
                            ? "gf-badge-red"
                            : type === "staging"
                            ? "gf-badge-yellow"
                            : "gf-badge-blue"
                          : "gf-badge-gray"
                      }`}
                      style={{ cursor: "pointer", textTransform: "capitalize" }}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <hr style={{ border: "none", borderTop: `1px solid ${T.border}`, margin: "16px 0" }} />

            <h3 style={{ fontSize: 13, fontWeight: 700, color: T.textSub, marginBottom: 12 }}>
              Azure Identity
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: T.textSub, marginBottom: 4 }}>
                  Tenant ID
                </label>
                <input
                  type="text"
                  value={form.tenantId}
                  onChange={(e) => setForm({ ...form, tenantId: e.target.value })}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: T.textSub, marginBottom: 4 }}>
                  Subscription ID *
                </label>
                <input
                  type="text"
                  value={form.subscriptionId}
                  onChange={(e) => setForm({ ...form, subscriptionId: e.target.value })}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: T.textSub, marginBottom: 4 }}>
                  Resource Group *
                </label>
                <input
                  type="text"
                  value={form.resourceGroup}
                  onChange={(e) => setForm({ ...form, resourceGroup: e.target.value })}
                  placeholder="my-resource-group"
                  style={inputStyle}
                />
              </div>
            </div>

            <hr style={{ border: "none", borderTop: `1px solid ${T.border}`, margin: "16px 0" }} />

            <h3 style={{ fontSize: 13, fontWeight: 700, color: T.textSub, marginBottom: 12 }}>
              App Insights
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: T.textSub, marginBottom: 4 }}>
                  App Insights App ID *
                </label>
                <input
                  type="text"
                  value={form.appInsightsAppId}
                  onChange={(e) => setForm({ ...form, appInsightsAppId: e.target.value })}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: T.textSub, marginBottom: 4 }}>
                  App Insights API Key *
                </label>
                <input
                  type="password"
                  value={form.appInsightsApiKey}
                  onChange={(e) => setForm({ ...form, appInsightsApiKey: e.target.value })}
                  placeholder="••••••••••••••••"
                  style={inputStyle}
                />
              </div>
            </div>

            <hr style={{ border: "none", borderTop: `1px solid ${T.border}`, margin: "16px 0" }} />

            <h3 style={{ fontSize: 13, fontWeight: 700, color: T.textSub, marginBottom: 12 }}>
              Service Principal (Optional — for AKS/MySQL/Log Analytics)
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: T.textSub, marginBottom: 4 }}>
                  Client ID
                </label>
                <input
                  type="text"
                  value={form.clientId}
                  onChange={(e) => setForm({ ...form, clientId: e.target.value })}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: T.textSub, marginBottom: 4 }}>
                  Client Secret
                </label>
                <input
                  type="password"
                  value={form.clientSecret}
                  onChange={(e) => setForm({ ...form, clientSecret: e.target.value })}
                  placeholder="••••••••••••••••"
                  style={inputStyle}
                />
              </div>
            </div>

            <hr style={{ border: "none", borderTop: `1px solid ${T.border}`, margin: "16px 0" }} />

            <h3 style={{ fontSize: 13, fontWeight: 700, color: T.textSub, marginBottom: 12 }}>
              Optional Resources (Auto-discovered)
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: T.textSub, marginBottom: 4 }}>
                  AKS Cluster Name
                </label>
                <input
                  type="text"
                  value={form.aksClusterName}
                  onChange={(e) => setForm({ ...form, aksClusterName: e.target.value })}
                  placeholder="Auto-filled"
                  style={inputStyle}
                  readOnly
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: T.textSub, marginBottom: 4 }}>
                  MySQL Server Name
                </label>
                <input
                  type="text"
                  value={form.mysqlServerName}
                  onChange={(e) => setForm({ ...form, mysqlServerName: e.target.value })}
                  placeholder="Auto-filled"
                  style={inputStyle}
                  readOnly
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: T.textSub, marginBottom: 4 }}>
                  Log Analytics Workspace ID
                </label>
                <input
                  type="text"
                  value={form.logAnalyticsWorkspaceId}
                  onChange={(e) => setForm({ ...form, logAnalyticsWorkspaceId: e.target.value })}
                  placeholder="Auto-filled"
                  style={inputStyle}
                  readOnly
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
              <button
                onClick={handleTest}
                disabled={testing || !form.appInsightsAppId || !form.appInsightsApiKey}
                className="gf-btn gf-btn-secondary"
              >
                {testing ? <FaSync className="spin" /> : <FaSearch />} Test Connection
              </button>
              <button
                onClick={handleDiscover}
                disabled={discovering || !form.tenantId || !form.clientId || !form.clientSecret}
                className="gf-btn gf-btn-secondary"
              >
                {discovering ? <FaSync className="spin" /> : <FaSearch />} Discover Resources
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name || !form.subscriptionId || !form.resourceGroup || !form.appInsightsAppId || !form.appInsightsApiKey}
                className="gf-btn gf-btn-primary"
              >
                {saving ? <FaSync className="spin" /> : <FaSave />} Save Environment
              </button>
            </div>

            {/* Test Results */}
            {testResults && (
              <div style={{ marginTop: 16, padding: 12, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 4 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: T.textSub, marginBottom: 8 }}>
                  Connection Test Results
                </div>
                {testResults.error ? (
                  <div style={{ fontSize: 12, color: T.red }}>❌ {testResults.error}</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                      {testResults.appInsights === "ok" ? (
                        <FaCheck style={{ color: T.green }} />
                      ) : (
                        <FaTimes style={{ color: T.red }} />
                      )}
                      <span style={{ color: T.text }}>App Insights:</span>
                      <span style={{ color: testResults.appInsights === "ok" ? T.green : T.red }}>
                        {testResults.appInsights === "ok" ? "Connected" : testResults.errors?.appInsights || "Error"}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                      {testResults.azureMonitor === "ok" ? (
                        <FaCheck style={{ color: T.green }} />
                      ) : (
                        <FaTimes style={{ color: T.red }} />
                      )}
                      <span style={{ color: T.text }}>Azure Monitor:</span>
                      <span style={{ color: testResults.azureMonitor === "ok" ? T.green : T.red }}>
                        {testResults.azureMonitor === "ok" ? "Connected" : testResults.errors?.azureMonitor || "Error"}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                      {testResults.logAnalytics === "ok" ? (
                        <FaCheck style={{ color: T.green }} />
                      ) : (
                        <FaTimes style={{ color: T.red }} />
                      )}
                      <span style={{ color: T.text }}>Log Analytics:</span>
                      <span style={{ color: testResults.logAnalytics === "ok" ? T.green : T.red }}>
                        {testResults.logAnalytics === "ok" ? "Connected" : testResults.errors?.logAnalytics || "Error"}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`.spin { animation: spin 1s linear infinite; }`}</style>
    </div>
  );
}
