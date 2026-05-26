# 📊 Grafana-Like Custom Database Query Feature

## Overview

A comprehensive database monitoring and visualization platform similar to Grafana, allowing users to:
- Create multiple dashboards
- Add panels with different visualizations
- Execute custom queries safely
- Auto-refresh panels
- Export/import dashboards
- Drag-and-drop panel arrangement

---

## ✨ Features Implemented

### 1. **Dashboard Management**
- ✅ Create multiple dashboards
- ✅ Edit dashboard name and description
- ✅ Delete dashboards (except default)
- ✅ Switch between dashboards
- ✅ Export dashboard configuration (JSON)
- ✅ Import dashboard from JSON

### 2. **Panel Types (Visualizations)**
- ✅ **Table** - Tabular data display
- ✅ **Line Chart** - Time series and trends
- ✅ **Bar Chart** - Comparisons and distributions
- ✅ **Pie Chart** - Proportions and percentages
- ✅ **Stat** - Single value with trend
- ✅ **Gauge** - Progress and thresholds

### 3. **Panel Features**
- ✅ Add new panel with query editor
- ✅ Edit existing panels
- ✅ Duplicate panels
- ✅ Delete panels
- ✅ Auto-refresh (configurable interval)
- ✅ Manual refresh
- ✅ Full-screen mode
- ✅ Panel positioning (grid layout)

### 4. **Query Editor**
- ✅ SQL syntax highlighting (monospace)
- ✅ Multi-line query support
- ✅ Query validation
- ✅ Test query before saving
- ✅ Query templates for common patterns

### 5. **Safety Features**
- ✅ Read-only database connections
- ✅ Query validation (only SELECT allowed)
- ✅ 30-second query timeout
- ✅ Connection pooling (max 5 per DB)
- ✅ No database locking
- ✅ Error handling and display

---

## 🎨 Visualization Types

### 1. Table
**Best for:** Raw data, detailed records, logs

**Features:**
- Sortable columns
- Pagination
- Search/filter
- Column formatting
- NULL value handling

**Example Query:**
```sql
SELECT 
  id,
  name,
  email,
  created_at,
  status
FROM users
ORDER BY created_at DESC
LIMIT 100;
```

### 2. Line Chart
**Best for:** Time series, trends, continuous data

**Features:**
- Multiple series support
- X-axis: timestamp or numeric
- Y-axis: numeric values
- Tooltips on hover
- Legend
- Grid lines

**Example Query:**
```sql
SELECT 
  DATE(created_at) as date,
  COUNT(*) as count
FROM orders
WHERE created_at > CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date;
```

**Required columns:**
- X-axis column (date/time/number)
- One or more Y-axis columns (numbers)

### 3. Bar Chart
**Best for:** Comparisons, categories, distributions

**Features:**
- Horizontal or vertical bars
- Multiple series
- Stacked bars option
- Color coding
- Value labels

**Example Query:**
```sql
SELECT 
  category,
  COUNT(*) as total,
  SUM(amount) as revenue
FROM products
GROUP BY category
ORDER BY total DESC
LIMIT 10;
```

**Required columns:**
- Category column (text)
- One or more value columns (numbers)

### 4. Pie Chart
**Best for:** Proportions, percentages, parts of whole

**Features:**
- Percentage labels
- Legend
- Color coding
- Hover tooltips
- Donut mode option

**Example Query:**
```sql
SELECT 
  status,
  COUNT(*) as count
FROM orders
GROUP BY status;
```

**Required columns:**
- Name column (text)
- Value column (number)

### 5. Stat (Single Value)
**Best for:** KPIs, metrics, single numbers

**Features:**
- Large number display
- Unit formatting
- Trend indicator (up/down)
- Color thresholds
- Sparkline (mini chart)

**Example Query:**
```sql
SELECT COUNT(*) as total_users FROM users;
```

**Required:**
- Single row, single column with number

### 6. Gauge
**Best for:** Progress, capacity, thresholds

**Features:**
- Semi-circle or full-circle
- Min/max values
- Color thresholds (green/yellow/red)
- Current value display
- Percentage mode

**Example Query:**
```sql
SELECT 
  (COUNT(CASE WHEN status = 'active' THEN 1 END)::float / COUNT(*)::float * 100) as active_percentage
FROM users;
```

**Required:**
- Single row, single column with number (0-100 for percentage)

---

## 🔧 Panel Configuration Options

### Common Options (All Panels)
```javascript
{
  title: "Panel Title",
  description: "Panel description",
  connectionId: "conn_123",
  query: "SELECT ...",
  visualizationType: "table|line|bar|pie|stat|gauge",
  refreshInterval: 0, // 0=manual, 30=30sec, 60=1min, etc.
  position: { x: 0, y: 0, w: 6, h: 4 } // Grid position
}
```

