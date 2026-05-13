# 🔧 Login Page Infinite Redirect Fix

## Problem

When accessing the login page in production, the page keeps auto-refreshing/blinking, making it impossible to enter credentials.

## Root Cause

**Infinite Redirect Loop:**

1. Login page loads
2. `FeaturesProvider` (wraps entire app) calls `/api/features` on mount
3. Backend requires authentication for `/api/features` (protected by `requireAuth` middleware)
4. API returns 401 Unauthorized
5. Axios interceptor catches 401 and redirects to `/` (login page)
6. Loop repeats infinitely

## Solution

Move `/api/features` endpoint **before** the `requireAuth` middleware so it's publicly accessible.

### Changes Made

**File:** `app-insights-backend/index.js`

**Before:**
```javascript
// ── Auth (public — no token required) ───────────────────────────────────────
app.use("/api/auth", authRoutes);

// ── Protect all other /api/* routes ─────────────────────────────────────────
app.use("/api", requireAuth);

// ... all other routes ...

// ── Feature flags (at the end, AFTER requireAuth) ───────────────────────────
app.get("/api/features", (req, res) => {
  res.json({
    mysql: !!process.env.MYSQL_SERVER_NAME,
    infrastructure: !!process.env.AKS_CLUSTER_NAME,
    logAnalytics: !!process.env.LOG_ANALYTICS_AUTH_TOKEN,
    telegram: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
  });
});
```

**After:**
```javascript
// ── Public endpoints (no auth required) ─────────────────────────────────────
app.use("/api/auth", authRoutes);

// ── Feature flags — public endpoint so frontend can check before login ──────
app.get("/api/features", (req, res) => {
  res.json({
    mysql: !!process.env.MYSQL_SERVER_NAME,
    infrastructure: !!process.env.AKS_CLUSTER_NAME,
    logAnalytics: !!process.env.LOG_ANALYTICS_AUTH_TOKEN,
    telegram: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
  });
});

// ── Protect all other /api/* routes ─────────────────────────────────────────
app.use("/api", requireAuth);

// ... all other routes ...
```

## Why This Works

- `/api/features` is now registered **before** `app.use("/api", requireAuth)`
- Express processes middleware in order
- `/api/features` matches first and returns immediately
- Never reaches the `requireAuth` middleware
- No 401 error, no redirect loop

## Deployment

### Option 1: Rebuild Images

```bash
# Rebuild backend
cd app-insights-backend
docker build -t reddy321678/momo_backend:latest .
docker push reddy321678/momo_backend:latest

# Rebuild combined
cd ..
docker build -f Dockerfile.combined -t reddy321678/apim:latest .
docker push reddy321678/apim:latest

# Restart containers
docker-compose -f docker-compose.combined.yml down
docker-compose -f docker-compose.combined.yml pull
docker-compose -f docker-compose.combined.yml up -d
```

### Option 2: Pull Latest from GitHub

```bash
# On your server
git pull origin master

# Rebuild and restart
docker-compose -f docker-compose.combined.yml down
docker-compose -f docker-compose.combined.yml build
docker-compose -f docker-compose.combined.yml up -d
```

## Verification

### 1. Test Features Endpoint (No Auth Required)

```bash
# Should return JSON without authentication
curl http://localhost:8082/api/features

# Expected response:
{
  "mysql": true,
  "infrastructure": true,
  "logAnalytics": true,
  "telegram": false
}
```

### 2. Test Login Page

1. Open browser: `http://your-server-ip:8082`
2. Login page should load **without blinking/refreshing**
3. You should be able to type in username/password fields
4. No console errors about 401

### 3. Check Browser Console

Open DevTools (F12) → Console tab:
- ✅ Should see: `Features loaded: {mysql: true, ...}`
- ❌ Should NOT see: `401 Unauthorized` errors
- ❌ Should NOT see: Multiple rapid page reloads

## Additional Fixes Included

### Panel Visibility Controls

The following panels now automatically hide based on environment variables:

| Panel | Env Var | Hidden When Not Set |
|-------|---------|---------------------|
| Pod Monitoring | `AKS_CLUSTER_NAME` | ✅ Yes |
| MySQL Connections | `MYSQL_SERVER_NAME` | ✅ Yes |
| MySQL Metrics | `MYSQL_SERVER_NAME` | ✅ Yes |
| Node Pool CPU | `AKS_CLUSTER_NAME` | ✅ Yes |

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

## Troubleshooting

### Still Getting Redirect Loop?

1. **Clear browser cache:**
   ```
   Ctrl + Shift + R (hard refresh)
   ```

2. **Clear localStorage:**
   ```javascript
   // In browser console (F12)
   localStorage.clear();
   location.reload();
   ```

3. **Verify backend is updated:**
   ```bash
   docker logs nexgen-apim-combined | grep "Backend running"
   docker exec nexgen-apim-combined cat /app/backend/index.js | grep -A 5 "api/features"
   ```

4. **Check endpoint order:**
   ```bash
   # Features should come BEFORE requireAuth
   docker exec nexgen-apim-combined cat /app/backend/index.js | grep -B 2 -A 2 "requireAuth"
   ```

### Login Works But Panels Still Show Errors?

This is a different issue - means the environment variables are set but the resources don't exist or credentials are wrong.

**Solution:**
- Either fix the credentials
- Or remove the environment variable to hide the panel (see PANEL_VISIBILITY_GUIDE.md)

## Security Note

**Q:** Is it safe to make `/api/features` public?

**A:** Yes, because:
- It only returns boolean flags (true/false)
- No sensitive data (credentials, tokens, etc.)
- No user data
- Just indicates which features are configured
- Similar to a "capabilities" or "health" endpoint

## Related Files

- `PANEL_VISIBILITY_GUIDE.md` - Complete guide on hiding panels
- `DEPLOYMENT_GUIDE.md` - Full deployment instructions
- `app-insights-backend/index.js` - Backend routing
- `app-insights-dashboard/src/context/FeaturesContext.js` - Feature detection

## Summary

✅ **Fixed:** Infinite redirect loop on login page  
✅ **Fixed:** Unable to type in login fields  
✅ **Added:** Automatic panel hiding based on env vars  
✅ **Improved:** Cleaner dashboard with only relevant panels  

**Commit:** `e451856` - "Fix infinite redirect loop on login page and add panel visibility controls"
