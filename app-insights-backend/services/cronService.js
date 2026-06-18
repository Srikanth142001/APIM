/**
 * Cron Service — manages scheduled jobs with file persistence
 * Uses node-cron for scheduling, child_process for script execution
 */
const fs      = require('fs');
const path    = require('path');
const { exec } = require('child_process');
const cron    = require('node-cron');

const STORAGE_DIR  = process.env.CRON_STORAGE_DIR || '/app/shared';
const JOBS_FILE    = path.join(STORAGE_DIR, 'cron-jobs.json');
const LOGS_DIR     = path.join(STORAGE_DIR, 'cron-logs');
// Scripts are written to /tmp at execution time — works on ephemeral filesystems
// (Azure Container Apps, etc.) since scriptContent is stored in the job JSON
const SCRIPTS_DIR  = '/tmp/cron-scripts';

class CronService {
  constructor() {
    this.jobs    = new Map(); // id → job data
    this.tasks   = new Map(); // id → node-cron task
    this.logs    = new Map(); // id → [{ts, exitCode, stdout, stderr, duration}]

    this._ensureDirs();
    this._loadJobs();
  }

  _ensureDirs() {
    [STORAGE_DIR, SCRIPTS_DIR, LOGS_DIR].forEach(d => {
      if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    });
  }

  // ── Persistence ─────────────────────────────────────────────────────────────
  _loadJobs() {
    try {
      if (!fs.existsSync(JOBS_FILE)) return;
      const saved = JSON.parse(fs.readFileSync(JOBS_FILE, 'utf8'));
      for (const job of saved) {
        this.jobs.set(job.id, job);
        // Load existing logs
        const logFile = path.join(LOGS_DIR, `${job.id}.json`);
        if (fs.existsSync(logFile)) {
          this.logs.set(job.id, JSON.parse(fs.readFileSync(logFile, 'utf8')));
        } else {
          this.logs.set(job.id, []);
        }
        if (job.enabled) this._schedule(job);
      }
      console.log(`✅ Loaded ${this.jobs.size} cron jobs`);
    } catch (err) {
      console.error('⚠️  Failed to load cron jobs:', err.message);
    }
  }

  _saveJobs() {
    try {
      if (!fs.existsSync(STORAGE_DIR)) fs.mkdirSync(STORAGE_DIR, { recursive: true });
      fs.writeFileSync(JOBS_FILE, JSON.stringify(Array.from(this.jobs.values()), null, 2), 'utf8');
    } catch (err) {
      console.error('⚠️  Failed to save cron jobs:', err.message);
    }
  }

  _saveLogs(id) {
    try {
      const entries = this.logs.get(id) || [];
      fs.writeFileSync(path.join(LOGS_DIR, `${id}.json`), JSON.stringify(entries, null, 2), 'utf8');
    } catch (err) {
      console.error('⚠️  Failed to save cron logs:', err.message);
    }
  }

  // ── Schedule a job with node-cron ─────────────────────────────────────────
  _schedule(job) {
    // Stop existing task if any
    if (this.tasks.has(job.id)) {
      this.tasks.get(job.id).stop();
      this.tasks.delete(job.id);
    }
    if (!job.enabled) return;

    if (!cron.validate(job.schedule)) {
      console.warn(`⚠️  Invalid cron expression for job "${job.name}": ${job.schedule}`);
      return;
    }

    const task = cron.schedule(job.schedule, async () => {
      console.log(`🕐 Running cron job: ${job.name} (${job.id})`);
      await this._executeScript(job);
    }, { timezone: process.env.DISPLAY_TIMEZONE || 'UTC' });

    this.tasks.set(job.id, task);
    console.log(`✅ Scheduled cron job "${job.name}" → ${job.schedule}`);
  }

  // ── Execute the script ────────────────────────────────────────────────────
  async _executeScript(job) {
    const scriptPath = path.join(SCRIPTS_DIR, `${job.id}${this._ext(job.scriptType)}`);
    const startTs    = new Date().toISOString();
    const t0         = Date.now();

    // Write script file
    fs.writeFileSync(scriptPath, job.scriptContent, 'utf8');
    if (job.scriptType !== 'batch') fs.chmodSync(scriptPath, 0o755);

    const cmd = this._buildCmd(job.scriptType, scriptPath);

    return new Promise((resolve) => {
      exec(cmd, { timeout: 120000, maxBuffer: 1024 * 512 }, (err, stdout, stderr) => {
        const duration = Date.now() - t0;
        const exitCode = err ? (err.code || 1) : 0;
        const entry = {
          ts: startTs,
          exitCode,
          stdout: (stdout || '').slice(0, 4000),
          stderr: (stderr || err?.message || '').slice(0, 2000),
          duration,
          status: exitCode === 0 ? 'success' : 'failed',
        };

        // Update job last run info
        const j = this.jobs.get(job.id);
        if (j) {
          j.lastRunAt     = startTs;
          j.lastExitCode  = exitCode;
          j.lastStatus    = entry.status;
          j.runCount      = (j.runCount || 0) + 1;
          this.jobs.set(job.id, j);
          this._saveJobs();
        }

        // Append log (keep last 100 entries)
        const logs = this.logs.get(job.id) || [];
        logs.unshift(entry);
        if (logs.length > 100) logs.splice(100);
        this.logs.set(job.id, logs);
        this._saveLogs(job.id);

        console.log(`  ${entry.status === 'success' ? '✅' : '❌'} Job "${job.name}" finished in ${duration}ms (exit ${exitCode})`);
        resolve(entry);
      });
    });
  }

