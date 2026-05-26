# 🔧 API Port Issue Fix - Frontend Calling Wrong Port

## Problem

Frontend is calling API on port **5009** instead of going through the combined container's nginx proxy on port **8082**.

**Symptom:**
```
Browser → http://172.30.38.193:5009/api/auth/login
❌ Should be → http://172.30.38.193:8082/api/auth/login
```

---

## Root Cause

You're using an **old image** or **wrong deployment method**. The combined container should use **relative URLs** (no port specified) so nginx proxies `/api` to the backend internally.

---

## ✅ Solution: Use Combined Container Correctly

### Step 1: Verify You're Using Combined Image

```bash
# Check running containers
docker ps

# Should see ONE container:
# reddy321678/apim:latest (port 8082:80)

# Should NOT see TWO containers:
# reddy321678/momo_frontend + reddy321678/momo_backend
```

### Step 2: Stop Old Containers

```bash
# Stop all APIM containers
docker stop $(docker ps -q --filter "name=momo")
docker stop $(docker ps -q --filter "name=apim")

# Remove them
docker rm $(docker ps -aq --filter "name=momo")
docker rm $(docker ps -aq --filter "name=apim")
```

### Step 3: Pull Latest Combined Image

```bash
# Pull latest image with fixes
docker pull reddy321678/apim:latest
```

### Step 4: Deploy Combined Container

#### Option A: Docker Compose (Recommended)

```bash
# Use the combined docker-compose file
docker-compose -f docker-compose.combined.yml up -d
```

**docker-compose.combined.yml:**
```yaml
version: '3.8'

services:
  apim-combined:
    image: reddy321678/apim:latest
    container_name: nexgen-apim-combined
    restart: unless-stopped
    
    ports:
      - "8082:80"  # ← Only expose port 8082
    
    environment:
      # Region
      REACT_APP_REGION_NAME: "SAN Region"
      
      # Azure App Insights
      APP_INSIGHTS_APP_ID: "your-app-id"
      APP_INSIGHTS_API_KEY: "your-api-key"
      
      # Azure Infrastructure
      AZURE_SUBSCRIPTION_ID: "your-subscription-id"
      AZURE_RESOURCE_GROUP: "your-resource-group"
      
      # Optional: AKS (for Infrastructure tab)
      AKS_CLUSTER_NAME: "your-aks-cluster"
      
      # Optional: MySQL (for MySQL tab)
      MYSQL_SERVER_NAME: "your-mysql-server"
      
      # Authentication
      JWT_SECRET: "your-strong-secret-min-32-chars"
      ADMIN_PASSWORD: "your-secure-password"
```

#### Option B: Docker Run

```bash
docker run -d \
  -p 8082:80 \
  -e REACT_APP_REGION_NAME="SAN Region" \
  -e APP_INSIGHTS_APP_ID=your-app-id \
  -e APP_INSIGHTS_API_KEY=your-api-key \
  -e AZURE_SUBSCRIPTION_ID=your-subscription-id \
  -e AZURE_RESOURCE_GROUP=your-resource-group \
  -e JWT_SECRET=your-strong-secret-min-32-chars \
  -e ADMIN_PASSWORD=your-secure-password \
  --name nexgen-apim-combined \
  --restart unless-stopped \
  reddy321678/apim:latest
```

### Step 5: Verify Configuration

```bash
# Check container logs
docker logs nexgen-apim-combined

# Should see:
# ✅ Frontend config.js written (region: SAN Region)
# Configuration:
#   Frontend:    http://localhost:80
#   Backend API: http://localhost:5000 (internal)
```

### Step 6: Test API Calls

```bash
# Test health endpoint
curl http://172.30.38.193:8082/health

# Test features endpoint (should work without auth)
curl http://172.30.38.193:8082/api/features

# Should return:
# {"mysql":true,"infrastructure":true,"logAnalytics":true,"telegram":false}
```

### Step 7: Check Browser

1. Open: `http://172.30.38.193:8082`
2. Open DevTools (F12) → Network tab
3. Try to login
4. Check API calls - should go to:
   ```
   ✅ http://172.30.38.193:8082/api/auth/login
   ❌ NOT http://172.30.38.193:5009/api/auth/login
   ```

---

## 🔍 Debugging

### Check config.js in Browser

1. Open: `http://172.30.38.193:8082/config.js`
2. Should see:
   ```javascript
   window.ENV_CONFIG = {
     API_PROTOCOL: 'http',
     API_HOSTNAME: '',        // ← Empty for single-container
     API_PORT:     '',        // ← Empty for single-container
     REGION_NAME:  'SAN Region'
   };
   ```

### Check config.js Inside Container

```bash
docker exec nexgen-apim-combined cat /usr/share/nginx/html/config.js
```

Should show empty hostname and port.

### Check nginx Configuration

