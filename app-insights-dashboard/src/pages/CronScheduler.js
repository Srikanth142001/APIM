import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config/apiConfig';
import { useTheme } from '../context/ThemeContext';
import { FaPlus, FaPlay, FaStop, FaTrash, FaEdit, FaHistory, FaTimes, FaSave, FaUpload, FaClock } from 'react-icons/fa';

const CRON_PRESETS = [
  { label: 'Every minute',    value: '* * * * *'      },
  { label: 'Every 5 min',     value: '*/5 * * * *'    },
  { label: 'Every 15 min',    value: '*/15 * * * *'   },
  { label: 'Every 30 min',    value: '*/30 * * * *'   },
  { label: 'Every hour',      value: '0 * * * *'      },
  { label: 'Every 6 hours',   value: '0 */6 * * *'    },
  { label: 'Daily at midnight', value: '0 0 * * *'    },
  { label: 'Daily at 9am',    value: '0 9 * * *'      },
  { label: 'Weekly (Mon 9am)',value: '0 9 * * 1'      },
  { label: 'Monthly (1st)',   value: '0 0 1 * *'      },
];

const SCRIPT_TYPES = [
  { value: 'shell',       label: 'Shell (.sh)'        },
  { value: 'python',      label: 'Python (.py)'       },
  { value: 'powershell',  label: 'PowerShell (.ps1)'  },
  { value: 'batch',       label: 'Batch (.bat)'       },
];

const EMPTY_FORM = {
  name: '', description: '', schedule: '0 * * * *',
  scriptContent: '#!/bin/sh\necho "Hello from cron job"\ndate',
  scriptName: 'script', scriptType: 'shell', enabled: true,
};

const statusColor = (s) =>
  s === 'success' ? '#73bf69' : s === 'failed' ? '#f2495c' : '#8e8e8e';

