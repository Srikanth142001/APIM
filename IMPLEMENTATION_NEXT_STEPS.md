# 🚀 Grafana-Like Custom DB Query - Implementation Status & Next Steps

## ✅ What's Complete (Backend)

### 1. Database Connection Service
**File:** `app-insights-backend/services/customDbService.js`

Features:
- ✅ PostgreSQL connection pooling
- ✅ Read-only mode enforcement
- ✅ Query validation (only SELECT allowed)
- ✅ 30-second query timeout
- ✅ Connection management (create, test, delete)
- ✅ Table and schema browsing
- ✅ Safe query execution
- ✅ Automatic cleanup on shutdown

### 2. Panel Management Service
**File:** `app-insights-backend/services/customDbPanelService.js`

Features:
- ✅ Dashboard CRUD operations
- ✅ Panel CRUD operations
- ✅ Support for 6 visualization types
- ✅ Panel positioning
- ✅ Panel duplication
- ✅ Export/import dashboards
- ✅ In-memory storage (ready for database migration)

### 3. API Routes
**File:** `app-insights-backend/routes/customDbRoutes.js`

Endpoints:
- ✅ POST `/api/custom-db/test-connection` - Test connection
- ✅ POST `/api/custom-db/connections` - Create connection
- ✅ GET `/api/custom-db/connections` - List connections
- ✅ DELETE `/api/custom-db/connections/:id` - Delete connection
- ✅ POST `/api/custom-db/query` - Execute query
- ✅ GET `/api/custom-db/connections/:id/tables` - List tables
- ✅ GET `/api/custom-db/connections/:id/tables/:schema/:table` - Get schema
- ✅ GET `/api/custom-db/dashboards` - List dashboards
- ✅ POST `/api/custom-db/dashboards` - Create dashboard
- ✅ GET `/api/custom-db/dashboards/:id` - Get dashboard
- ✅ PUT `/api/custom-db/dashboards/:id` - Update dashboard
- ✅ DELETE `/api/custom-db/dashboards/:id` - Delete dashboard
- ✅ POST `/api/custom-db/dashboards/:dashboardId/panels` - Create panel
- ✅ GET `/api/custom-db/dashboards/:dashboardId/panels` - List panels
- ✅ PUT `/api/custom-db/panels/:id` - Update panel
- ✅ DELETE `/api/custom-db/panels/:id` - Delete panel
- ✅ POST `/api/custom-db/panels/:id/duplicate` - Duplicate panel
- ✅ POST `/api/custom-db/panels/:id/execute` - Execute panel query
- ✅ GET `/api/custom-db/dashboards/:id/export` - Export dashboard
- ✅ POST `/api/custom-db/dashboards/import` - Import dashboard

### 4. Dependencies
- ✅ Added `pg@^8.11.3` to backend package.json
- ✅ Recharts already available in frontend

### 5. Routing
- ✅ Backend routes registered in `index.js`
- ✅ Frontend route added to `App.js`
- ✅ Sidebar menu item added

### 6. Documentation
- ✅ CUSTOM_DB_QUERY_GUIDE.md - Complete feature guide
- ✅ GRAFANA_LIKE_DB_FEATURE.md - Grafana-like features specification
- ✅ EXTERNAL_LOGO_EXAMPLES.md - Logo URL examples

---

## ⏳ What's Pending (Frontend)

### 1. Main Dashboard Page
**File to create:** `app-insights-dashboard/src/pages/CustomDbQuery.js`

Components needed:
- Dashboard selector dropdown
- Dashboard management (create, edit, delete)
- Panel grid layout
- Add panel button
- Export/import buttons
- Connection management sidebar

### 2. Panel Components

#### a. Panel Container
**File to create:** `app-insights-dashboard/src/components/customDb/Panel.jsx`

Features:
- Panel header with title
- Refresh button
- Edit button
- Delete button
- Duplicate button
- Full-screen button
- Last updated timestamp
- Loading indicator
- Error display

#### b. Visualization Components

**Table Visualization**
**File:** `app-insights-dashboard/src/components/customDb/visualizations/TableViz.jsx`
- Sortable columns
- Pagination
- NULL value handling
- Column formatting

**Line Chart Visualization**
**File:** `app-insights-dashboard/src/components/customDb/visualizations/LineChartViz.jsx`
- Using Recharts LineChart
- Multiple series support
- Tooltips
- Legend
- Grid

