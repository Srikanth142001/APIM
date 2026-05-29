// ═══════════════════════════════════════════════════════════════════════════════
// Custom Database Query Routes
// API endpoints for managing database connections and executing queries
// ═══════════════════════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const customDbService = require('../services/customDbService');
const customDbPanelService = require('../services/customDbPanelService');

// ── Role middleware — admin only for write operations ─────────────────────────
const requireAdmin = (req, res, next) => {
  const role = req.user?.role || '';
  if (role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required. Your account has read-only access.'
    });
  }
  next();
};

// ── Test Database Connection ──────────────────────────────────────────────────
router.post('/connections/test', async (req, res) => {
  try {
    const { host, port, database, username, password, ssl } = req.body;

    if (!host || !database || !username) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: host, database, username'
      });
    }

    const result = await customDbService.testConnection({
      host,
      port: port || 5432,
      database,
      username,
      password,
      ssl: ssl || false
    });

    res.json(result);

  } catch (error) {
    console.error('Test connection error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ── Create/Update Database Connection ─────────────────────────────────────────
router.post('/connections', requireAdmin, async (req, res) => {
  try {
    const { id, name, host, port, database, username, password, ssl } = req.body;

    if (!id || !name || !host || !database || !username) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: id, name, host, database, username'
      });
    }

    const result = await customDbService.createConnection(id, {
      name,
      host,
      port: port || 5432,
      database,
      username,
      password,
      ssl: ssl || false
    });

    res.json(result);

  } catch (error) {
    console.error('Create connection error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ── Get All Connections ───────────────────────────────────────────────────────
router.get('/connections', async (req, res) => {
  try {
    const connections = customDbService.getConnections();
    res.json({
      success: true,
      connections
    });
  } catch (error) {
    console.error('Get connections error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ── Delete Connection ─────────────────────────────────────────────────────────
router.delete('/connections/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await customDbService.closeConnection(id);
    res.json(result);
  } catch (error) {
    console.error('Delete connection error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ── Execute Query ─────────────────────────────────────────────────────────────
router.post('/query', async (req, res) => {
  try {
    const { connectionId, query, params } = req.body;

    if (!connectionId || !query) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: connectionId, query'
      });
    }

    const result = await customDbService.executeQuery(
      connectionId,
      query,
      params || []
    );

    res.json(result);

  } catch (error) {
    console.error('Query execution error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ── Get Tables ────────────────────────────────────────────────────────────────
router.get('/connections/:id/tables', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await customDbService.getTables(id);
    res.json(result);
  } catch (error) {
    console.error('Get tables error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ── Get Table Schema ──────────────────────────────────────────────────────────
router.get('/connections/:id/tables/:schema/:table', async (req, res) => {
  try {
    const { id, schema, table } = req.params;
    const result = await customDbService.getTableSchema(id, schema, table);
    res.json(result);
  } catch (error) {
    console.error('Get table schema error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// DASHBOARD & PANEL MANAGEMENT (Grafana-like)
// ══════════════════════════════════════════════════════════════════════════════

// ── Get All Dashboards ────────────────────────────────────────────────────────
router.get('/dashboards', async (req, res) => {
  try {
    const dashboards = customDbPanelService.getDashboards();
    res.json({
      success: true,
      dashboards
    });
  } catch (error) {
    console.error('Get dashboards error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ── Create Dashboard ──────────────────────────────────────────────────────────
router.post('/dashboards', requireAdmin, async (req, res) => {
  try {
    const { name, description } = req.body;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Dashboard name is required'
      });
    }

    const dashboard = customDbPanelService.createDashboard({ name, description });
    res.json({
      success: true,
      dashboard
    });
  } catch (error) {
    console.error('Create dashboard error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ── Get Dashboard ─────────────────────────────────────────────────────────────
router.get('/dashboards/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const dashboard = customDbPanelService.getDashboard(id);
    
    if (!dashboard) {
      return res.status(404).json({
        success: false,
        message: 'Dashboard not found'
      });
    }

    const panels = customDbPanelService.getDashboardPanels(id);
    
    res.json({
      success: true,
      dashboard: {
        ...dashboard,
        panelDetails: panels
      }
    });
  } catch (error) {
    console.error('Get dashboard error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ── Update Dashboard ──────────────────────────────────────────────────────────
router.put('/dashboards/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    
    const dashboard = customDbPanelService.updateDashboard(id, { name, description });
    res.json({
      success: true,
      dashboard
    });
  } catch (error) {
    console.error('Update dashboard error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ── Delete Dashboard ──────────────────────────────────────────────────────────
router.delete('/dashboards/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = customDbPanelService.deleteDashboard(id);
    res.json(result);
  } catch (error) {
    console.error('Delete dashboard error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ── Create Panel ──────────────────────────────────────────────────────────────
router.post('/dashboards/:dashboardId/panels', requireAdmin, async (req, res) => {
  try {
    const { dashboardId } = req.params;
    const panelData = req.body;
    
    if (!panelData.title || !panelData.connectionId || !panelData.query) {
      return res.status(400).json({
        success: false,
        message: 'Title, connectionId, and query are required'
      });
    }

    const panel = customDbPanelService.createPanel(dashboardId, panelData);
    res.json({
      success: true,
      panel
    });
  } catch (error) {
    console.error('Create panel error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ── Get Dashboard Panels ──────────────────────────────────────────────────────
router.get('/dashboards/:dashboardId/panels', async (req, res) => {
  try {
    const { dashboardId } = req.params;
    const panels = customDbPanelService.getDashboardPanels(dashboardId);
    res.json({
      success: true,
      panels
    });
  } catch (error) {
    console.error('Get panels error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ── Update Panel ──────────────────────────────────────────────────────────────
router.put('/panels/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const panelData = req.body;
    
    const panel = customDbPanelService.updatePanel(id, panelData);
    res.json({
      success: true,
      panel
    });
  } catch (error) {
    console.error('Update panel error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ── Delete Panel ──────────────────────────────────────────────────────────────
router.delete('/panels/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = customDbPanelService.deletePanel(id);
    res.json(result);
  } catch (error) {
    console.error('Delete panel error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ── Duplicate Panel ───────────────────────────────────────────────────────────
router.post('/panels/:id/duplicate', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const panel = customDbPanelService.duplicatePanel(id);
    res.json({
      success: true,
      panel
    });
  } catch (error) {
    console.error('Duplicate panel error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ── Execute Panel Query (supports multi-query with different connections) ──────
router.post('/panels/:id/execute', async (req, res) => {
  try {
    const { id } = req.params;
    const panel = customDbPanelService.getPanel(id);

    if (!panel) {
      return res.status(404).json({ success: false, message: 'Panel not found' });
    }

    // Multi-query mode: panel.queries = [{id, label, connectionId, query, color}]
    if (panel.queries && panel.queries.length > 0) {
      const results = await Promise.allSettled(
        panel.queries.map(async (q) => {
          try {
            const result = await customDbService.executeQuery(q.connectionId, q.query, []);
            return { id: q.id, label: q.label, color: q.color, success: true, data: result };
          } catch (err) {
            return { id: q.id, label: q.label, color: q.color, success: false, error: err.message };
          }
        })
      );

      return res.json({
        success: true,
        multiQuery: true,
        queries: results.map(r => r.status === 'fulfilled' ? r.value : { success: false, error: r.reason?.message }),
      });
    }

    // Legacy single-query mode (backward compatible)
    const result = await customDbService.executeQuery(panel.connectionId, panel.query, []);
    res.json(result);

  } catch (error) {
    console.error('Execute panel query error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── Export Dashboard ──────────────────────────────────────────────────────────
router.get('/dashboards/:id/export', async (req, res) => {
  try {
    const { id } = req.params;
    const exportData = customDbPanelService.exportDashboard(id);
    res.json({
      success: true,
      data: exportData
    });
  } catch (error) {
    console.error('Export dashboard error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ── Import Dashboard ──────────────────────────────────────────────────────────
router.post('/dashboards/import', requireAdmin, async (req, res) => {
  try {
    const { data, connectionId } = req.body;
    
    if (!data || !connectionId) {
      return res.status(400).json({
        success: false,
        message: 'Dashboard data and connectionId are required'
      });
    }

    const dashboard = customDbPanelService.importDashboard(data, connectionId);
    res.json({
      success: true,
      dashboard
    });
  } catch (error) {
    console.error('Import dashboard error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
