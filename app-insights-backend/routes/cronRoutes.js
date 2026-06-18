/**
 * Cron Job Scheduler Routes
 * POST   /api/cron/jobs          — create a new job (admin only)
 * GET    /api/cron/jobs          — list all jobs
 * PUT    /api/cron/jobs/:id      — update a job (admin only)
 * DELETE /api/cron/jobs/:id      — delete a job (admin only)
 * POST   /api/cron/jobs/:id/toggle — enable / disable
 * POST   /api/cron/jobs/:id/run    — run immediately
 * GET    /api/cron/jobs/:id/logs   — last N execution logs
 */
const express = require('express');
const router  = express.Router();
const cronService = require('../services/cronService');

const requireAdmin = (req, res, next) => {
  if ((req.user?.role || '') !== 'admin')
    return res.status(403).json({ success: false, message: 'Admin access required' });
  next();
};

// ── Get single job (with scriptContent) ──────────────────────────────────────
router.get('/jobs/:id', (req, res) => {
  try {
    const job = cronService.getJobWithScript(req.params.id);
    if (!job) return res.status(404).json({ success: false, message: 'Job not found' });
    res.json({ success: true, job });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── List all jobs ─────────────────────────────────────────────────────────────
router.get('/jobs', (req, res) => {
  try {
    res.json({ success: true, jobs: cronService.listJobs() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Create job ────────────────────────────────────────────────────────────────
router.post('/jobs', requireAdmin, (req, res) => {
  try {
    const { name, description, schedule, scriptContent, scriptName, scriptType, enabled } = req.body;
    if (!name || !schedule || !scriptContent)
      return res.status(400).json({ success: false, message: 'name, schedule and scriptContent are required' });
    const job = cronService.createJob({ name, description, schedule, scriptContent, scriptName, scriptType, enabled });
    res.json({ success: true, job });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// ── Update job ────────────────────────────────────────────────────────────────
router.put('/jobs/:id', requireAdmin, (req, res) => {
  try {
    const job = cronService.updateJob(req.params.id, req.body);
    res.json({ success: true, job });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// ── Delete job ────────────────────────────────────────────────────────────────
router.delete('/jobs/:id', requireAdmin, (req, res) => {
  try {
    cronService.deleteJob(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// ── Toggle enabled / disabled ─────────────────────────────────────────────────
router.post('/jobs/:id/toggle', requireAdmin, (req, res) => {
  try {
    const job = cronService.toggleJob(req.params.id);
    res.json({ success: true, job });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// ── Run immediately ───────────────────────────────────────────────────────────
router.post('/jobs/:id/run', requireAdmin, async (req, res) => {
  try {
    const result = await cronService.runJobNow(req.params.id);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Execution logs ────────────────────────────────────────────────────────────
router.get('/jobs/:id/logs', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const logs = cronService.getLogs(req.params.id, limit);
    res.json({ success: true, logs });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

module.exports = router;