**Bar Chart Visualization**
**File:** `app-insights-dashboard/src/components/customDb/visualizations/BarChartViz.jsx`
- Using Recharts BarChart
- Horizontal/vertical orientation
- Stacked bars option
- Multiple series

**Pie Chart Visualization**
**File:** `app-insights-dashboard/src/components/customDb/visualizations/PieChartViz.jsx`
- Using Recharts PieChart
- Percentage labels
- Legend
- Donut mode option

**Stat Visualization**
**File:** `app-insights-dashboard/src/components/customDb/visualizations/StatViz.jsx`
- Large number display
- Unit formatting
- Trend indicator
- Color thresholds

**Gauge Visualization**
**File:** `app-insights-dashboard/src/components/customDb/visualizations/GaugeViz.jsx`
- Semi-circle gauge
- Color thresholds
- Min/max values
- Percentage display

### 3. Panel Editor
**File to create:** `app-insights-dashboard/src/components/customDb/PanelEditor.jsx`

Features:
- Connection selector
- Query editor (textarea with monospace font)
- Visualization type selector
- Test query button
- Visualization preview
- Refresh interval selector
- Panel title and description
- Save/cancel buttons

### 4. Connection Manager
**File to create:** `app-insights-dashboard/src/components/customDb/ConnectionManager.jsx`

Features:
- Connection list
- Add connection form
- Test connection button
- Delete connection button
- Connection status indicator

### 5. Dashboard Manager
**File to create:** `app-insights-dashboard/src/components/customDb/DashboardManager.jsx`

Features:
- Dashboard list
- Create dashboard form
- Edit dashboard
- Delete dashboard
- Export dashboard
- Import dashboard

---

## 📋 Implementation Steps

### Step 1: Install Dependencies (if needed)
```bash
cd app-insights-backend
npm install

cd ../app-insights-dashboard
npm install
```

### Step 2: Create Visualization Components

Start with the simplest visualizations first:

#### 2.1 Table Visualization
```jsx
// app-insights-dashboard/src/components/customDb/visualizations/TableViz.jsx
import React from 'react';

const TableViz = ({ data }) => {
  if (!data || !data.rows || data.rows.length === 0) {
    return <div className="p-4 text-gray-500">No data</div>;
  }

  return (
    <div className="overflow-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-700">
          <tr>
            {data.fields.map((field, idx) => (
              <th key={idx} className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                {field.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
          {data.rows.map((row, rowIdx) => (
            <tr key={rowIdx}>
              {row.map((cell, cellIdx) => (
                <td key={cellIdx} className="px-4 py-3 text-sm text-gray-900 dark:text-gray-300">
                  {cell === null ? <span className="text-gray-400 italic">NULL</span> : String(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TableViz;
```

#### 2.2 Stat Visualization
```jsx
// app-insights-dashboard/src/components/customDb/visualizations/StatViz.jsx
import React from 'react';

const StatViz = ({ data, options = {} }) => {
  if (!data || !data.rows || data.rows.length === 0) {
    return <div className="p-4 text-gray-500">No data</div>;
  }

  const value = data.rows[0][0];
  const { unit = '', decimals = 0 } = options;

  const formatValue = (val) => {
    if (typeof val === 'number') {
      return val.toFixed(decimals);
    }
    return val;
  };

  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <div className="text-5xl font-bold text-gray-900 dark:text-white">
          {formatValue(value)}{unit}
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400 mt-2">
          {data.fields[0].name}
        </div>
      </div>
    </div>
  );
};

export default StatViz;
```

#### 2.3 Line Chart Visualization
```jsx
// app-insights-dashboard/src/components/customDb/visualizations/LineChartViz.jsx
import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const LineChartViz = ({ data, options = {} }) => {
  if (!data || !data.rows || data.rows.length === 0) {
    return <div className="p-4 text-gray-500">No data</div>;
  }

  // Transform data for recharts
  const chartData = data.rows.map(row => {
    const obj = {};
    data.fields.forEach((field, idx) => {
      obj[field.name] = row[idx];
    });
    return obj;
  });

  const { xAxisColumn, yAxisColumns } = options;
  const xCol = xAxisColumn || data.fields[0].name;
  const yColumns = yAxisColumns || data.fields.slice(1).map(f => f.name);

  const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1'];

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey={xCol} />
        <YAxis />
        <Tooltip />
        <Legend />
        {yColumns.map((col, idx) => (
          <Line key={col} type="monotone" dataKey={col} stroke={colors[idx % colors.length]} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
};

export default LineChartViz;
```

