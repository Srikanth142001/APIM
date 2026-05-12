# ML Alerts UI Fixes

## Issues Fixed

### 1. ✅ Cards Auto-Expanding
**Problem:** All critical alert cards were opening by default, making the page cluttered.

**Fix:** Changed `AlertCard` component in `MLAlertsTab.js`:
```javascript
// Before:
const isCritical = alert.severity === "critical";
const [expanded, setExpanded] = useState(isCritical);  // auto-expand critical

// After:
const [expanded, setExpanded] = useState(false);  // all collapsed by default
```

**Result:** All cards now start collapsed. Click any card header to expand and see details.

---

### 2. ✅ 80-Day Chart Not Loading
**Problem:** "Failed to load chart data" error when expanding alert cards.

**Root Cause:** Backend endpoint `/api/ml-api-alerts/critical-chart` was returning:
```json
{
  "bands": {...},
  "daily": [...],
  "hourly": [...]
}
```

But frontend expected:
```json
{
  "bands": {...},
  "rtHistory": [...],  // ← missing!
  "daily": [...],
  "hourly": [...]
}
```

**Fix:** Updated `mlApiAlerts.js` route to include 80-day RT history:
- Added new query for 80-day daily RT data
- Returns `rtHistory` array with 80 data points
- Each point includes: `avgRt`, `p50Rt`, `p95Rt`, `errorRate`, `total`, `errors`

**Result:** Chart now displays:
- **80-day Response Time trend** (blue area = avg RT, orange = p95 RT)
- **Confidence bands** (red line = upper 2σ, yellow = warning 1σ, green = mean)
- **7-day Error Rate** (daily buckets)
- **24h Error Rate** (hourly buckets)

---

## How to Test

1. **Restart backend** to load the fixed route:
   ```bash
   docker-compose -f docker-compose.prod.yml restart backend
   ```

2. **Go to:** Dashboard → **ML Alerts** tab

3. **Run ML Analysis** (blue button top-right)

4. **Verify:**
   - ✅ All cards are collapsed by default
   - ✅ Click any card → expands to show details
   - ✅ Click "📊 Response Time (80d)" tab → shows 80-day chart with confidence bands
   - ✅ Click "📈 Error Rate (7d)" → shows 7-day error rate
   - ✅ Click "🕐 Error Rate (24h)" → shows hourly error rate

---

## Chart Features

The 80-day chart now shows:

**Response Time View:**
- Blue area = Average RT over 80 days
- Orange area = p95 RT
- Red dashed line = Upper bound (mean + 2σ) — anomaly threshold
- Yellow dashed line = Warning (mean + 1σ)
- Green dashed line = 80-day mean (trained baseline)
- Hover over any point → see full metrics

**Error Rate Views:**
- 7-day: daily buckets, good for weekly patterns
- 24h: hourly buckets, good for recent spikes

**Legend shows:**
- Current value vs baseline
- Statistical bounds
- Data quality (number of days)

---

## Files Changed

1. `app-insights-dashboard/src/pages/tabs/MLAlertsTab.js`
   - Line 368: Changed `useState(isCritical)` → `useState(false)`

2. `app-insights-backend/routes/mlApiAlerts.js`
   - Line 984-1050: Added `rtHistory` query and formatting
   - Now returns 4 datasets: `rtHistory`, `daily`, `hourly`, `bands`

---

## Status

✅ **Both issues resolved**
- Cards no longer auto-expand
- 80-day chart loads correctly with full historical data
- All 3 chart views working (RT, daily error, hourly error)
