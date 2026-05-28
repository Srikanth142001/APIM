import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config/apiConfig';
import { useTheme } from '../context/ThemeContext';
import KqlPanel from '../components/kql/KqlPanel';
import KqlPanelEditor from '../components/kql/KqlPanelEditor';
import PanelGrid from '../components/shared/PanelGrid';
import {
  FaPlus, FaTrash, FaDownload, FaUpload, FaChartLine,
  FaLock, FaSync, FaSearch,
} from 'react-icons/fa';

/* ── helpers ─────────────────────────────────────────────────────────────── */
const getUsername = () => {
  try {
    // Login stores username directly in auth_user key
    return (localStorage.getItem('auth_user') || '').toLowerCase();
  } catch (_) { return ''; }
};

/* ── header button ───────────────────────────────────────────────────────── */
const HBtn = ({ onClick, children, title, danger, T }) => (
  <button onClick={onClick} title={title}
    style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '5px 11px', fontSize: 11, fontWeight: 500,
      background: 'transparent',
      border: `1px solid ${danger ? T.red + '55' : T.border2}`,
      color: danger ? T.red : T.muted,
      cursor: 'pointer', transition: 'all 0.12s', letterSpacing: '0.02em',
    }}
    onMouseEnter={e => {
      e.currentTarget.style.borderColor = danger ? T.red : T.blue;
      e.currentTarget.style.color       = danger ? T.red : T.text;
      e.currentTarget.style.background  = danger ? `${T.red}14` : `${T.blue}14`;
    }}
    onMouseLeave={e => {
      e.currentTarget.style.borderColor = danger ? `${T.red}55` : T.border2;
      e.currentTarget.style.color       = danger ? T.red : T.muted;
      e.currentTarget.style.background  = 'transparent';
    }}
  >
    {children}
  </button>
);

/* ── empty state ─────────────────────────────────────────────────────────── */
const EmptyState = ({ isAdmin, onAdd, T }) => (
  <div style={{
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    padding: '80px 20px',
    border: `2px dashed ${T.border2}`,
    textAlign: 'center',
  }}>
    <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.4 }}>📊</div>
    <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 6 }}>No panels yet</div>
    <div style={{ fontSize: 12, color: T.muted, maxWidth: 380, lineHeight: 1.7, marginBottom: 24 }}>
      {isAdmin
        ? 'Create your first KQL panel to start visualizing Azure Application Insights data.'
        : 'No panels have been created yet. Ask an admin to add panels to this dashboard.'}
    </div>
    {isAdmin && (
      <button onClick={onAdd}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          padding: '8px 22px', fontSize: 12, fontWeight: 600,
          background: T.blue, border: 'none', color: '#fff',
          cursor: 'pointer', transition: 'opacity 0.12s',
        }}
        onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
        onMouseLeave={e => e.currentTarget.style.opacity = '1'}
      >
        <FaPlus style={{ fontSize: 10 }} /> Add Your First Panel
      </button>
    )}
  </div>
);