### Step 3: Create Panel Container
```jsx
// app-insights-dashboard/src/components/customDb/Panel.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../../config/apiConfig';
import TableViz from './visualizations/TableViz';
import StatViz from './visualizations/StatViz';
import LineChartViz from './visualizations/LineChartViz';
// Import other visualizations...

const Panel = ({ panel, onEdit, onDelete, onDuplicate }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  const executeQuery = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post(`${API_BASE_URL}/custom-db/panels/${panel.id}/execute`);
      if (response.data.success) {
        setData(response.data);
        setLastUpdate(new Date());
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    executeQuery();

    // Auto-refresh
    if (panel.refreshInterval > 0) {
      const interval = setInterval(executeQuery, panel.refreshInterval * 1000);
      return () => clearInterval(interval);
    }
  }, [panel.id, panel.refreshInterval]);

  const renderVisualization = () => {
    if (loading) return <div className="flex items-center justify-center h-full">Loading...</div>;
    if (error) return <div className="p-4 text-red-500">Error: {error}</div>;
    if (!data) return <div className="p-4 text-gray-500">No data</div>;

    switch (panel.visualizationType) {
      case 'table':
        return <TableViz data={data} options={panel.options} />;
      case 'stat':
        return <StatViz data={data} options={panel.options} />;
      case 'line':
        return <LineChartViz data={data} options={panel.options} />;
      // Add other visualization types...
      default:
        return <div>Unknown visualization type</div>;
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 h-full flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center mb-3 border-b border-gray-200 dark:border-gray-700 pb-2">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{panel.title}</h3>
          {lastUpdate && (
            <div className="text-xs text-gray-500">
              Updated: {lastUpdate.toLocaleTimeString()}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={executeQuery} className="text-blue-600 hover:text-blue-800 text-sm">
            🔄
          </button>
          <button onClick={() => onEdit(panel)} className="text-gray-600 hover:text-gray-800 text-sm">
            ✏️
          </button>
          <button onClick={() => onDuplicate(panel.id)} className="text-gray-600 hover:text-gray-800 text-sm">
            📋
          </button>
          <button onClick={() => onDelete(panel.id)} className="text-red-600 hover:text-red-800 text-sm">
            🗑️
          </button>
        </div>
      </div>

      {/* Visualization */}
      <div className="flex-1 min-h-0">
        {renderVisualization()}
      </div>
    </div>
  );
};

export default Panel;
```

### Step 4: Create Main Page
```jsx
// app-insights-dashboard/src/pages/CustomDbQuery.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config/apiConfig';
import Panel from '../components/customDb/Panel';
import ConnectionManager from '../components/customDb/ConnectionManager';
import PanelEditor from '../components/customDb/PanelEditor';

const CustomDbQuery = () => {
  const [dashboards, setDashboards] = useState([]);
  const [selectedDashboard, setSelectedDashboard] = useState('default');
  const [panels, setPanels] = useState([]);
  const [showPanelEditor, setShowPanelEditor] = useState(false);
  const [editingPanel, setEditingPanel] = useState(null);
  const [showConnectionManager, setShowConnectionManager] = useState(false);

  useEffect(() => {
    loadDashboards();
  }, []);

  useEffect(() => {
    if (selectedDashboard) {
      loadPanels();
    }
  }, [selectedDashboard]);

  const loadDashboards = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/custom-db/dashboards`);
      if (response.data.success) {
        setDashboards(response.data.dashboards);
      }
    } catch (err) {
      console.error('Failed to load dashboards:', err);
    }
  };

  const loadPanels = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/custom-db/dashboards/${selectedDashboard}/panels`);
      if (response.data.success) {
        setPanels(response.data.panels);
      }
    } catch (err) {
      console.error('Failed to load panels:', err);
    }
  };

  const handleAddPanel = () => {
    setEditingPanel(null);
    setShowPanelEditor(true);
  };

  const handleEditPanel = (panel) => {
    setEditingPanel(panel);
    setShowPanelEditor(true);
  };

  const handleDeletePanel = async (panelId) => {
    if (!window.confirm('Delete this panel?')) return;
    
    try {
      await axios.delete(`${API_BASE_URL}/custom-db/panels/${panelId}`);
      loadPanels();
    } catch (err) {
      alert('Failed to delete panel: ' + err.message);
    }
  };

  const handleDuplicatePanel = async (panelId) => {
    try {
      await axios.post(`${API_BASE_URL}/custom-db/panels/${panelId}/duplicate`);
      loadPanels();
    } catch (err) {
      alert('Failed to duplicate panel: ' + err.message);
    }
  };

  return (
    <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Custom Database Query
          </h1>
          <select
            value={selectedDashboard}
            onChange={(e) => setSelectedDashboard(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            {dashboards.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowConnectionManager(true)}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            🔌 Connections
          </button>
          <button
            onClick={handleAddPanel}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            + Add Panel
          </button>
        </div>
      </div>

      {/* Panels Grid */}
      <div className="grid grid-cols-12 gap-4">
        {panels.map(panel => (
          <div
            key={panel.id}
            className={`col-span-${panel.position.w} row-span-${panel.position.h}`}
            style={{ minHeight: `${panel.position.h * 200}px` }}
          >
            <Panel
              panel={panel}
              onEdit={handleEditPanel}
              onDelete={handleDeletePanel}
              onDuplicate={handleDuplicatePanel}
            />
          </div>
        ))}
      </div>

      {/* Modals */}
      {showPanelEditor && (
        <PanelEditor
          panel={editingPanel}
          dashboardId={selectedDashboard}
          onClose={() => {
            setShowPanelEditor(false);
            loadPanels();
          }}
        />
      )}

      {showConnectionManager && (
        <ConnectionManager
          onClose={() => setShowConnectionManager(false)}
        />
      )}
    </div>
  );
};

export default CustomDbQuery;
```

