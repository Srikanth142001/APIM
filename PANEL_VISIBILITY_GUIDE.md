# 🎛️ Panel Visibility Control Guide

## Overview

The NexGen APIM dashboard automatically shows/hides panels based on which Azure resources are configured. This prevents showing empty or error states for features you're not using.

---

## 🔍 How It Works

### Backend Detection
The backend checks environment variables and exposes `/api/features`:

```json
{
  "mysql": true,          // MYSQL_SERVER_NAME is set
  "infrastructure": true, // AKS_CLUSTER_NAME is set
  "logAnalytics": true,   // LOG_ANALYTICS_AUTH_TOKEN is set
  "telegram": false       // TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID are set
}
```

### Frontend Response
The frontend automatically:
- ✅ Hides tabs for disabled features
- ✅ Removes metric cards
- ✅ Skips API calls
- ✅ Shows "N/A" for unavailable data

---

## 📊 Panel Visibility Matrix

| Panel/Component | Required Env Var | Location | Auto-Hidden |
|----------------|------------------|----------|-------------|
| **Pod Monitoring — Node Overview** | `AKS_CLUSTER_NAME` | Overview Tab (bottom) | ✅ Yes |
| **MySQL Connections** | `MYSQL_SERVER_NAME` | Overview Tab (bottom) | ✅ Yes |
| **MySQL Metrics Charts** | `MYSQL_SERVER_NAME` | Overview Tab (bottom) | ✅ Yes |
| **Node Pool CPU Usage** | `AKS_CLUSTER_NAME` | Overview Tab (bottom) | ✅ Yes |
| **MySQL Active Conn Card** | `MYSQL_SERVER_NAME` | Overview Tab (top metrics) | ✅ Yes |
| **Infrastructure Tab** | `AKS_CLUSTER_NAME` | Sidebar Navigation | ✅ Yes |
| **MySQL Tab** | `MYSQL_SERVER_NAME` | Sidebar Navigation | ✅ Yes |
| **Telegram Alerts** | `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` | Alerts Tab | ✅ Yes |
| **Health Score** | `AKS_CLUSTER_NAME` | Overview Tab | ✅ Yes |
| **Topology Map** | Always visible | Overview Tab | ❌ No |
| **API Analytics** | Always visible | All tabs | ❌ No |
| **ML Alerts Tab** | Always visible | Sidebar Navigation | ❌ No |

---

## 🎯 Configuration Examples

### Example 1: Hide MySQL & Infrastructure Panels

**Goal:** Only show API monitoring, hide all MySQL and Kubernetes panels

**Configuration:**
```bash
# .env.combined or docker-compose environment
APP_INSIGHTS_APP_ID=your-app-id
APP_INSIGHTS_API_KEY=your-api-key
AZURE_SUBSCRIPTION_ID=your-subscription-id
AZURE_RESOURCE_GROUP=your-resource-group
JWT_SECRET=your-secret
ADMIN_PASSWORD=your-password

# DO NOT SET THESE:
# AKS_CLUSTER_NAME=
# MYSQL_SERVER_NAME=
```

**Result:**
- ✅ Overview tab shows only API metrics
- ✅ No "MySQL Active Conn" card
- ✅ No "Pod Monitoring" panel
- ✅ No "MySQL Connections" panel
- ✅ No "Node Pool CPU" panel
- ✅ Infrastructure tab hidden from sidebar
- ✅ MySQL tab hidden from sidebar

---

### Example 2: Show Only MySQL, Hide Infrastructure

**Goal:** Monitor MySQL but not Kubernetes

**Configuration:**
```bash
APP_INSIGHTS_APP_ID=your-app-id
APP_INSIGHTS_API_KEY=your-api-key
AZURE_SUBSCRIPTION_ID=your-subscription-id
AZURE_RESOURCE_GROUP=your-resource-group
MYSQL_SERVER_NAME=your-mysql-server    # ← Enable MySQL
JWT_SECRET=your-secret
ADMIN_PASSWORD=your-password

# DO NOT SET:
# AKS_CLUSTER_NAME=
```

