import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../../config/apiConfig';
import { useTheme } from '../../context/ThemeContext';
import { FaTimes, FaPlus, FaTrash, FaDatabase, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';

const emptyForm = { id: '', name: '', host: '', port: '5432', database: '', username: '', password: '', ssl: false };

const ConnectionManager = ({ onClose }) => {
  const { T } = useTheme();
  const [connections, setConnections] = useState([]);
  const [showForm,    setShowForm]    = useState(false);
  const [form,        setForm]        = useState(emptyForm);
  const [loading,     setLoading]     = useState(false);
  const [testResult,  setTestResult]  = useState(null); // { ok, msg }

  useEffect(() => { loadConnections(); }, []); // eslint-disable-line

  const loadConnections = async () => {
    try {
      const r = await axios.get(`${API_BASE_URL}/api/custom-db/connections`);
      if (r.data.success) setConnections(r.data.connections);
    } catch (err) { console.error('Failed to load connections:', err); }
  };

  const handleTest = async () => {
    setLoading(true); setTestResult(null);
    try {
      const r = await axios.post(`${API_BASE_URL}/api/custom-db/connections/test`, form);
      setTestResult({ ok: r.data.success, msg: r.data.success ? (r.data.version || 'Connection successful') : r.data.message });
    } catch (err) {
      setTestResult({ ok: false, msg: err.response?.data?.message || err.message });
    } finally { setLoading(false); }
  };

  const handleSave = async () => {
    if (!form.name || !form.host || !form.database || !form.username) {
      setTestResult({ ok: false, msg: 'Name, host, database and username are required' });
      return;
    }
    setLoading(true);
    try {
      await axios.post(`${API_BASE_URL}/api/custom-db/connections`, { ...form, id: form.id || `conn_${Date.now()}` });
      setShowForm(false); setForm(emptyForm); setTestResult(null);
      loadConnections();
    } catch (err) {
      setTestResult({ ok: false, msg: err.response?.data?.message || err.message });
    } finally { setLoading(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this connection?')) return;
    try { await axios.delete(`${API_BASE_URL}/api/custom-db/connections/${id}`); loadConnections(); }
    catch (err) { alert('Failed: ' + (err.response?.data?.message || err.message)); }
  };

  const inp = {
    padding: '7px 12px', fontSize: 12,
    background: T.inputBg, border: `1px solid ${T.border2}`,
    color: T.text, outline: 'none', width: '100%', boxSizing: 'border-box',
  };

  const label = (text, required) => (
    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: T.muted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
      {text}{required && <span style={{ color: T.red, marginLeft: 2 }}>*</span>}
    </label>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div style={{
        background: T.surface, border: `1px solid ${T.border}`,
        width: '100%', maxWidth: 760, maxHeight: '88vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
      }}>
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderBottom: `1px solid ${T.border}`, background: T.panel, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 3, height: 16, background: T.blue, display: 'inline-block' }} />
            <FaDatabase style={{ color: T.blue, fontSize: 13 }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Database Connections</span>
            <span style={{ fontSize: 11, color: T.muted, background: T.panel, border: `1px solid ${T.border2}`, padding: '2px 8px' }}>
              {connections.length} saved
            </span>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: T.muted, cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '2px 4px' }}
            onMouseEnter={e => e.currentTarget.style.color = T.text}
            onMouseLeave={e => e.currentTarget.style.color = T.muted}
          >
            <FaTimes />
          </button>
        </div>

        {/* body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px' }}>
          {!showForm ? (
            <>
              <div style={{ marginBottom: 14 }}>
                <button onClick={() => { setShowForm(true); setForm(emptyForm); setTestResult(null); }}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '6px 14px', fontSize: 11, fontWeight: 600,
                    background: `${T.blue}22`, border: `1px solid ${T.blue}55`,
                    color: T.blue, cursor: 'pointer', transition: 'all 0.12s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = `${T.blue}33`; e.currentTarget.style.borderColor = T.blue; }}
                  onMouseLeave={e => { e.currentTarget.style.background = `${T.blue}22`; e.currentTarget.style.borderColor = `${T.blue}55`; }}
                >
                  <FaPlus style={{ fontSize: 9 }} /> New Connection
                </button>
              </div>

              {connections.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', border: `2px dashed ${T.border2}`, textAlign: 'center' }}>
                  <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.3 }}><FaDatabase /></div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 6 }}>No connections yet</div>
                  <div style={{ fontSize: 12, color: T.muted }}>Add a PostgreSQL connection to get started</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {connections.map(conn => (
                    <div key={conn.id} style={{ background: T.panel, border: `1px solid ${T.border}`, padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{ width: 32, height: 32, background: `${T.blue}18`, border: `1px solid ${T.blue}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <FaDatabase style={{ color: T.blue, fontSize: 13 }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 4 }}>{conn.name}</div>
                        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 11, color: T.muted }}>
                          <span><span style={{ color: T.dim }}>Host:</span> {conn.host}:{conn.port}</span>
                          <span><span style={{ color: T.dim }}>DB:</span> {conn.database}</span>
                          <span><span style={{ color: T.dim }}>User:</span> {conn.username}</span>
                          {conn.ssl && <span style={{ color: T.green }}>SSL</span>}
                        </div>
                        <div style={{ fontSize: 10, color: T.dim, marginTop: 4 }}>
                          Added {new Date(conn.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <button onClick={() => handleDelete(conn.id)}
                        style={{ padding: '5px 6px', background: 'transparent', border: 'none', color: T.dim, cursor: 'pointer', transition: 'color 0.12s', flexShrink: 0 }}
                        onMouseEnter={e => e.currentTarget.style.color = T.red}
                        onMouseLeave={e => e.currentTarget.style.color = T.dim}
                        title="Delete connection"
                      >
                        <FaTrash style={{ fontSize: 12 }} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  {label('Connection Name', true)}
                  <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Production DB" style={inp} />
                </div>
                <div>
                  {label('Host', true)}
                  <input type="text" value={form.host} onChange={e => setForm(p => ({ ...p, host: e.target.value }))} placeholder="localhost or hostname" style={inp} />
                </div>
                <div>
                  {label('Port')}
                  <input type="number" value={form.port} onChange={e => setForm(p => ({ ...p, port: e.target.value }))} style={inp} />
                </div>
                <div>
                  {label('Database', true)}
                  <input type="text" value={form.database} onChange={e => setForm(p => ({ ...p, database: e.target.value }))} placeholder="database_name" style={inp} />
                </div>
                <div>
                  {label('Username', true)}
                  <input type="text" value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))} placeholder="postgres" style={inp} />
                </div>
                <div>
                  {label('Password')}
                  <input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} placeholder="optional — leave blank for passwordless auth" style={inp} />
                </div>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.text, fontSize: 12, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.ssl} onChange={e => setForm(p => ({ ...p, ssl: e.target.checked }))} />
                Use SSL connection
              </label>

              {/* test result */}
              {testResult && (
                <div style={{
                  padding: '10px 14px',
                  background: testResult.ok ? `${T.green}14` : `${T.red}14`,
                  border: `1px solid ${testResult.ok ? T.green + '44' : T.red + '44'}`,
                  display: 'flex', alignItems: 'center', gap: 8, fontSize: 12,
                  color: testResult.ok ? T.green : T.red,
                }}>
                  {testResult.ok
                    ? <FaCheckCircle style={{ flexShrink: 0 }} />
                    : <FaTimesCircle style={{ flexShrink: 0 }} />}
                  {testResult.msg}
                </div>
              )}
            </div>
          )}
        </div>

        {/* footer */}
        {showForm && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 18px', borderTop: `1px solid ${T.border}`, background: T.panel, flexShrink: 0 }}>
            <button onClick={() => { setShowForm(false); setTestResult(null); }}
              style={{ padding: '6px 18px', background: 'transparent', border: `1px solid ${T.border2}`, color: T.muted, fontSize: 12, cursor: 'pointer', transition: 'all 0.12s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = T.text; e.currentTarget.style.color = T.text; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = T.border2; e.currentTarget.style.color = T.muted; }}
            >
              Cancel
            </button>
            <button onClick={handleTest} disabled={loading}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 16px', fontSize: 12, fontWeight: 500,
                background: 'transparent', border: `1px solid ${T.border2}`,
                color: T.muted, cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.12s',
              }}
              onMouseEnter={e => { if (!loading) { e.currentTarget.style.borderColor = T.blue; e.currentTarget.style.color = T.blue; }}}
              onMouseLeave={e => { e.currentTarget.style.borderColor = T.border2; e.currentTarget.style.color = T.muted; }}
            >
              {loading ? '⟳ Testing…' : '🔌 Test Connection'}
            </button>
            <button onClick={handleSave} disabled={loading}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 20px', fontSize: 12, fontWeight: 600,
                background: loading ? T.border : T.green, border: 'none',
                color: '#fff', cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.12s',
              }}
            >
              {loading ? 'Saving…' : '💾 Save Connection'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConnectionManager;