export default function CronScheduler() {
  const { T } = useTheme();
  const [jobs, setJobs]             = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [editJob, setEditJob]       = useState(null);
  const [form, setForm]             = useState(EMPTY_FORM);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState(null);
  const [logsModal, setLogsModal]   = useState(null); // job
  const [logs, setLogs]             = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [runningId, setRunningId]   = useState(null);
  const role = localStorage.getItem('auth_role') || 'viewer';
  const isAdmin = role === 'admin';

  const load = useCallback(async () => {
    try {
      const r = await axios.get(`${API_BASE_URL}/api/cron/jobs`);
      setJobs(r.data.jobs || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, [load]);

  const openCreate = () => { setEditJob(null); setForm(EMPTY_FORM); setError(null); setShowForm(true); };
  const openEdit   = async (job) => {
    // fetch full job (with scriptContent)
    try {
      const r = await axios.get(`${API_BASE_URL}/api/cron/jobs`);
      const full = (r.data.jobs || []).find(j => j.id === job.id) || job;
      setEditJob(full); setForm({ ...EMPTY_FORM, ...full }); setError(null); setShowForm(true);
    } catch { setEditJob(job); setForm({ ...EMPTY_FORM, ...job }); setShowForm(true); }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const ext = file.name.split('.').pop().toLowerCase();
      const typeMap = { py: 'python', sh: 'shell', ps1: 'powershell', bat: 'batch' };
      setForm(p => ({
        ...p,
        scriptContent: ev.target.result,
        scriptName: file.name.replace(/\.[^.]+$/, ''),
        scriptType: typeMap[ext] || 'shell',
      }));
    };
    reader.readAsText(file);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Name is required'); return; }
    if (!form.schedule.trim()) { setError('Schedule is required'); return; }
    if (!form.scriptContent.trim()) { setError('Script content is required'); return; }
    setSaving(true); setError(null);
    try {
      if (editJob) {
        await axios.put(`${API_BASE_URL}/api/cron/jobs/${editJob.id}`, form);
      } else {
        await axios.post(`${API_BASE_URL}/api/cron/jobs`, form);
      }
      setShowForm(false); load();
    } catch (e) { setError(e.response?.data?.message || e.message); }
    finally { setSaving(false); }
  };

  const handleToggle = async (job) => {
    try { await axios.post(`${API_BASE_URL}/api/cron/jobs/${job.id}/toggle`); load(); }
    catch (e) { alert(e.response?.data?.message || e.message); }
  };

  const handleDelete = async (job) => {
    if (!window.confirm(`Delete "${job.name}"?`)) return;
    try { await axios.delete(`${API_BASE_URL}/api/cron/jobs/${job.id}`); load(); }
    catch (e) { alert(e.response?.data?.message || e.message); }
  };

  const handleRunNow = async (job) => {
    setRunningId(job.id);
    try {
      await axios.post(`${API_BASE_URL}/api/cron/jobs/${job.id}/run`);
      load();
    } catch (e) { alert(e.response?.data?.message || e.message); }
    finally { setRunningId(null); }
  };

  const openLogs = async (job) => {
    setLogsModal(job); setLogsLoading(true); setLogs([]);
    try {
      const r = await axios.get(`${API_BASE_URL}/api/cron/jobs/${job.id}/logs`);
      setLogs(r.data.logs || []);
    } catch { setLogs([]); }
    finally { setLogsLoading(false); }
  };

  const inp = { padding: '7px 10px', fontSize: 12, background: T.inputBg || T.surface, border: `1px solid ${T.border2}`, color: T.text, outline: 'none', width: '100%', boxSizing: 'border-box' };
  const lbl = (t, req) => <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: T.muted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t}{req && <span style={{ color: T.red, marginLeft: 2 }}>*</span>}</label>;

  return (
    <div style={{ padding: '20px 24px', background: T.bg, minHeight: '100vh', color: T.text, fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: T.text, display: 'flex', alignItems: 'center', gap: 8 }}>
            <FaClock style={{ color: T.blue, fontSize: 16 }} /> Cron Scheduler
          </div>
          <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>Schedule and manage recurring scripts</div>
        </div>
        {isAdmin && (
          <button onClick={openCreate}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', background: T.blue, border: 'none', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            <FaPlus style={{ fontSize: 10 }} /> New Job
          </button>
        )}
      </div>

      {/* Jobs table */}
      {loading ? (
        <div style={{ color: T.dim, fontSize: 13, textAlign: 'center', padding: 40 }}>Loading jobs…</div>
      ) : jobs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: T.dim }}>
          <FaClock style={{ fontSize: 32, marginBottom: 12, opacity: 0.3 }} />
          <div style={{ fontSize: 14, marginBottom: 6 }}>No cron jobs yet</div>
          {isAdmin && <div style={{ fontSize: 12 }}>Click <strong>New Job</strong> to schedule your first script.</div>}
        </div>
      ) : (
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: T.panel }}>
                {['Status','Name','Schedule','Type','Last Run','Next~','Runs','Actions'].map(h => (
                  <th key={h} style={{ padding: '9px 12px', textAlign: 'left', color: T.muted, fontWeight: 600, borderBottom: `1px solid ${T.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {jobs.map(job => (
                <tr key={job.id} style={{ borderBottom: `1px solid ${T.border}` }}
                  onMouseEnter={e => e.currentTarget.style.background = T.panel}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '8px 12px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px', fontSize: 11, fontWeight: 600,
                      background: job.enabled ? '#73bf6920' : '#8e8e8e20',
                      color: job.enabled ? '#73bf69' : '#8e8e8e',
                      border: `1px solid ${job.enabled ? '#73bf6944' : '#8e8e8e44'}` }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: job.enabled ? '#73bf69' : '#8e8e8e' }} />
                      {job.enabled ? 'Active' : 'Paused'}
                    </span>
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <div style={{ fontWeight: 600, color: T.text }}>{job.name}</div>
                    {job.description && <div style={{ color: T.dim, fontSize: 11, marginTop: 1 }}>{job.description}</div>}
                  </td>
                  <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: T.blue }}>{job.schedule}</td>
                  <td style={{ padding: '8px 12px', color: T.muted }}>{job.scriptType}</td>
                  <td style={{ padding: '8px 12px' }}>
                    {job.lastRunAt ? (
                      <div>
                        <span style={{ color: statusColor(job.lastStatus), fontWeight: 600 }}>{job.lastStatus || '-'}</span>
                        <div style={{ color: T.dim, fontSize: 11 }}>{new Date(job.lastRunAt).toLocaleString()}</div>
                      </div>
                    ) : <span style={{ color: T.dim }}>Never</span>}
                  </td>
                  <td style={{ padding: '8px 12px', color: T.dim, fontSize: 11 }}>
                    {job.enabled ? <span style={{ color: T.muted }}>Next trigger per schedule</span> : '—'}
                  </td>
                  <td style={{ padding: '8px 12px', color: T.muted }}>{job.runCount || 0}</td>
                  <td style={{ padding: '8px 12px' }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => openLogs(job)} title="Logs"
                        style={{ padding: '4px 8px', background: T.border, border: 'none', color: T.muted, cursor: 'pointer', fontSize: 11 }}>
                        <FaHistory />
                      </button>
                      {isAdmin && (<>
                        <button onClick={() => handleRunNow(job)} disabled={runningId === job.id} title="Run now"
                          style={{ padding: '4px 8px', background: '#73bf6920', border: 'none', color: '#73bf69', cursor: 'pointer', fontSize: 11 }}>
                          {runningId === job.id ? '…' : <FaPlay />}
                        </button>
                        <button onClick={() => handleToggle(job)} title={job.enabled ? 'Pause' : 'Enable'}
                          style={{ padding: '4px 8px', background: job.enabled ? '#f2495c20' : '#73bf6920', border: 'none', color: job.enabled ? '#f2495c' : '#73bf69', cursor: 'pointer', fontSize: 11 }}>
                          {job.enabled ? <FaStop /> : <FaPlay />}
                        </button>
                        <button onClick={() => openEdit(job)} title="Edit"
                          style={{ padding: '4px 8px', background: T.border, border: 'none', color: T.muted, cursor: 'pointer', fontSize: 11 }}>
                          <FaEdit />
                        </button>
                        <button onClick={() => handleDelete(job)} title="Delete"
                          style={{ padding: '4px 8px', background: '#f2495c20', border: 'none', color: '#f2495c', cursor: 'pointer', fontSize: 11 }}>
                          <FaTrash />
                        </button>
                      </>)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Create / Edit Modal ─────────────────────────────────────────────── */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, width: '100%', maxWidth: 760, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderBottom: `1px solid ${T.border}`, background: T.panel }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{editJob ? 'Edit Job' : 'New Cron Job'}</span>
              <button onClick={() => setShowForm(false)} style={{ background: 'transparent', border: 'none', color: T.muted, cursor: 'pointer', fontSize: 18 }}><FaTimes /></button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  {lbl('Job Name', true)}
                  <input style={inp} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Daily Cleanup" />
                </div>
                <div>
                  {lbl('Script Type')}
                  <select style={{ ...inp, cursor: 'pointer' }} value={form.scriptType} onChange={e => setForm(p => ({ ...p, scriptType: e.target.value }))}>
                    {SCRIPT_TYPES.map(t => <option key={t.value} value={t.value} style={{ background: T.surface }}>{t.label}</option>)}
                  </select>
                </div>
              </div>

              <div>
                {lbl('Description')}
                <input style={inp} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Optional description" />
              </div>

              <div>
                {lbl('Cron Schedule', true)}
                <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                  <input style={{ ...inp, fontFamily: 'monospace', flex: 1 }} value={form.schedule}
                    onChange={e => setForm(p => ({ ...p, schedule: e.target.value }))} placeholder="* * * * *" />
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {CRON_PRESETS.map(p => (
                    <button key={p.value} onClick={() => setForm(f => ({ ...f, schedule: p.value }))}
                      style={{ padding: '3px 8px', fontSize: 11, background: form.schedule === p.value ? T.blue + '22' : T.border, border: `1px solid ${form.schedule === p.value ? T.blue : T.border2}`, color: form.schedule === p.value ? T.blue : T.muted, cursor: 'pointer' }}>
                      {p.label}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: 10, color: T.dim, marginTop: 4 }}>Format: minute hour day month weekday (e.g. <code style={{ color: T.blue }}>0 9 * * 1</code> = every Monday 9am)</div>
              </div>

              <div>
                {lbl('Script Content', true)}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: T.muted }}>Or upload a file:</span>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', background: T.border, border: `1px solid ${T.border2}`, color: T.muted, cursor: 'pointer', fontSize: 11 }}>
                    <FaUpload style={{ fontSize: 10 }} /> Upload Script
                    <input type="file" accept=".sh,.py,.ps1,.bat,.txt" onChange={handleFileUpload} style={{ display: 'none' }} />
                  </label>
                </div>
                <textarea value={form.scriptContent} onChange={e => setForm(p => ({ ...p, scriptContent: e.target.value }))}
                  spellCheck={false} style={{ ...inp, height: 200, fontFamily: '"Fira Code", Consolas, monospace', fontSize: 12, lineHeight: 1.6, resize: 'vertical' }} />
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.text, fontSize: 12, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.enabled} onChange={e => setForm(p => ({ ...p, enabled: e.target.checked }))} />
                Enable job immediately after saving
              </label>
            </div>

            {error && <div style={{ margin: '0 18px', padding: '8px 12px', background: '#f2495c14', border: '1px solid #f2495c44', color: '#f2495c', fontSize: 12 }}>⚠ {error}</div>}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 18px', borderTop: `1px solid ${T.border}`, background: T.panel }}>
              <button onClick={() => setShowForm(false)} style={{ padding: '6px 16px', background: 'transparent', border: `1px solid ${T.border2}`, color: T.muted, fontSize: 12, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSave} disabled={saving}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 18px', background: saving ? T.border : T.green || '#73bf69', border: 'none', color: '#fff', fontSize: 12, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>
                <FaSave style={{ fontSize: 11 }} /> {saving ? 'Saving…' : 'Save Job'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Logs Modal ──────────────────────────────────────────────────────── */}
      {logsModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, width: '100%', maxWidth: 800, maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderBottom: `1px solid ${T.border}`, background: T.panel }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>
                <FaHistory style={{ marginRight: 8, color: T.blue }} />Execution Logs — {logsModal.name}
              </span>
              <button onClick={() => setLogsModal(null)} style={{ background: 'transparent', border: 'none', color: T.muted, cursor: 'pointer', fontSize: 18 }}><FaTimes /></button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
              {logsLoading ? (
                <div style={{ color: T.dim, textAlign: 'center', padding: 40 }}>Loading logs…</div>
              ) : logs.length === 0 ? (
                <div style={{ color: T.dim, textAlign: 'center', padding: 40 }}>No execution history yet</div>
              ) : logs.map((log, i) => (
                <div key={i} style={{ marginBottom: 12, background: T.panel, border: `1px solid ${log.exitCode === 0 ? '#73bf6944' : '#f2495c44'}`, borderLeft: `3px solid ${log.exitCode === 0 ? '#73bf69' : '#f2495c'}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderBottom: `1px solid ${T.border}` }}>
                    <span style={{ fontWeight: 600, fontSize: 12, color: log.exitCode === 0 ? '#73bf69' : '#f2495c' }}>
                      {log.exitCode === 0 ? '✅ Success' : `❌ Failed (exit ${log.exitCode})`}
                    </span>
                    <span style={{ fontSize: 11, color: T.dim }}>{new Date(log.ts).toLocaleString()}</span>
                    <span style={{ fontSize: 11, color: T.muted }}>{log.duration}ms</span>
                  </div>
                  {log.stdout && (
                    <pre style={{ margin: 0, padding: '8px 12px', fontSize: 11, color: T.text, fontFamily: 'monospace', whiteSpace: 'pre-wrap', maxHeight: 200, overflowY: 'auto' }}>
                      {log.stdout}
                    </pre>
                  )}
                  {log.stderr && (
                    <pre style={{ margin: 0, padding: '8px 12px', fontSize: 11, color: '#f2495c', fontFamily: 'monospace', whiteSpace: 'pre-wrap', maxHeight: 100, overflowY: 'auto', borderTop: `1px solid ${T.border}` }}>
                      {log.stderr}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