### Line Chart Options
```javascript
{
  xAxisColumn: "date",      // Column for X-axis
  yAxisColumns: ["count", "revenue"], // Columns for Y-axis
  showGrid: true,
  showLegend: true,
  curveType: "monotone"     // monotone, linear, step
}
```

### Bar Chart Options
```javascript
{
  categoryColumn: "category",
  valueColumns: ["total", "revenue"],
  orientation: "vertical",  // vertical or horizontal
  stacked: false
}
```

### Pie Chart Options
```javascript
{
  nameColumn: "status",
  valueColumn: "count",
  showPercentage: true,
  donutMode: false
}
```

### Stat Options
```javascript
{
  unit: "",                 // "", "%", "ms", "MB", etc.
  decimals: 2,
  colorMode: "value",       // value, background, none
  thresholds: [
    { value: 0, color: "green" },
    { value: 50, color: "yellow" },
    { value: 80, color: "red" }
  ]
}
```

### Gauge Options
```javascript
{
  min: 0,
  max: 100,
  unit: "%",
  thresholds: [
    { value: 0, color: "green" },
    { value: 70, color: "yellow" },
    { value: 90, color: "red" }
  ]
}
```

---

## 📐 Dashboard Layout

### Grid System
- 12-column grid
- Each panel has position: `{ x, y, w, h }`
  - `x`: Column position (0-11)
  - `y`: Row position (0-∞)
  - `w`: Width in columns (1-12)
  - `h`: Height in rows (1-∞)

### Default Panel Sizes
- **Small**: 3x3 (quarter width)
- **Medium**: 6x4 (half width)
- **Large**: 12x4 (full width)
- **Tall**: 6x6 (half width, tall)

### Auto-Layout
- New panels automatically positioned
- No overlapping
- Responsive on smaller screens

---

## 🔄 Auto-Refresh

### Refresh Intervals
- **Manual** (0): No auto-refresh
- **10 seconds**: Real-time monitoring
- **30 seconds**: Frequent updates
- **1 minute**: Regular updates
- **5 minutes**: Periodic checks
- **15 minutes**: Slow-changing data
- **30 minutes**: Hourly trends
- **1 hour**: Daily summaries

### Implementation
```javascript
// Panel with 30-second refresh
{
  refreshInterval: 30,
  // ... other config
}
```

### Refresh Behavior
- Only refreshes visible panels
- Pauses when tab is inactive
- Shows last update time
- Loading indicator during refresh
- Error handling (continues on error)

---

## 💾 Export/Import

### Export Dashboard
```json
{
  "dashboard": {
    "name": "Production Monitoring",
    "description": "Real-time production metrics"
  },
  "panels": [
    {
      "title": "Active Users",
      "query": "SELECT COUNT(*) FROM users WHERE status='active'",
      "visualizationType": "stat",
      "refreshInterval": 30,
      "position": { "x": 0, "y": 0, "w": 3, "h": 3 },
      "options": { "unit": "", "decimals": 0 }
    },
    // ... more panels
  ]
}
```

### Import Dashboard
1. Click "Import Dashboard"
2. Paste JSON configuration
3. Select database connection
4. Click "Import"
5. Dashboard created with all panels

---

## 🎯 Use Cases

### 1. Real-Time Monitoring
```sql
-- Active sessions
SELECT COUNT(*) as active_sessions 
FROM sessions 
WHERE last_activity > NOW() - INTERVAL '5 minutes';

-- Requests per minute
SELECT 
  DATE_TRUNC('minute', created_at) as minute,
  COUNT(*) as requests
FROM api_logs
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY minute
ORDER BY minute;
```

### 2. Business Metrics
```sql
-- Revenue today
SELECT SUM(amount) as revenue
FROM orders
WHERE DATE(created_at) = CURRENT_DATE;

-- Orders by status
SELECT status, COUNT(*) as count
FROM orders
WHERE created_at > CURRENT_DATE - INTERVAL '7 days'
GROUP BY status;
```

### 3. Performance Monitoring
```sql
-- Slow queries
SELECT 
  query_type,
  AVG(duration_ms) as avg_duration,
  MAX(duration_ms) as max_duration
FROM query_logs
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY query_type;

-- Database size
SELECT 
  schemaname,
  pg_size_pretty(SUM(pg_total_relation_size(schemaname||'.'||tablename))) as size
FROM pg_tables
GROUP BY schemaname;
```

### 4. User Analytics
```sql
-- New users per day
SELECT 
  DATE(created_at) as date,
  COUNT(*) as new_users
FROM users
WHERE created_at > CURRENT_DATE - INTERVAL '30 days'
GROUP BY date
ORDER BY date;

-- User distribution by country
SELECT 
  country,
  COUNT(*) as users
FROM users
GROUP BY country
ORDER BY users DESC
LIMIT 10;
```

---

## 🚀 Quick Start Guide