  _ext(type) {
    if (type === 'python')  return '.py';
    if (type === 'batch')   return '.bat';
    if (type === 'powershell') return '.ps1';
    return '.sh'; // default shell
  }

  _buildCmd(type, scriptPath) {
    if (type === 'python')     return `python3 "${scriptPath}"`;
    if (type === 'batch')      return `cmd /c "${scriptPath}"`;
    if (type === 'powershell') return `powershell -ExecutionPolicy Bypass -File "${scriptPath}"`;
    return `sh "${scriptPath}"`; // shell
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────
  createJob(data) {
    if (!cron.validate(data.schedule))
      throw new Error(`Invalid cron expression: "${data.schedule}". Example: "0 * * * *" (every hour)`);

    const id = `cron_${Date.now()}`;
    const job = {
      id,
      name:          data.name.trim(),
      description:   data.description || '',
      schedule:      data.schedule.trim(),
      scriptContent: data.scriptContent,
      scriptName:    data.scriptName || 'script',
      scriptType:    data.scriptType || 'shell',
      enabled:       data.enabled !== false,
      createdAt:     new Date().toISOString(),
      updatedAt:     new Date().toISOString(),
      lastRunAt:     null,
      lastExitCode:  null,
      lastStatus:    null,
      runCount:      0,
    };

    this.jobs.set(id, job);
    this.logs.set(id, []);
    this._saveJobs();
    if (job.enabled) this._schedule(job);
    return job;
  }

  updateJob(id, data) {
    const job = this.jobs.get(id);
    if (!job) throw new Error('Job not found');

    if (data.schedule && data.schedule !== job.schedule && !cron.validate(data.schedule))
      throw new Error(`Invalid cron expression: "${data.schedule}"`);

    Object.assign(job, {
      name:          data.name          !== undefined ? data.name.trim()        : job.name,
      description:   data.description   !== undefined ? data.description        : job.description,
      schedule:      data.schedule      !== undefined ? data.schedule.trim()    : job.schedule,
      scriptContent: data.scriptContent !== undefined ? data.scriptContent      : job.scriptContent,
      scriptName:    data.scriptName    !== undefined ? data.scriptName         : job.scriptName,
      scriptType:    data.scriptType    !== undefined ? data.scriptType         : job.scriptType,
      enabled:       data.enabled       !== undefined ? data.enabled            : job.enabled,
      updatedAt:     new Date().toISOString(),
    });

    this.jobs.set(id, job);
    this._saveJobs();
    this._schedule(job); // reschedule with new settings
    return job;
  }

  deleteJob(id) {
    if (!this.jobs.has(id)) throw new Error('Job not found');
    if (this.tasks.has(id)) { this.tasks.get(id).stop(); this.tasks.delete(id); }
    this.jobs.delete(id);
    this.logs.delete(id);
    this._saveJobs();
    // Clean up script file
    ['sh','py','bat','ps1'].forEach(ext => {
      const p = path.join(SCRIPTS_DIR, `${id}.${ext}`);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    });
  }

  toggleJob(id) {
    const job = this.jobs.get(id);
    if (!job) throw new Error('Job not found');
    job.enabled   = !job.enabled;
    job.updatedAt = new Date().toISOString();
    this.jobs.set(id, job);
    this._saveJobs();
    this._schedule(job);
    return job;
  }

  async runJobNow(id) {
    const job = this.jobs.get(id);
    if (!job) throw new Error('Job not found');
    return this._executeScript(job);
  }

  listJobs() {
    return Array.from(this.jobs.values()).map(j => ({
      ...j,
      scriptContent: undefined, // don't send full script in list
      isRunning: false,
    }));
  }

  getJobWithScript(id) {
    return this.jobs.get(id) || null;
  }

  getLogs(id, limit = 50) {
    if (!this.jobs.has(id)) throw new Error('Job not found');
    return (this.logs.get(id) || []).slice(0, limit);
  }
}

module.exports = new CronService();
