import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config/apiConfig';
import Panel from '../components/customDb/Panel';
import ConnectionManager from '../components/customDb/ConnectionManager';
import PanelEditor from '../components/customDb/PanelEditor';
import { useTheme } from '../context/ThemeContext';
import {
  FaDatabase, FaPlus, FaDownload, FaTrash, FaCog,
  FaChartBar, FaSync, FaSearch, FaShieldAlt,
} from 'react-icons/fa';

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

const CustomDbQuery = () => {
  const { T } = useTheme();
  const [dashboards,           setDashboards]           = useState([]);
  const [selectedDashboard,    setSelectedDashboard]    = useState('default');
  const [panels,               setPanels]               = useState([]);
  const [loading,              setLoading]              = useState(false);
  const [showPanelEditor,      setShowPanelEditor]      = useState(false);
  const [editingPanel,         setEditingPanel]         = useState(null);
  const [showConnectionManager,setShowConnectionManager]= useState(false);
  const [showDashboardForm,    setShowDashboardForm]    = useState(false);
  const [newDashboardName,     setNewDashboardName]     = useState('');
  const [searchQuery,          setSearchQuery]          = useState('');

  useEffect(() => { loadDashboards(); }, []); // eslint-disable-line
  useEffect(() => { if (selectedDashboard) loadPanels(); }, [selectedDashboard]); // eslint-disable-line

  const loadDashboards = async () => {
    try {
      const r = await axios.get(`${API_BASE_URL}/api/custom-db/dashboards`);
      if (r.data.success) setDashboards(r.data.dashboards);
    } catch (err) { console.error('Failed to load dashboards:', err); }
  };

  const loadPanels = async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API_BASE_URL}/api/custom-db/dashboards/${selectedDashboard}/panels`);
      if (r.data.success) setPanels(r.data.panels);
    } catch (err) { console.error('Failed to load panels:', err); }
    finally { setLoading(false); }
  };

  const handleCreateDashboard = async () => {
    if (!newDashboardName.trim()) return;
    try {
      await axios.post(`${API_BASE_URL}/api/custom-db/dashboards`, { name: newDashboardName, description: '' });
      setNewDashboardName(''); setShowDashboardForm(false);
      loadDashboards();
    } catch (err) { alert('Failed: ' + err.message); }
  };

  const handleDeleteDashboard = async () => {
    if (selectedDashboard === 'default') { alert('Cannot delete default dashboard'); return; }
    if (!window.confirm('Delete this dashboard and all its panels?')) return;
    try {
      await axios.delete(`${API_BASE_URL}/api/custom-db/dashboards/${selectedDashboard}`);
      setSelectedDashboard('default'); loadDashboards();
    } catch (err) { alert('Failed: ' + err.message); }
  };

  const handleExport = async () => {
    try {
      const r = await axios.get(`${API_BASE_URL}/api/custom-db/dashboards/${selectedDashboard}/export`);
      if (r.data.success) {
        const blob = new Blob([JSON.stringify(r.data.data, null, 2)], { type: 'application/json' });
        const url  = URL.createObjectURL(blob);
        Object.assign(document.createElement('a'), { href: url, download: `db-dashboard-${selectedDashboard}-${Date.now()}.json` }).click();
        URL.revokeObjectURL(url);
      }
    } catch (err) { alert('Export failed: ' + err.message); }
  };

  const handleDeletePanel    = async (id) => {
    if (!window.confirm('Delete this panel?')) return;
    try { await axios.delete(`${API_BASE_URL}/api/custom-db/panels/${id}`); loadPanels(); }
    catch (err) { alert('Failed: ' + err.message); }
  };

  const handleDuplicatePanel = async (id) => {
    try { await axios.post(`${API_BASE_URL}/api/custom-db/panels/${id}/duplicate`); loadPanels(); }
    catch (err) { alert('Failed: ' + err.message); }
  };

  const filtered = panels.filter(p => !searchQuery || p.title.toLowerCase().includes(searchQuery.toLowerCase()));

  const inp = {
    padding: '5px 10px', fontSize: 11,
    background: T.surface, border: `1px solid ${T.border2}`,
    color: T.text, outline: 'none',
  };

  return (
    <div style={{ background: T.bg, minHeight: '100vh', color: T.text, fontFamily: 'Inter, system-ui, sans-serif', fontSize: 13, transition: 'background 0.2s, color 0.2s' }}>

      {/* ══ HEADER ══════════════════════════════════════════════════════════ */}
      <div style={{ background: T.surface, borderBottom: `1px solid ${T.border}`, padding: '0 24px', transition: 'background 0.2s', position: 'sticky', top: 0, zIndex: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 50, gap: 10 }}>

          {/* left */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <FaDatabase style={{ color: T.blue, fontSize: 15 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.text, letterSpacing: '0.01em' }}>Custom DB Query</div>
                <div style={{ fontSize: 10, color: T.muted, marginTop: -1 }}>PostgreSQL · Read-only</div>
              </div>
            </div>

            <div style={{ width: 1, height: 24, background: T.border }} />

            <select value={selectedDashboard} onChange={e => setSelectedDashboard(e.target.value)}
              style={{ ...inp, cursor: 'pointer', minWidth: 180 }}>
              {dashboards.map(d => <option key={d.id} value={d.id} style={{ background: T.surface }}>{d.name}</option>)}
            </select>
          </div>

          {/* right */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
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

            <HBtn onClick={() => setShowDashboardForm(v => !v)} T={T}>
              <FaPlus style={{ fontSize: 10 }} /> New Dashboard
            </HBtn>

            {selectedDashboard !== 'default' && (
              <HBtn onClick={handleDeleteDashboard} danger T={T}>
                <FaTrash style={{ fontSize: 10 }} />
              </HBtn>
            )}

            <HBtn onClick={handleExport} T={T}>
              <FaDownload style={{ fontSize: 10 }} /> Export
            </HBtn>

            <HBtn onClick={() => setShowConnectionManager(true)} T={T}>
              <FaCog style={{ fontSize: 10 }} /> Connections
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
          </div>
        </div>

        {/* safety strip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 32, borderTop: `1px solid ${T.border}`, fontSize: 11, color: T.muted }}>
          <FaShieldAlt style={{ color: T.orange, fontSize: 11 }} />
          <span style={{ color: T.orange, fontWeight: 600 }}>Safety Active</span>
          <span style={{ color: T.dim }}>·</span>
          <span>Read-only connections</span>
          <span style={{ color: T.dim }}>·</span>
          <span>Query validation</span>
          <span style={{ color: T.dim }}>·</span>
          <span>30s timeout</span>
          <span style={{ color: T.dim }}>·</span>
          <span>Connection pooling</span>
          <span style={{ color: T.dim }}>·</span>
          <span>No database locking</span>
        </div>
      </div>

      {/* ══ BODY ════════════════════════════════════════════════════════════ */}
      <div style={{ padding: '18px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* new dashboard form */}
        {showDashboardForm && (
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, padding: '14px 18px', display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="text" value={newDashboardName} onChange={e => setNewDashboardName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreateDashboard()}
              placeholder="Dashboard name" autoFocus
              style={{ ...inp, flex: 1 }}
            />
            <button onClick={handleCreateDashboard}
              style={{ padding: '5px 16px', background: T.green, border: 'none', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
              Create
            </button>
            <button onClick={() => { setShowDashboardForm(false); setNewDashboardName(''); }}
              style={{ padding: '5px 12px', background: 'transparent', border: `1px solid ${T.border2}`, color: T.muted, fontSize: 11, cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        )}

        {/* panels */}
        {loading && panels.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, gap: 12, color: T.dim, fontSize: 12 }}>
            <svg style={{ width: 24, height: 24, animation: 'cdb-spin 0.8s linear infinite' }} viewBox="0 0 24 24" fill="none" stroke={T.blue} strokeWidth="2.5">
              <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
            </svg>
            Loading panels…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 20px', border: `2px dashed ${T.border2}`, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.35 }}>
              <FaChartBar />
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 6 }}>
              {searchQuery ? 'No panels match your search' : 'No panels yet'}
            </div>
            <div style={{ fontSize: 12, color: T.muted, maxWidth: 380, lineHeight: 1.7, marginBottom: 24 }}>
              {searchQuery
                ? `No panels found for "${searchQuery}"`
                : 'Create your first panel to start visualizing data from your PostgreSQL databases.'}
            </div>
            {!searchQuery && (
              <button onClick={() => { setEditingPanel(null); setShowPanelEditor(true); }}
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
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-start' }}>
            {filtered.map(panel => {
              const savedW = panel.position?.pixelW;
              return (
                <div key={panel.id} style={{
                  flex: savedW ? `0 0 ${savedW}px` : '1 1 500px',
                  minWidth: savedW ? `${savedW}px` : '500px',
                  maxWidth: savedW ? `${savedW}px` : '100%',
                  boxSizing: 'border-box',
                }}>
                  <Panel
                    panel={panel}
                    onEdit={p => { setEditingPanel(p); setShowPanelEditor(true); }}
                    onDelete={handleDeletePanel}
                    onDuplicate={handleDuplicatePanel}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* modals */}
      {showPanelEditor && (
        <PanelEditor
          panel={editingPanel}
          dashboardId={selectedDashboard}
          onClose={() => { setShowPanelEditor(false); loadPanels(); }}
        />
      )}
      {showConnectionManager && (
        <ConnectionManager onClose={() => setShowConnectionManager(false)} />
      )}

      <style>{`@keyframes cdb-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default CustomDbQuery;
