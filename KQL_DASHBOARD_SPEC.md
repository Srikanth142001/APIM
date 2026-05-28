# KQL Dashboard Feature Specification

## Overview
Custom KQL dashboard for Azure Application Insights with admin-controlled editing and multi-query comparison.

## Features

### 1. KQL Query Editor
- Syntax highlighting for KQL
- Query validation
- Test query before saving
- Save queries to panels
- Support multiple queries per panel (for comparison)

### 2. Visualizations
- **Time Series Chart** - Line/Area charts for time-based data
- **Bar Chart** - Horizontal/Vertical bars
- **Pie/Donut Chart** - Distribution visualization
- **Table** - Raw data display
- **Stat** - Single value with trend
- **Heatmap** - Time-based intensity map
- **Multi-Query Overlay** - Compare multiple queries on same chart

### 3. Access Control
- **Admin Role**: Full edit access (create/edit/delete panels)
- **Viewer Role**: Read-only access (view dashboards only)
- Role determined by JWT token

### 4. Dashboard Management
- Create multiple dashboards
- Add/edit/delete panels
- Drag-and-drop panel layout
- Export/import dashboard configurations
- Auto-refresh intervals

### 5. Multi-Query Comparison
- Add multiple queries to single panel
- Each query gets unique color
- Legend shows query labels
- Overlay on same chart for comparison

## Technical Implementation

### Backend Routes
```
POST   /api/kql/query              - Execute KQL query
GET    /api/kql/dashboards         - List all dashboards
POST   /api/kql/dashboards         - Create dashboard (admin only)
GET    /api/kql/dashboards/:id     - Get dashboard
PUT    /api/kql/dashboards/:id     - Update dashboard (admin only)
DELETE /api/kql/dashboards/:id     - Delete dashboard (admin only)
POST   /api/kql/panels             - Create panel (admin only)
PUT    /api/kql/panels/:id         - Update panel (admin only)
DELETE /api/kql/panels/:id         - Delete panel (admin only)
```

### Data Models

**Dashboard:**
```json
{
  "id": "dashboard_123",
  "name": "Production Monitoring",
  "description": "Main production dashboard",
  "panels": ["panel_1", "panel_2"],
  "layout": {...},
  "createdBy": "admin",
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z"
}
```

**Panel:**
```json
{
  "id": "panel_1",
  "dashboardId": "dashboard_123",
  "title": "Request Rate",
  "queries": [
    {
      "id": "query_1",
      "label": "Production",
      "kql": "requests | summarize count() by bin(timestamp, 5m)",
      "color": "#3b82f6"
    },
    {
      "id": "query_2",
      "label": "Staging",
      "kql": "requests | where cloud_RoleName == 'staging' | summarize count() by bin(timestamp, 5m)",
      "color": "#10b981"
    }
  ],
  "visualizationType": "timeseries",
  "refreshInterval": 60,
  "timeRange": "PT1H",
  "options": {...}
}
```

### Frontend Components
```
/src/pages/KqlDashboard.js           - Main dashboard page
/src/components/kql/
  ├── KqlEditor.jsx                  - Query editor with syntax highlighting
  ├── PanelEditor.jsx                - Panel configuration modal
  ├── MultiQueryEditor.jsx           - Manage multiple queries
  ├── visualizations/
  │   ├── TimeSeriesChart.jsx        - Time-based line/area chart
  │   ├── BarChart.jsx               - Bar chart
  │   ├── PieChart.jsx               - Pie/donut chart
  │   ├── TableViz.jsx               - Table view
  │   ├── StatViz.jsx                - Single stat
  │   └── Heatmap.jsx                - Heatmap visualization
  └── Panel.jsx                      - Panel container with auto-refresh
```

## Security
- Admin check on all edit operations
- JWT token validation
- KQL query timeout (30s max)
- Rate limiting on query execution

## Storage
- File-based persistence in `/app/shared/kql-dashboards.json`
- Survives container restarts with volume mount

## Next Steps
1. Create backend KQL service
2. Add KQL routes with admin middleware
3. Create frontend KQL dashboard page
4. Implement multi-query editor
5. Add visualization components
6. Test and refine