---

## 🔧 Testing

### 1. Backend Testing
```bash
# Start backend
cd app-insights-backend
npm install
node index.js
```

### 2. Test API Endpoints
```bash
# Test connection
curl -X POST http://localhost:5000/api/custom-db/test-connection \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "host": "localhost",
    "port": 5432,
    "database": "testdb",
    "username": "postgres",
    "password": "password"
  }'

# Create connection
curl -X POST http://localhost:5000/api/custom-db/connections \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "id": "conn_1",
    "name": "Test DB",
    "host": "localhost",
    "port": 5432,
    "database": "testdb",
    "username": "postgres",
    "password": "password"
  }'

# Execute query
curl -X POST http://localhost:5000/api/custom-db/query \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "connectionId": "conn_1",
    "query": "SELECT * FROM users LIMIT 10"
  }'
```

### 3. Frontend Testing
```bash
# Start frontend
cd app-insights-dashboard
npm install
npm start
```

Navigate to: http://localhost:3000/custom-db

---

## 📦 Docker Build

Once frontend is complete:

```bash
# Build image
docker build -f Dockerfile.combined.ci -t reddy321678/apim:latest .

# Run
docker run -d -p 8082:80 \
  -e APP_INSIGHTS_APP_ID=xxx \
  -e APP_INSIGHTS_API_KEY=xxx \
  -e JWT_SECRET=xxx \
  -e ADMIN_PASSWORD=xxx \
  reddy321678/apim:latest
```

---

## 📚 Additional Resources

- **Backend Code**: All complete in `app-insights-backend/`
- **API Documentation**: See `CUSTOM_DB_QUERY_GUIDE.md`
- **Feature Spec**: See `GRAFANA_LIKE_DB_FEATURE.md`
- **Recharts Docs**: https://recharts.org/
- **PostgreSQL Docs**: https://www.postgresql.org/docs/

---

## 🎯 Priority Order

1. **High Priority** (Core functionality):
   - Table visualization
   - Stat visualization
   - Panel container
   - Main page with grid layout
   - Connection manager

2. **Medium Priority** (Enhanced features):
   - Line chart visualization
   - Bar chart visualization
   - Panel editor
   - Dashboard manager

3. **Low Priority** (Nice to have):
   - Pie chart visualization
   - Gauge visualization
   - Export/import UI
   - Advanced panel options

---

## ✅ Summary

**Backend**: 100% Complete ✅
**Frontend**: 0% Complete ⏳
**Documentation**: 100% Complete ✅

**Estimated Frontend Development Time**: 8-12 hours

**Next Immediate Step**: Create visualization components starting with TableViz and StatViz.

