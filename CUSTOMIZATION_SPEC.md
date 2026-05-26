# 🎨 Dashboard Customization Specification

## Requirements

### 1. **Configurable Top N APIs**
- Remove hardcoded "Top 10" limit
- Make it configurable via environment variable
- Default: 10 (if not specified)
- Environment Variable: `TOP_APIS_LIMIT`

### 2. **Add TPS (Transactions Per Second)**
- Show TPS in main dashboard overview cards
- Show TPS in API Analytics tab
- Calculate TPS based on selected time range
- Auto-update when time filter changes

### 3. **Runtime Branding**
- Project Name: Configurable via `PROJECT_NAME` env var (default: "MoMo Insights")
- Logo: Configurable via `PROJECT_LOGO` env var (default: "/momo.png")
- Apply everywhere in UI:
  - Login page title
  - Dashboard header
  - Browser tab title
  - Sidebar branding

---

## Implementation Plan

### Phase 1: Backend Changes

#### 1.1 Add TPS Calculation to Overview Endpoint
**File:** `app-insights-backend/routes/overview.js`

**Add:**
- Calculate TPS based on time range
- Formula: `TPS = totalRequests / timeRangeInSeconds`
- Return in response: `{ ..., tps: number }`

#### 1.2 Make Top APIs Limit Configurable
**File:** `app-insights-backend/routes/topApis.js`

**Add:**
- Read `TOP_APIS_LIMIT` from env (default: 10)
- Use in query: `LIMIT ${limit}`

#### 1.3 Add TPS to API Analytics Endpoints
**Files:**
- `app-insights-backend/routes/topApis.js`
- `app-insights-backend/routes/performancePanel.js`

**Add:**
- Calculate per-API TPS
- Return in response

---

### Phase 2: Frontend Changes

#### 2.1 Update Runtime Config
**File:** `app-insights-dashboard/public/config.js`

**Add:**
```javascript
window.ENV_CONFIG = {
  API_PROTOCOL: '${REACT_APP_API_PROTOCOL}',
  API_HOSTNAME: '${REACT_APP_API_HOSTNAME}',
  API_PORT: '${REACT_APP_API_PORT}',
  REGION_NAME: '${REACT_APP_REGION_NAME}',
  PROJECT_NAME: '${PROJECT_NAME}',        // NEW
  PROJECT_LOGO: '${PROJECT_LOGO}',        // NEW
  TOP_APIS_LIMIT: '${TOP_APIS_LIMIT}'     // NEW
};
```

#### 2.2 Update Entrypoint Script
**File:** `combined-entrypoint.sh`

**Add:**
- Read `PROJECT_NAME`, `PROJECT_LOGO`, `TOP_APIS_LIMIT` from env
- Write to config.js

#### 2.3 Update API Config
**File:** `app-insights-dashboard/src/config/apiConfig.js`

**Add:**
- Export `PROJECT_NAME`, `PROJECT_LOGO`, `TOP_APIS_LIMIT`
- Use in components

#### 2.4 Update Dashboard Components

**Files to Update:**
- `app-insights-dashboard/src/pages/Dashboard.js` - Add TPS card
- `app-insights-dashboard/src/pages/Login.js` - Use PROJECT_NAME, PROJECT_LOGO
- `app-insights-dashboard/src/components/ui/Sidebar.jsx` - Use PROJECT_NAME, PROJECT_LOGO
- `app-insights-dashboard/src/pages/tabs/ApiAnalyticsTab.js` - Show TPS, use TOP_APIS_LIMIT
- `app-insights-dashboard/public/index.html` - Dynamic title

---

## Environment Variables

### New Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PROJECT_NAME` | "MoMo Insights" | Application name shown in UI |
| `PROJECT_LOGO` | "/momo.png" | Path to logo image |
| `TOP_APIS_LIMIT` | "10" | Number of top APIs to show |

### Usage Example

```bash
docker run -d -p 8082:80 \
  -e PROJECT_NAME="MyCompany API Monitor" \
  -e PROJECT_LOGO="/custom-logo.png" \
  -e TOP_APIS_LIMIT="20" \
  -e APP_INSIGHTS_APP_ID=xxx \
  -e APP_INSIGHTS_API_KEY=xxx \
  ...
  reddy321678/apim:latest
```

---

## TPS Calculation Details

### Formula
```
TPS = Total Requests / Time Range (seconds)
```

### Time Range Mapping
| Range | Seconds |
|-------|---------|
| 10m   | 600     |
| 30m   | 1,800   |
| 1h    | 3,600   |
| 6h    | 21,600  |
| 12h   | 43,200  |
| 24h   | 86,400  |
| 7d    | 604,800 |
| 30d   | 2,592,000 |

### Custom Date Range
```
TPS = Total Requests / (endDate - startDate in seconds)
```

---

## UI Changes

### Dashboard Overview
**Add new metric card:**
```
┌─────────────────────────┐
│ 📊 TPS                  │
│ 125.4                   │
│ Transactions/sec        │
│ ● OK                    │
└─────────────────────────┘
```

### API Analytics Tab
**Update "Top Success APIs" table:**
```
| API Name | Count | TPS | Avg Time | Errors | Success % |
|----------|-------|-----|----------|--------|-----------|
| GET /api | 1000  | 2.5 | 150ms    | 0      | 100%      |
```

### Login Page
```
┌──────────────────────────┐
│   [Custom Logo]          │
│   Custom Project Name    │
│   Application Dashboard  │
└──────────────────────────┘
```

### Browser Tab
```
Custom Project Name - Dashboard
```

---

## Testing Checklist

- [ ] TPS shows in dashboard overview
- [ ] TPS updates when time range changes
- [ ] TPS shows in API Analytics tab
- [ ] Top APIs limit is configurable
- [ ] Custom project name shows everywhere
- [ ] Custom logo shows everywhere
- [ ] Browser tab title uses custom name
- [ ] Login page uses custom branding
- [ ] Sidebar uses custom branding
- [ ] Default values work when env vars not set

---

## Backward Compatibility

All new features have defaults:
- ✅ Existing deployments work without changes
- ✅ No breaking changes
- ✅ Optional configuration

---

## Files to Modify

### Backend (3 files)
1. `app-insights-backend/routes/overview.js` - Add TPS
2. `app-insights-backend/routes/topApis.js` - Configurable limit, add TPS
3. `app-insights-backend/routes/performancePanel.js` - Add TPS

### Frontend (7 files)
1. `app-insights-dashboard/public/config.js` - Add new env vars
2. `app-insights-dashboard/src/config/apiConfig.js` - Export new config
3. `app-insights-dashboard/src/pages/Dashboard.js` - Add TPS card
4. `app-insights-dashboard/src/pages/Login.js` - Use custom branding
5. `app-insights-dashboard/src/components/ui/Sidebar.jsx` - Use custom branding
6. `app-insights-dashboard/src/pages/tabs/ApiAnalyticsTab.js` - Show TPS, use limit
7. `app-insights-dashboard/public/index.html` - Dynamic title

### Docker (2 files)
1. `combined-entrypoint.sh` - Handle new env vars
2. `.env.combined.example` - Document new vars

---

## Next Steps

1. Implement backend changes
2. Implement frontend changes
3. Update Docker configuration
4. Test all scenarios
5. Update documentation
6. Commit and push
7. Rebuild Docker image
8. Deploy and verify