```bash
docker exec nexgen-apim-combined cat /etc/nginx/http.d/default.conf
```

Should have:
```nginx
location /api {
    proxy_pass http://127.0.0.1:5000;
    ...
}
```

---

## ⚠️ Common Mistakes

### Mistake 1: Using Separate Containers

**Wrong:**
```yaml
services:
  backend:
    image: reddy321678/momo_backend:latest
    ports:
      - "5009:5000"
  
  frontend:
    image: reddy321678/momo_frontend:latest
    ports:
      - "8082:80"
    environment:
      REACT_APP_API_HOSTNAME: "172.30.38.193"
      REACT_APP_API_PORT: "5009"  # ← This causes the issue
```

**Right:**
```yaml
services:
  apim-combined:
    image: reddy321678/apim:latest
    ports:
      - "8082:80"  # ← Only one port
    # No API_HOSTNAME or API_PORT needed
```

### Mistake 2: Old Image

**Problem:** Using an old image that doesn't have the combined setup.

**Solution:**
```bash
docker pull reddy321678/apim:latest
docker-compose -f docker-compose.combined.yml up -d --force-recreate
```

### Mistake 3: Wrong Environment Variables

**Wrong:**
```bash
-e REACT_APP_API_HOSTNAME=172.30.38.193
-e REACT_APP_API_PORT=5009
```

**Right:**
```bash
# Don't set these for combined container!
# Or set them to empty:
-e REACT_APP_API_HOSTNAME=""
-e REACT_APP_API_PORT=""
```

---

## 📊 Port Mapping Comparison

### ❌ Wrong (Separate Containers)
```
Browser → 172.30.38.193:8082 (frontend)
Browser → 172.30.38.193:5009 (backend) ← Direct backend access
```

### ✅ Right (Combined Container)
```
Browser → 172.30.38.193:8082 (nginx)
  ├─ / → React frontend
  └─ /api → proxy to localhost:5000 (backend)
```

---

## 🚀 Quick Fix Script

```bash
#!/bin/bash
# quick-fix.sh

echo "🛑 Stopping old containers..."
docker stop $(docker ps -q --filter "name=momo") 2>/dev/null || true
docker stop $(docker ps -q --filter "name=apim") 2>/dev/null || true

echo "🗑️  Removing old containers..."
docker rm $(docker ps -aq --filter "name=momo") 2>/dev/null || true
docker rm $(docker ps -aq --filter "name=apim") 2>/dev/null || true

echo "📥 Pulling latest image..."
docker pull reddy321678/apim:latest

echo "🚀 Starting combined container..."
docker run -d \
  -p 8082:80 \
  -e REACT_APP_REGION_NAME="SAN Region" \
  -e APP_INSIGHTS_APP_ID="${APP_INSIGHTS_APP_ID}" \
  -e APP_INSIGHTS_API_KEY="${APP_INSIGHTS_API_KEY}" \
  -e AZURE_SUBSCRIPTION_ID="${AZURE_SUBSCRIPTION_ID}" \
  -e AZURE_RESOURCE_GROUP="${AZURE_RESOURCE_GROUP}" \
  -e AKS_CLUSTER_NAME="${AKS_CLUSTER_NAME}" \
  -e MYSQL_SERVER_NAME="${MYSQL_SERVER_NAME}" \
  -e JWT_SECRET="${JWT_SECRET}" \
  -e ADMIN_PASSWORD="${ADMIN_PASSWORD}" \
  --name nexgen-apim-combined \
  --restart unless-stopped \
  reddy321678/apim:latest

echo "✅ Done! Check logs:"
echo "   docker logs -f nexgen-apim-combined"
echo ""
echo "🌐 Access: http://172.30.38.193:8082"
```

**Usage:**
```bash
chmod +x quick-fix.sh
./quick-fix.sh
```

---

## ✅ Verification Checklist

After deploying:

- [ ] Only ONE container running (not two)
- [ ] Container name: `nexgen-apim-combined`
- [ ] Port mapping: `8082:80` (not 8082:80 + 5009:5000)
- [ ] config.js has empty API_HOSTNAME and API_PORT
- [ ] Login page loads without blinking
- [ ] API calls go to port 8082 (not 5009)
- [ ] Browser DevTools shows: `http://172.30.38.193:8082/api/*`
- [ ] No CORS errors in console

---

## 📝 Summary

**Problem:** Frontend calling `http://172.30.38.193:5009/api/*`  
**Cause:** Using separate containers or old image  
**Solution:** Use combined container `reddy321678/apim:latest`  
**Result:** Frontend calls `http://172.30.38.193:8082/api/*` → nginx proxies to backend

---

**Need Help?**

Check container logs:
```bash
docker logs nexgen-apim-combined
```

Check config.js:
```bash
curl http://172.30.38.193:8082/config.js
```
