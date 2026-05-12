# Enhanced Failures Panel — Specification

## Overview
Build an Azure Application Insights-style failures panel that's **better** than Azure with:
- Brush-selectable timeline chart
- Click-to-drill API table
- Side-by-side date comparison
- Rich detail drawer with multiple chart views

## Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  📊 FAILURES TIMELINE (brush-selectable area chart)             │
│  [Total failures over time — drag to select time window]        │
│  Shows: failed count + total count + error rate                 │
└─────────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────┬──────────────────────────┐
│  📋 API TABLE (click row → drawer)   │  📊 OVERALL STATS        │
│  Columns:                            │  - Top 3 response codes  │
│  - API Name                          │  - Top 3 exceptions      │
│  - Failures (sortable)               │  - Top 3 dependencies    │
│  - Error Rate %                      │  (updates on brush)      │
│  - Avg RT                            │                          │
│  - Compare vs Day-1 or custom        │                          │
│  [Pagination + search + CSV export]  │                          │
└──────────────────────────────────────┴──────────────────────────┘

[When row clicked → slide-in drawer from right]
┌─────────────────────────────────────────────────────────────────┐
│  API DETAIL DRAWER (680px wide, slide from right)               │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  API Name + Quick Stats (4 cards)                        │  │
│  └───────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Tabs: [📉 Error Rate] [⏱ Response Time] [🔢 Codes]      │  │
│  └───────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Chart (changes based on active tab)                     │  │
│  │  - Error Rate: hourly trend + failure count bars         │  │
│  │  - Response Time: hourly avg RT area chart               │  │
│  │  - Status Codes: bar chart + breakdown list              │  │
│  └───────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Comparison Card (Today vs Day-1 or custom)              │  │
│  │  - Error Rate delta                                      │  │
│  │  - RT delta                                              │  │
│  │  - Failure count delta                                   │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Features

### 1. Timeline Chart (Top)
- **Type**: Area chart with brush
- **Data**: `/api/failures-panel/timeline?range=24h`
- **Y-axis**: Failed request count
- **X-axis**: Time (auto-bucket: 1m/2m/5m/15m/30m/1h based on range)
- **Brush**: User can drag to select time window
- **On brush change**: Update API table + overall stats for selected window
- **Tooltip**: Shows failed, total, error rate, avg RT

### 2. API Table (Bottom Left)
- **Data**: `/api/failures-panel/operations?range=24h` OR `?windowStart=X&windowEnd=Y` (from brush)
- **Columns**:
  - API Name (sortable, searchable)
  - Total Requests
  - Failures (default sort desc)
  - Error Rate % (color: red >50%, orange >20%, green <20%)
  - Avg RT (color: red >2000ms, orange >1000ms)
  - Day-1 Error Rate % (or custom compare period)
  - Day-1 Avg RT
  - Δ Error Rate (pp) — with up/down arrow
  - Δ RT (ms) — with up/down arrow
- **Features**:
  - Search box (filters by API name)
  - Pagination (10/25/50/100 per page)
  - Sort by any column
  - CSV export
  - Click row → opens detail drawer
- **Compare Mode Toggle**:
  - "Day -1 (Yesterday)" — default, auto-shifts window back 24h
  - "Custom Period" — opens date picker, user selects any range

### 3. Overall Stats Panel (Bottom Right)
- **Data**: `/api/failures-panel/overall?range=24h` OR `?windowStart=X&windowEnd=Y`
- **Shows**:
  - **Top 3 Response Codes** (bar chart + count + %)
  - **Top 3 Exception Types** (list with count)
  - **Top 3 Failed Dependencies** (list with count + type)
- **Updates**: When brush selection changes

### 4. API Detail Drawer (Slide-in from right)
- **Trigger**: Click any row in API table
- **Width**: 680px
- **Animation**: Slide from right (0.2s ease)
- **Header**:
  - API name (word-break)
  - 4 quick stat cards: Failures, Total Req, Error Rate %, Avg RT
  - Close button (X)
- **Tabs**:
  - 📉 Error Rate — hourly trend (area chart) + failure count bars (composed chart)
  - ⏱ Response Time — hourly avg RT (area chart)
  - 🔢 Status Codes — bar chart + breakdown list with today vs day-1
- **Comparison Card** (below charts):
  - Today vs Day-1 (or custom)
  - Shows: Error Rate delta, RT delta, Failure count delta
  - Color-coded: worse=red, better=green, same=blue

### 5. Date Comparison
- **Default**: Day -1 (yesterday same window)
- **Custom**: User clicks "Custom Period" → date picker opens
- **Date Picker**: Dual-calendar with time selection (00:00 to 23:59)
- **Apply**: Refetches all data with `compareStart` and `compareEnd` params

## API Endpoints (Already Built)

```
GET /api/failures-panel/timeline?range=24h
→ { data: [{ time, timestamp, failed, total, avgRt, errorRate }], totalFailed, totalReqs, bucket }

GET /api/failures-panel/operations?range=24h&windowStart=X&windowEnd=Y
→ { data: [{ operation, failed, total, avgRt, p95Rt, errorRate, codes }], overall: { failed, total, errorRate } }

GET /api/failures-panel/detail?operation=X&windowStart=Y&windowEnd=Z
→ { responseCodes: [{code, count}], exceptions: [{type, full, count}], dependencies: [{name, type, count}], timeline: [{time, failed, total, avgRt, errorRate}] }

GET /api/failures-panel/overall?range=24h&windowStart=X&windowEnd=Y
→ { responseCodes: [{code, count}], exceptions: [{type, full, count}], dependencies: [{name, count}] }
```