**Result:**
- ✅ MySQL tab visible
- ✅ MySQL Active Conn card visible
- ✅ MySQL Connections panel visible
- ✅ MySQL Metrics Charts visible
- ❌ Infrastructure tab hidden
- ❌ Pod Monitoring hidden
- ❌ Node Pool CPU hidden
- ❌ Health Score hidden

---

### Example 3: Show Only Infrastructure, Hide MySQL

**Goal:** Monitor Kubernetes but not MySQL

**Configuration:**
```bash
APP_INSIGHTS_APP_ID=your-app-id
APP_INSIGHTS_API_KEY=your-api-key
AZURE_SUBSCRIPTION_ID=your-subscription-id
AZURE_RESOURCE_GROUP=your-resource-group
AKS_CLUSTER_NAME=your-aks-cluster      # ← Enable Infrastructure
JWT_SECRET=your-secret
ADMIN_PASSWORD=your-password

# DO NOT SET:
# MYSQL_SERVER_NAME=
```

**Result:**
- ✅ Infrastructure tab visible
- ✅ Pod Monitoring panel visible
- ✅ Node Pool CPU panel visible
- ✅ Health Score visible
- ❌ MySQL tab hidden
- ❌ MySQL Active Conn card hidden
- ❌ MySQL Connections panel hidden
- ❌ MySQL Metrics Charts hidden

---

### Example 4: Show Everything

**Goal:** Full monitoring with all features

**Configuration:**
```bash
APP_INSIGHTS_APP_ID=your-app-id
APP_INSIGHTS_API_KEY=your-api-key
AZURE_SUBSCRIPTION_ID=your-subscription-id
AZURE_RESOURCE_GROUP=your-resource-group
AKS_CLUSTER_NAME=your-aks-cluster              # ← Enable Infrastructure
MYSQL_SERVER_NAME=your-mysql-server            # ← Enable MySQL
LOG_ANALYTICS_WORKSPACE_ID=your-workspace-id
LOG_ANALYTICS_AUTH_TOKEN=your-token
TELEGRAM_BOT_TOKEN=your-bot-token              # ← Enable Telegram
TELEGRAM_CHAT_ID=your-chat-id
JWT_SECRET=your-secret
ADMIN_PASSWORD=your-password
```

**Result:**
- ✅ All tabs visible
- ✅ All panels visible
- ✅ All features enabled

---

## 🔧 How to Hide Specific Panels

### Method 1: Environment Variables (Recommended)

Simply **don't set** the environment variable for features you don't want:

```bash
# Hide MySQL panels
# Don't set: MYSQL_SERVER_NAME

# Hide Infrastructure panels
# Don't set: AKS_CLUSTER_NAME

# Hide Telegram alerts
# Don't set: TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID
```

### Method 2: Set to Empty String

```bash
# In .env.combined
MYSQL_SERVER_NAME=
AKS_CLUSTER_NAME=
```

### Method 3: Comment Out in Docker Compose

```yaml
services:
  apim-combined:
    environment:
      # AKS_CLUSTER_NAME: "${AKS_CLUSTER_NAME}"     # ← Commented = hidden
      # MYSQL_SERVER_NAME: "${MYSQL_SERVER_NAME}"   # ← Commented = hidden
```

---

## 🧪 Testing Panel Visibility

### 1. Check Feature Flags Endpoint

```bash
curl http://localhost:8082/api/features
```

**Expected Response:**
```json
{
  "mysql": false,          // ← MySQL panels hidden
  "infrastructure": false, // ← Infrastructure panels hidden
  "logAnalytics": true,
  "telegram": false
}
```

### 2. Check Browser Console

Open browser DevTools (F12) and check the console:
```javascript
// The frontend logs feature flags on load
Features loaded: {mysql: false, infrastructure: false, ...}
```

### 3. Visual Verification

**When MySQL is disabled:**
- ❌ No "MySQL Active Conn" card in top metrics
- ❌ No "MySQL Connections" panel at bottom
- ❌ No "MySQL Metrics Charts" panel
- ❌ No "MySQL" tab in sidebar