### Step 1: Create Connection
1. Go to "Custom DB Query" page
2. Click "+ New Connection"
3. Enter PostgreSQL details
4. Test and save

### Step 2: Create Dashboard
1. Click "+ New Dashboard"
2. Enter name: "Production Monitoring"
3. Click "Create"

### Step 3: Add First Panel
1. Click "+ Add Panel"
2. Select connection
3. Choose visualization type: "Stat"
4. Enter query:
   ```sql
   SELECT COUNT(*) as total FROM users;
   ```
5. Set title: "Total Users"
6. Click "Save Panel"

### Step 4: Add More Panels
Repeat step 3 with different queries and visualizations:
- Line chart for trends
- Bar chart for comparisons
- Pie chart for distributions
- Table for detailed data

### Step 5: Configure Auto-Refresh
1. Edit panel
2. Set refresh interval: "30 seconds"
3. Save

### Step 6: Arrange Panels
- Drag panels to reposition
- Resize by dragging corners
- Create logical groupings

---

## 📊 Example Dashboard Configurations

### Dashboard 1: System Health
```json
{
  "dashboard": {
    "name": "System Health",
    "description": "Real-time system monitoring"
  },
  "panels": [
    {
      "title": "Active Users",
      "query": "SELECT COUNT(*) FROM sessions WHERE active=true",
      "visualizationType": "stat",
      "refreshInterval": 10
    },
    {
      "title": "CPU Usage",
      "query": "SELECT timestamp, cpu_percent FROM metrics WHERE timestamp > NOW() - INTERVAL '1 hour' ORDER BY timestamp",
      "visualizationType": "line",
      "refreshInterval": 30
    },
    {
      "title": "Memory Usage",
      "query": "SELECT (used_memory::float / total_memory::float * 100) as percentage FROM system_info LIMIT 1",
      "visualizationType": "gauge",
      "refreshInterval": 30
    }
  ]
}
```

### Dashboard 2: Business Metrics
```json
{
  "dashboard": {
    "name": "Business Metrics",
    "description": "Key business indicators"
  },
  "panels": [
    {
      "title": "Today's Revenue",
      "query": "SELECT SUM(amount) FROM orders WHERE DATE(created_at) = CURRENT_DATE",
      "visualizationType": "stat",
      "refreshInterval": 60
    },
    {
      "title": "Orders by Status",
      "query": "SELECT status, COUNT(*) as count FROM orders GROUP BY status",
      "visualizationType": "pie",
      "refreshInterval": 60
    },
    {
      "title": "Revenue Trend (30 days)",
      "query": "SELECT DATE(created_at) as date, SUM(amount) as revenue FROM orders WHERE created_at > CURRENT_DATE - INTERVAL '30 days' GROUP BY date ORDER BY date",
      "visualizationType": "line",
      "refreshInterval": 300
    }
  ]
}
```

---

## 🔒 Security & Safety

### Database Protection
1. **Read-Only Mode**: All connections use `SET TRANSACTION READ ONLY`
2. **Query Validation**: Server-side validation blocks write operations
3. **Connection Limits**: Max 5 connections per database
4. **Query Timeout**: 30-second limit prevents long-running queries
5. **No Locking**: Read-only mode prevents any database locks

### Best Practices
1. Create dedicated read-only database users
2. Use SSL for production connections
3. Limit query result sizes with `LIMIT` clause
4. Use indexes for better performance
5. Monitor query execution times
6. Set appropriate refresh intervals
7. Don't expose sensitive data in dashboards

---

## 📱 Responsive Design

- Desktop: Full grid layout with drag-and-drop
- Tablet: 2-column layout
- Mobile: Single column, stacked panels
- Touch-friendly controls
- Optimized for all screen sizes

---

## 🎨 Theming

- Light and dark mode support
- Consistent with main dashboard theme
- Color-coded visualizations
- Accessible color schemes
- Customizable panel colors

---

## 🔮 Future Enhancements

- [ ] Variables and templating
- [ ] Alerts and notifications
- [ ] Annotations
- [ ] Query history
- [ ] Saved query library
- [ ] Team collaboration
- [ ] Role-based access control
- [ ] MySQL and SQL Server support
- [ ] CSV/Excel export
- [ ] PDF report generation
- [ ] Scheduled reports
- [ ] Webhook integrations

---

## 📚 API Reference

See `CUSTOM_DB_QUERY_GUIDE.md` for complete API documentation.

---

## 🎉 Summary

This Grafana-like feature provides a powerful, safe, and user-friendly way to monitor PostgreSQL databases with:

✅ Multiple visualization types
✅ Dashboard management
✅ Auto-refresh capabilities
✅ Export/import functionality
✅ Complete database safety
✅ No performance impact
✅ Professional UI/UX

Perfect for real-time monitoring, business intelligence, and data exploration!