## Component Structure

```javascript
export default function FailuresPanel({ range, startDate, endDate }) {
  // State
  const [timeline, setTimeline] = useState([]);
  const [operations, setOperations] = useState([]);
  const [overall, setOverall] = useState(null);
  const [selectedApi, setSelectedApi] = useState(null);
  const [brushWindow, setBrushWindow] = useState(null); // { start, end } indices
  const [compareMode, setCompareMode] = useState('day-1'); // 'day-1' | 'custom'
  const [compareStart, setCompareStart] = useState('');
  const [compareEnd, setCompareEnd] = useState('');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('failed');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Fetch timeline on mount/range change
  useEffect(() => {
    fetchTimeline();
  }, [range, startDate, endDate]);

  // Fetch operations when timeline or brush changes
  useEffect(() => {
    fetchOperations();
  }, [timeline, brushWindow, compareMode, compareStart, compareEnd]);

  // Fetch overall stats when operations change
  useEffect(() => {
    fetchOverall();
  }, [operations, brushWindow]);

  const fetchTimeline = async () => {
    // GET /api/failures-panel/timeline
  };

  const fetchOperations = async () => {
    // GET /api/failures-panel/operations
    // If brushWindow exists, use windowStart/windowEnd from timeline[brushWindow.start/end].timestamp
  };

  const fetchOverall = async () => {
    // GET /api/failures-panel/overall
  };

  const handleBrushChange = (e) => {
    if (!e || !e.startIndex || !e.endIndex) {
      setBrushWindow(null);
      return;
    }
    setBrushWindow({ start: e.startIndex, end: e.endIndex });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Timeline Chart */}
      <TimelineChart data={timeline} onBrushChange={handleBrushChange} />

      {/* Bottom: Table + Overall */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
        <OperationsTable
          data={operations}
          search={search}
          setSearch={setSearch}
          sortKey={sortKey}
          setSortKey={setSortKey}
          sortDir={sortDir}
          setSortDir={setSortDir}
          page={page}
          setPage={setPage}
          pageSize={pageSize}
          setPageSize={setPageSize}
          onRowClick={setSelectedApi}
          compareMode={compareMode}
          setCompareMode={setCompareMode}
          compareStart={compareStart}
          setCompareStart={setCompareStart}
          compareEnd={compareEnd}
          setCompareEnd={setCompareEnd}
        />
        <OverallStatsPanel data={overall} />
      </div>

      {/* Detail Drawer */}
      {selectedApi && (
        <ApiDetailDrawer
          api={selectedApi}
          range={range}
          startDate={startDate}
          endDate={endDate}
          compareStart={compareStart}
          compareEnd={compareEnd}
          onClose={() => setSelectedApi(null)}
        />
      )}
    </div>
  );
}
```

## Styling Guidelines

- **Background**: `#0d1117` (darkest), `#111217` (dark), `#181b24` (medium), `#1a1d27` (light)
- **Borders**: `#22263a` (subtle), `#2d3148` (visible)
- **Text**: `#c9d1d9` (primary), `#6b7280` (secondary), `#4b5563` (tertiary)
- **Colors**:
  - Critical: `#f2495c`
  - Warning: `#f5a623`
  - Info: `#5794f2`
  - Success: `#73bf69`
- **Animations**: 0.15s ease for hovers, 0.2s ease for slides
- **Shadows**: `0 4px 20px rgba(0,0,0,0.6)` for elevated elements

## Key Interactions

1. **Drag on timeline** → table updates to show only APIs in that window
2. **Click API row** → drawer slides in from right with 3 chart tabs
3. **Switch compare mode** → table columns update (Day-1 vs Custom)
4. **Search** → filters table, resets to page 1
5. **Sort** → click column header, toggles asc/desc
6. **CSV export** → downloads current filtered/sorted view

## Better Than Azure

- ✅ Brush selection on timeline (Azure has this)
- ✅ Side-by-side comparison with custom date picker (Azure: only yesterday)
- ✅ Richer detail drawer with 3 chart types (Azure: basic)
- ✅ Real-time comparison deltas with arrows (Azure: static)
- ✅ Animated slide-in drawer (Azure: modal)
- ✅ Better color coding and visual hierarchy
- ✅ More metrics: p95 RT, traffic Z-score, ML confidence (if integrated)

## Implementation Notes

- Use `Brush` component from recharts on timeline
- Store brush indices, map to timestamps
- Pass `windowStart` and `windowEnd` to all subsequent API calls
- Drawer uses `position: fixed` with slide animation
- All charts use consistent tooltip styling
- Handle null/undefined gracefully (new APIs have no day-1 data)

## Files to Create/Modify

1. ✅ `app-insights-backend/routes/failuresPanel.js` — DONE
2. ⏳ `app-insights-dashboard/src/pages/FailuresPanel.js` — IN PROGRESS (tool issues)
3. ✅ `app-insights-dashboard/src/config/apiConfig.js` — DONE (endpoints added)
4. ⏳ Wire into Dashboard.js or App.js routing

## Next Steps

Due to tool limitations with large files, I recommend:

1. **Copy the partial FailuresPanel.js** I've started
2. **Complete the main component** using the spec above
3. **Test with**: `docker-compose -f docker-compose.prod.yml restart backend`
4. **Add route** to Dashboard sidebar or create new tab

The backend is fully ready. The frontend just needs the main component logic completed following this spec.