**When Infrastructure is disabled:**
- ❌ No "Pod Monitoring — Node Overview" panel
- ❌ No "Node Pool CPU Usage" panel
- ❌ No "Health Score" card
- ❌ No "Infrastructure" tab in sidebar

---

## 🐛 Troubleshooting

### Panel Still Showing After Removing Env Var

**Solution:**
1. Restart the container:
   ```bash
   docker-compose -f docker-compose.combined.yml restart
   ```

2. Clear browser cache (Ctrl+Shift+R)

3. Verify env vars are not set:
   ```bash
   docker exec nexgen-apim-combined env | grep -E "MYSQL|AKS"
   ```

### Panel Shows "API Error" Instead of Hiding

**Cause:** The environment variable is set but the resource doesn't exist or credentials are wrong.

**Solution:**
- Either fix the credentials
- Or remove the environment variable to hide the panel

### Feature Flags Not Working

**Check:**
1. Backend is running:
   ```bash
   docker logs nexgen-apim-combined | grep "Backend running"
   ```

2. Features endpoint is accessible:
   ```bash
   curl http://localhost:8082/api/features
   ```

3. Frontend is fetching features:
   - Open browser DevTools → Network tab
   - Look for `/api/features` request
   - Check response

---

## 📝 Code Reference

### Backend Feature Detection
**File:** `app-insights-backend/index.js`

```javascript
app.get("/api/features", (req, res) => {
  res.json({
    mysql:          !!process.env.MYSQL_SERVER_NAME,
    infrastructure: !!process.env.AKS_CLUSTER_NAME,
    logAnalytics:   !!process.env.LOG_ANALYTICS_AUTH_TOKEN,
    telegram:       !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
  });
});
```

### Frontend Feature Context
**File:** `app-insights-dashboard/src/context/FeaturesContext.js`

```javascript
export function FeaturesProvider({ children }) {
  const [features, setFeatures] = useState({
    mysql: true,
    infrastructure: true,
    logAnalytics: true,
    telegram: false,
    loaded: false,
  });

  useEffect(() => {
    axios.get(`${API_BASE_URL}/api/features`)
      .then(({ data }) => setFeatures({ ...data, loaded: true }))
      .catch(() => setFeatures({ 
        mysql: true, 
        infrastructure: true, 
        logAnalytics: true, 
        telegram: false, 
        loaded: true 
      }));
  }, []);

  return <FeaturesContext.Provider value={features}>{children}</FeaturesContext.Provider>;
}
```

### Panel Conditional Rendering
**File:** `app-insights-dashboard/src/pages/Dashboard.js`

```javascript
{/* Only show if infrastructure is enabled */}
{features.infrastructure !== false && <NodeCpuOverview />}

{/* Only show if MySQL is enabled */}
{features.mysql !== false && <MySQLConnectionsCard />}
{features.mysql !== false && <MySQLMetricsCharts />}

{/* Only show if infrastructure is enabled */}
{features.infrastructure !== false && <NodePoolChart />}
```

---

## ✅ Quick Reference

| Want to Hide | Don't Set This Env Var |
|--------------|------------------------|
| MySQL panels | `MYSQL_SERVER_NAME` |
| Infrastructure panels | `AKS_CLUSTER_NAME` |
| Telegram alerts | `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` |
| Log Analytics queries | `LOG_ANALYTICS_AUTH_TOKEN` |

**Remember:** Panels are hidden automatically. No manual configuration needed beyond environment variables!

---

## 🎨 UI Behavior

### Graceful Degradation
- Panels fade out smoothly when disabled
- No broken layouts or empty spaces
- Grid adjusts automatically
- No error messages for disabled features

### User Experience
- Clean, focused dashboard
- Only shows relevant data
- Faster page loads (fewer API calls)
- No confusion from N/A or error states

---

## 📚 Related Documentation

- **DEPLOYMENT_GUIDE.md** - Full deployment instructions
- **.env.combined.example** - Environment variable template
- **docker-compose.combined.yml** - Docker Compose configuration

---

**Need Help?**

Check feature flags:
```bash
curl http://localhost:8082/api/features
```

Check container logs:
```bash
docker logs nexgen-apim-combined
```
