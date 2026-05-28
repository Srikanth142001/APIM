// ═══════════════════════════════════════════════════════════════════════════════
// KQL Routes - API endpoints for KQL dashboard management
// ═══════════════════════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const kqlService = require('../services/kqlService');
const kqlDashboardService = require('../services/kqlDashboardService');

// Admin check middleware — checks JWT role field
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

// ── Execute KQL Query ─────────────────────────────────────────────────────────
router.post('/query', async (req, res) => {
  try {
    const { query, timespan } = req.body;

    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Query is required'
      });
    }

    const result = await kqlService.executeQuery(query, timespan || 'PT1H');
    res.json(result);

  } catch (error) {
    console.error('KQL query error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ── Execute Multiple Queries ──────────────────────────────────────────────────
router.post('/query/multiple', async (req, res) => {
  try {
    const { queries, timespan } = req.body;

    if (!queries || !Array.isArray(queries) || queries.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Queries array is required'
      });
    }

    const result = await kqlService.executeMultipleQueries(queries, timespan || 'PT1H');
    res.json(result);

  } catch (error) {
    console.error('Multiple KQL query error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ── Get Schema ────────────────────────────────────────────────────────────────
router.get('/schema', async (req, res) => {
  try {
    const result = await kqlService.getSchema();
    res.json(result);
  } catch (error) {
    console.error('Schema fetch error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ── Get Query Suggestions ─────────────────────────────────────────────────────
router.get('/suggestions', (req, res) => {
  const suggestions = kqlService.getQuerySuggestions();
  res.json({
    success: true,
    suggestions
  });
});

// ── Test Connection ───────────────────────────────────────────────────────────
router.get('/test', async (req, res) => {
  try {
    const result = await kqlService.testConnection();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// DASHBOARD MANAGEMENT
// ══════════════════════════════════════════════════════════════════════════════

// ── Get All Dashboards ────────────────────────────────────────────────────────
router.get('/dashboards', (req, res) => {
  try {
    const dashboards = kqlDashboardService.getDashboards();
    res.json({
      success: true,
      dashboards
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ── Create Dashboard (Admin Only) ─────────────────────────────────────────────
router.post('/dashboards', requireAdmin, (req, res) => {
  try {
    const { name, description, layout } = req.body;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Dashboard name is required'
      });
    }

    const dashboard = kqlDashboardService.createDashboard(
      { name, description, layout },
      req.user.username
    );
    
    res.json({
      success: true,
      dashboard
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ── Get Dashboard ─────────────────────────────────────────────────────────────
router.get('/dashboards/:id', (req, res) => {
  try {
    const { id } = req.params;
    const dashboard = kqlDashboardService.getDashboard(id);
    
    if (!dashboard) {
      return res.status(404).json({
        success: false,
        message: 'Dashboard not found'
      });
    }

    const panels = kqlDashboardService.getDashboardPanels(id);
    
    res.json({
      success: true,
      dashboard: {
        ...dashboard,
        panelDetails: panels
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ── Update Dashboard (Admin Only) ─────────────────────────────────────────────
router.put('/dashboards/:id', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, layout } = req.body;
    
    const dashboard = kqlDashboardService.updateDashboard(
      id,
      { name, description, layout },
      req.user.username
    );
    
    res.json({
      success: true,
      dashboard
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ── Delete Dashboard (Admin Only) ─────────────────────────────────────────────
router.delete('/dashboards/:id', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const result = kqlDashboardService.deleteDashboard(id);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ── Create Panel (Admin Only) ─────────────────────────────────────────────────
router.post('/dashboards/:dashboardId/panels', requireAdmin, (req, res) => {
  try {
    const { dashboardId } = req.params;
    const panelData = req.body;
    
    if (!panelData.title || !panelData.queries || panelData.queries.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Title and at least one query are required'
      });
    }

    const panel = kqlDashboardService.createPanel(
      dashboardId,
      panelData,
      req.user.username
    );
    
    res.json({
      success: true,
      panel
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ── Get Dashboard Panels ──────────────────────────────────────────────────────
router.get('/dashboards/:dashboardId/panels', (req, res) => {
  try {
    const { dashboardId } = req.params;
    const panels = kqlDashboardService.getDashboardPanels(dashboardId);
    res.json({
      success: true,
      panels
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ── Update Panel (Admin Only) ─────────────────────────────────────────────────
router.put('/panels/:id', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const panelData = req.body;
    
    const panel = kqlDashboardService.updatePanel(
      id,
      panelData,
      req.user.username
    );
    
    res.json({
      success: true,
      panel
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ── Delete Panel (Admin Only) ─────────────────────────────────────────────────
router.delete('/panels/:id', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const result = kqlDashboardService.deletePanel(id);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ── Duplicate Panel (Admin Only) ──────────────────────────────────────────────
router.post('/panels/:id/duplicate', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const panel = kqlDashboardService.duplicatePanel(id, req.user.username);
    res.json({
      success: true,
      panel
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ── Execute Panel Queries ─────────────────────────────────────────────────────
router.post('/panels/:id/execute', async (req, res) => {
  try {
    const { id } = req.params;
    const panel = kqlDashboardService.getPanel(id);
    
    if (!panel) {
      return res.status(404).json({
        success: false,
        message: 'Panel not found'
      });
    }

    const result = await kqlService.executeMultipleQueries(
      panel.queries,
      panel.timeRange
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ── Export Dashboard ──────────────────────────────────────────────────────────
router.get('/dashboards/:id/export', (req, res) => {
  try {
    const { id } = req.params;
    const exportData = kqlDashboardService.exportDashboard(id);
    res.json({
      success: true,
      data: exportData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ── Import Dashboard (Admin Only) ─────────────────────────────────────────────
router.post('/dashboards/import', requireAdmin, (req, res) => {
  try {
    const { data } = req.body;
    
    if (!data) {
      return res.status(400).json({
        success: false,
        message: 'Dashboard data is required'
      });
    }

    const dashboard = kqlDashboardService.importDashboard(data, req.user.username);
    res.json({
      success: true,
      dashboard
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