/* ══ main page ═══════════════════════════════════════════════════════════════ */
const KqlDashboard = () => {
  const { T } = useTheme();
  const isAdmin = getUsername() === 'admin';

  const [dashboards,           setDashboards]           = useState([]);
  const [selectedDashboardId,  setSelectedDashboardId]  = useState('default');
  const [panels,               setPanels]               = useState([]);
  const [loading,              setLoading]              = useState(false);
  const [error,                setError]                = useState(null);
  const [connectionOk,         setConnectionOk]         = useState(null);

  const [showPanelEditor,  setShowPanelEditor]  = useState(false);
  const [editingPanel,     setEditingPanel]     = useState(null);
  const [showNewDashboard, setShowNewDashboard] = useState(false);
  const [newDashName,      setNewDashName]      = useState('');
  const [showImport,       setShowImport]       = useState(false);
  const [importJson,       setImportJson]       = useState('');
  const [searchQuery,      setSearchQuery]      = useState('');

  /* ── load on mount ── */
  useEffect(() => {
    loadDashboards();
    axios.get(`${API_BASE_URL}/api/kql/test`)
      .then(r => setConnectionOk(r.data.success))
      .catch(() => setConnectionOk(false));
  }, []); // eslint-disable-line

  useEffect(() => { if (selectedDashboardId) loadPanels(); }, [selectedDashboardId]); // eslint-disable-line

  const loadDashboards = async () => {
    try {
      const r = await axios.get(`${API_BASE_URL}/api/kql/dashboards`);
      if (r.data.success) {
        setDashboards(r.data.dashboards);
        const ids = r.data.dashboards.map(d => d.id);
        if (r.data.dashboards.length > 0 && !ids.includes(selectedDashboardId)) {
          setSelectedDashboardId(r.data.dashboards[0].id);
        }
      }
    } catch (err) { console.error('Failed to load dashboards:', err); }
  };

  const loadPanels = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await axios.get(`${API_BASE_URL}/api/kql/dashboards/${selectedDashboardId}/panels`);
      if (r.data.success) setPanels(r.data.panels);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally { setLoading(false); }
  }, [selectedDashboardId]);

  const handleCreateDashboard = async () => {
    if (!newDashName.trim()) return;
    try {
      const r = await axios.post(`${API_BASE_URL}/api/kql/dashboards`, { name: newDashName.trim() });
      if (r.data.success) {
        setNewDashName(''); setShowNewDashboard(false);
        await loadDashboards();
        setSelectedDashboardId(r.data.dashboard.id);
      }
    } catch (err) { alert('Failed: ' + (err.response?.data?.message || err.message)); }
  };

  const handleDeleteDashboard = async () => {
    if (selectedDashboardId === 'default') { alert('Cannot delete the default dashboard'); return; }
    const name = dashboards.find(d => d.id === selectedDashboardId)?.name;
    if (!window.confirm(`Delete dashboard "${name}" and all its panels?`)) return;
    try {
      await axios.delete(`${API_BASE_URL}/api/kql/dashboards/${selectedDashboardId}`);
      setSelectedDashboardId('default');
      await loadDashboards();
    } catch (err) { alert('Failed: ' + (err.response?.data?.message || err.message)); }
  };

  const handleDeletePanel = async (id) => {
    if (!window.confirm('Delete this panel?')) return;
    try { await axios.delete(`${API_BASE_URL}/api/kql/panels/${id}`); loadPanels(); }
    catch (err) { alert('Failed: ' + (err.response?.data?.message || err.message)); }
  };

  const handleDuplicatePanel = async (id) => {
    try { await axios.post(`${API_BASE_URL}/api/kql/panels/${id}/duplicate`); loadPanels(); }
    catch (err) { alert('Failed: ' + (err.response?.data?.message || err.message)); }
  };

  const handleExport = async () => {
    try {
      const r = await axios.get(`${API_BASE_URL}/api/kql/dashboards/${selectedDashboardId}/export`);
      if (r.data.success) {
        const blob = new Blob([JSON.stringify(r.data.data, null, 2)], { type: 'application/json' });
        const url  = URL.createObjectURL(blob);
        Object.assign(document.createElement('a'), { href: url, download: `kql-${selectedDashboardId}-${Date.now()}.json` }).click();
        URL.revokeObjectURL(url);
      }
    } catch (err) { alert('Export failed: ' + (err.response?.data?.message || err.message)); }
  };

  const handleImport = async () => {
    try {
      const data = JSON.parse(importJson);
      const r = await axios.post(`${API_BASE_URL}/api/kql/dashboards/import`, { data });
      if (r.data.success) {
        setShowImport(false); setImportJson('');
        await loadDashboards();
        setSelectedDashboardId(r.data.dashboard.id);
      }
    } catch (err) { alert('Import failed: ' + (err.response?.data?.message || err.message)); }
  };

  const handleLayoutChange = useCallback(async (panelId, changes) => {
    try {
      const panel = panels.find(p => p.id === panelId);
      if (!panel) return;
      await axios.put(`${API_BASE_URL}/api/kql/panels/${panelId}`, {
        position: { ...panel.position, ...changes },
      });
    } catch (err) {
      console.warn('Failed to save layout:', err.message);
    }
  }, [panels]);

  const filtered = panels.filter(p => !searchQuery || p.title.toLowerCase().includes(searchQuery.toLowerCase()));

  /* ── shared input style ── */
  const inp = {
    padding: '5px 10px', fontSize: 11,
    background: T.surface, border: `1px solid ${T.border2}`,
    color: T.text, outline: 'none',
  };

  return (
    <div style={{ background: T.bg, minHeight: '100vh', color: T.text, fontFamily: 'Inter, system-ui, sans-serif', fontSize: 13, transition: 'background 0.2s, color 0.2s' }}>

      {/* ══ HEADER ══════════════════════════════════════════════════════════ */}
      <div style={{ background: T.surface, borderBottom: `1px solid ${T.border}`, padding: '0 24px', transition: 'background 0.2s' }}>

        {/* top row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 50, gap: 10 }}>

          {/* left: title + connection badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <FaChartLine style={{ color: T.blue, fontSize: 16 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.text, letterSpacing: '0.01em' }}>KQL Dashboard</div>
                <div style={{ fontSize: 10, color: T.muted, marginTop: -1 }}>Azure Application Insights</div>
              </div>
            </div>

            <div style={{ width: 1, height: 24, background: T.border }} />

            {/* connection status */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '3px 10px',
              background: connectionOk === true  ? `${T.green}14`
                        : connectionOk === false ? `${T.red}14`
                        : `${T.blue}0a`,
              border: `1px solid ${connectionOk === true  ? T.green + '44'
                                  : connectionOk === false ? T.red + '44'
                                  : T.border2}`,
              fontSize: 11,
              color: connectionOk === true  ? T.green
                   : connectionOk === false ? T.red
                   : T.muted,
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%', display: 'inline-block',
                background: connectionOk === true  ? T.green
                          : connectionOk === false ? T.red
                          : T.muted,
                animation: connectionOk === null ? 'kql-pulse 1.5s ease-in-out infinite' : 'none',
              }} />
              {connectionOk === true ? 'Connected' : connectionOk === false ? 'Not Connected' : 'Checking…'}
            </div>

            {/* dashboard selector */}
            <select value={selectedDashboardId} onChange={e => setSelectedDashboardId(e.target.value)}
              style={{ ...inp, cursor: 'pointer', minWidth: 180 }}>
              {dashboards.map(d => <option key={d.id} value={d.id} style={{ background: T.surface }}>{d.name}</option>)}
            </select>
          </div>

          {/* right: actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* search */}
            <div style={{ position: 'relative' }}>
              <FaSearch style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: T.dim, fontSize: 10, pointerEvents: 'none' }} />
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search panels…"
                style={{ ...inp, paddingLeft: 24, width: 180 }}
              />
            </div>

            <div style={{ width: 1, height: 18, background: T.border2 }} />

            <HBtn onClick={loadPanels} title="Refresh" T={T}>
              <FaSync style={{ fontSize: 10 }} />
            </HBtn>

            {isAdmin && (
              <>
                <HBtn onClick={() => setShowNewDashboard(v => !v)} T={T}>
                  <FaPlus style={{ fontSize: 10 }} /> New Dashboard
                </HBtn>

                {selectedDashboardId !== 'default' && (
                  <HBtn onClick={handleDeleteDashboard} danger T={T}>
                    <FaTrash style={{ fontSize: 10 }} />
                  </HBtn>
                )}

                <HBtn onClick={handleExport} T={T}>
                  <FaDownload style={{ fontSize: 10 }} /> Export
                </HBtn>

                <HBtn onClick={() => setShowImport(v => !v)} T={T}>
                  <FaUpload style={{ fontSize: 10 }} /> Import
                </HBtn>

                <div style={{ width: 1, height: 18, background: T.border2 }} />

                <button
                  onClick={() => { setEditingPanel(null); setShowPanelEditor(true); }}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '6px 14px', fontSize: 11, fontWeight: 600,
                    background: `${T.blue}22`, border: `1px solid ${T.blue}55`,
                    color: T.blue, cursor: 'pointer', transition: 'all 0.12s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = `${T.blue}33`; e.currentTarget.style.borderColor = T.blue; }}
                  onMouseLeave={e => { e.currentTarget.style.background = `${T.blue}22`; e.currentTarget.style.borderColor = `${T.blue}55`; }}
                >
                  <FaPlus style={{ fontSize: 9 }} /> Add Panel
                </button>
              </>
            )}

            {!isAdmin && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', border: `1px solid ${T.border2}`, fontSize: 11, color: T.dim }}>
                <FaLock style={{ fontSize: 10 }} /> View only
              </div>
            )}
          </div>
        </div>

        {/* metric strip — connection warning */}
        {connectionOk === false && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 36, borderTop: `1px solid ${T.border}`, fontSize: 11, color: T.red }}>
            <span>⚠</span>
            <span>
              Azure Application Insights not configured — set{' '}
              <code style={{ background: `${T.red}18`, padding: '1px 5px', fontSize: 10 }}>APP_INSIGHTS_APP_ID</code>
              {' '}and{' '}
              <code style={{ background: `${T.red}18`, padding: '1px 5px', fontSize: 10 }}>APP_INSIGHTS_API_KEY</code>
              {' '}environment variables.
            </span>
          </div>
        )}
      </div>

      {/* ══ BODY ════════════════════════════════════════════════════════════ */}
      <div style={{ padding: '18px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* ── new dashboard form ── */}
        {showNewDashboard && isAdmin && (
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, padding: '14px 18px', display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="text" value={newDashName} onChange={e => setNewDashName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreateDashboard()}
              placeholder="Dashboard name" autoFocus
              style={{ ...inp, flex: 1 }}
            />
            <button onClick={handleCreateDashboard}
              style={{ padding: '5px 16px', background: T.green, border: 'none', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
              Create
            </button>
            <button onClick={() => { setShowNewDashboard(false); setNewDashName(''); }}
              style={{ padding: '5px 12px', background: 'transparent', border: `1px solid ${T.border2}`, color: T.muted, fontSize: 11, cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        )}

        {/* ── import form ── */}
        {showImport && isAdmin && (
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, padding: '14px 18px' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: T.muted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Import Dashboard (paste JSON)
            </div>
            <textarea value={importJson} onChange={e => setImportJson(e.target.value)}
              placeholder='{"dashboard": {...}, "panels": [...]}'
              style={{ ...inp, width: '100%', height: 100, fontFamily: 'monospace', resize: 'vertical', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button onClick={handleImport}
                style={{ padding: '5px 16px', background: T.green, border: 'none', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                Import
              </button>
              <button onClick={() => { setShowImport(false); setImportJson(''); }}
                style={{ padding: '5px 12px', background: 'transparent', border: `1px solid ${T.border2}`, color: T.muted, fontSize: 11, cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ── panels ── */}
        {loading && panels.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, gap: 12, color: T.dim, fontSize: 12 }}>
            <svg style={{ width: 24, height: 24, animation: 'kql-spin 0.8s linear infinite' }} viewBox="0 0 24 24" fill="none" stroke={T.blue} strokeWidth="2.5">
              <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
            </svg>
            Loading panels…
          </div>
        ) : error ? (
          <div style={{ background: `${T.red}14`, border: `1px solid ${T.red}44`, padding: '12px 16px', color: T.red, fontSize: 12 }}>
            ⚠ {error}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState isAdmin={isAdmin} onAdd={() => { setEditingPanel(null); setShowPanelEditor(true); }} T={T} />
        ) : (
          <PanelGrid
            panels={filtered}
            isAdmin={isAdmin}
            onLayoutChange={handleLayoutChange}
            renderPanel={(panel, { height }) => (
              <KqlPanel
                panel={panel}
                height={height}
                isAdmin={isAdmin}
                onEdit={p => { setEditingPanel(p); setShowPanelEditor(true); }}
                onDelete={handleDeletePanel}
                onDuplicate={handleDuplicatePanel}
              />
            )}
          />
        )}
      </div>

      {/* ── panel editor modal ── */}
      {showPanelEditor && isAdmin && (
        <KqlPanelEditor
          panel={editingPanel}
          dashboardId={selectedDashboardId}
          onClose={() => { setShowPanelEditor(false); setEditingPanel(null); }}
          onSaved={loadPanels}
        />
      )}

      <style>{`
        @keyframes kql-spin  { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes kql-pulse { 0%,100% { opacity:1; } 50% { opacity:0.25; } }
      `}</style>
    </div>
  );
};

export default KqlDashboard;
