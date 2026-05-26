// ═══════════════════════════════════════════════════════════════════════════════
// Custom Database Panel Service - Grafana-like Dashboard Management
// Manages saved queries, visualizations, and dashboard panels
// ═══════════════════════════════════════════════════════════════════════════════

class CustomDbPanelService {
  constructor() {
    // Store dashboards and panels in memory
    // In production, this should be stored in a database
    this.dashboards = new Map();
    this.panels = new Map();
    
    // Initialize with a default dashboard
    this.createDefaultDashboard();
  }

  /**
   * Create default dashboard
   */
  createDefaultDashboard() {
    const defaultDashboard = {
      id: 'default',
      name: 'Default Dashboard',
      description: 'Your main monitoring dashboard',
      panels: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.dashboards.set('default', defaultDashboard);
  }

  /**
   * Create a new dashboard
   */
  createDashboard(data) {
    const id = data.id || `dashboard_${Date.now()}`;
    const dashboard = {
      id,
      name: data.name,
      description: data.description || '',
      panels: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.dashboards.set(id, dashboard);
    return dashboard;
  }

  /**
   * Get all dashboards
   */
  getDashboards() {
    return Array.from(this.dashboards.values());
  }

  /**
   * Get a specific dashboard
   */
  getDashboard(id) {
    return this.dashboards.get(id);
  }

  /**
   * Update dashboard
   */
  updateDashboard(id, data) {
    const dashboard = this.dashboards.get(id);
    if (!dashboard) {
      throw new Error('Dashboard not found');
    }
    
    Object.assign(dashboard, {
      name: data.name || dashboard.name,
      description: data.description !== undefined ? data.description : dashboard.description,
      updatedAt: new Date()
    });
    
    return dashboard;
  }

  /**
   * Delete dashboard
   */
  deleteDashboard(id) {
    if (id === 'default') {
      throw new Error('Cannot delete default dashboard');
    }
    
    const dashboard = this.dashboards.get(id);
    if (!dashboard) {
      throw new Error('Dashboard not found');
    }
    
    // Delete all panels in this dashboard
    dashboard.panels.forEach(panelId => {
      this.panels.delete(panelId);
    });
    
    this.dashboards.delete(id);
    return { success: true };
  }

  /**
   * Create a new panel
   */
  createPanel(dashboardId, data) {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) {
      throw new Error('Dashboard not found');
    }

    const id = data.id || `panel_${Date.now()}`;
    const panel = {
      id,
      dashboardId,
      title: data.title,
      description: data.description || '',
      connectionId: data.connectionId,
      query: data.query,
      visualizationType: data.visualizationType || 'table', // table, line, bar, pie, stat, gauge
      refreshInterval: data.refreshInterval || 0, // 0 = manual, or seconds
      position: data.position || { x: 0, y: 0, w: 6, h: 4 },
      options: data.options || {},
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.panels.set(id, panel);
    dashboard.panels.push(id);
    dashboard.updatedAt = new Date();

    return panel;
  }

  /**
   * Get all panels for a dashboard
   */
  getDashboardPanels(dashboardId) {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) {
      throw new Error('Dashboard not found');
    }

    return dashboard.panels.map(panelId => this.panels.get(panelId)).filter(Boolean);
  }

  /**
   * Get a specific panel
   */
  getPanel(id) {
    return this.panels.get(id);
  }

  /**
   * Update panel
   */
  updatePanel(id, data) {
    const panel = this.panels.get(id);
    if (!panel) {
      throw new Error('Panel not found');
    }

    Object.assign(panel, {
      title: data.title !== undefined ? data.title : panel.title,
      description: data.description !== undefined ? data.description : panel.description,
      connectionId: data.connectionId !== undefined ? data.connectionId : panel.connectionId,
      query: data.query !== undefined ? data.query : panel.query,
      visualizationType: data.visualizationType !== undefined ? data.visualizationType : panel.visualizationType,
      refreshInterval: data.refreshInterval !== undefined ? data.refreshInterval : panel.refreshInterval,
      position: data.position !== undefined ? data.position : panel.position,
      options: data.options !== undefined ? data.options : panel.options,
      updatedAt: new Date()
    });

    return panel;
  }

  /**
   * Delete panel
   */
  deletePanel(id) {
    const panel = this.panels.get(id);
    if (!panel) {
      throw new Error('Panel not found');
    }

    // Remove from dashboard
    const dashboard = this.dashboards.get(panel.dashboardId);
    if (dashboard) {
      dashboard.panels = dashboard.panels.filter(panelId => panelId !== id);
      dashboard.updatedAt = new Date();
    }

    this.panels.delete(id);
    return { success: true };
  }

  /**
   * Duplicate panel
   */
  duplicatePanel(id) {
    const panel = this.panels.get(id);
    if (!panel) {
      throw new Error('Panel not found');
    }

    const newPanel = {
      ...panel,
      id: `panel_${Date.now()}`,
      title: `${panel.title} (Copy)`,
      position: {
        ...panel.position,
        y: panel.position.y + panel.position.h + 1
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.panels.set(newPanel.id, newPanel);

    const dashboard = this.dashboards.get(panel.dashboardId);
    if (dashboard) {
      dashboard.panels.push(newPanel.id);
      dashboard.updatedAt = new Date();
    }

    return newPanel;
  }

  /**
   * Export dashboard configuration
   */
  exportDashboard(id) {
    const dashboard = this.dashboards.get(id);
    if (!dashboard) {
      throw new Error('Dashboard not found');
    }

    const panels = dashboard.panels.map(panelId => this.panels.get(panelId)).filter(Boolean);

    return {
      dashboard: {
        name: dashboard.name,
        description: dashboard.description
      },
      panels: panels.map(panel => ({
        title: panel.title,
        description: panel.description,
        query: panel.query,
        visualizationType: panel.visualizationType,
        refreshInterval: panel.refreshInterval,
        position: panel.position,
        options: panel.options
      }))
    };
  }

  /**
   * Import dashboard configuration
   */
  importDashboard(data, connectionId) {
    const dashboard = this.createDashboard({
      name: data.dashboard.name,
      description: data.dashboard.description
    });

    data.panels.forEach(panelData => {
      this.createPanel(dashboard.id, {
        ...panelData,
        connectionId
      });
    });

    return dashboard;
  }
}

// Singleton instance
const customDbPanelService = new CustomDbPanelService();

module.exports = customDbPanelService;
