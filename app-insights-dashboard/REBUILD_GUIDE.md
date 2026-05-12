# Rebuild Guide - Fix API Endpoint Issue

## 🔴 Problem

The frontend is calling `http://172.30.38.193:8081` but the backend is on port `5005`.

## 🎯 Root Cause

React environment variables (`REACT_APP_*`) are embedded into the JavaScript bundle at **BUILD TIME**, not runtime. The image was built with the wrong port (8081 instead of 5005).

## ✅ Solution: Rebuild with Correct Configuration

### Step 1: Stop and Remove Old Container

**Windows:**
```cmd
docker stop frontend_momopass
docker rm frontend_momopass
```

**Linux/Mac:**
```bash
docker stop frontend_momopass
docker rm frontend_momopass
```

### Step 2: Remove Old Image (Optional but Recommended)

```bash
docker rmi app-insights-dashboard
```

### Step 3: Rebuild with Correct API Configuration

**Windows (CMD):**
```cmd
cd app-insights-dashboard

docker build ^
  --build-arg REACT_APP_API_PROTOCOL=http ^
  --build-arg REACT_APP_API_HOSTNAME=172.30.38.193 ^
  --build-arg REACT_APP_API_PORT=5005 ^
  --build-arg REACT_APP_REGION_NAME="SAN Region" ^
  -t app-insights-dashboard .
```

**Windows (PowerShell):**
```powershell
cd app-insights-dashboard

docker build `
  --build-arg REACT_APP_API_PROTOCOL=http `
  --build-arg REACT_APP_API_HOSTNAME=172.30.38.193 `
  --build-arg REACT_APP_API_PORT=5005 `
  --build-arg REACT_APP_REGION_NAME="SAN Region" `
  -t app-insights-dashboard .
```

**Linux/Mac:**
```bash
cd app-insights-dashboard

docker build \
  --build-arg REACT_APP_API_PROTOCOL=http \
  --build-arg REACT_APP_API_HOSTNAME=172.30.38.193 \
  --build-arg REACT_APP_API_PORT=5005 \
  --build-arg REACT_APP_REGION_NAME="SAN Region" \
  -t app-insights-dashboard .
```

### Step 4: Run New Container

**Windows (CMD):**
```cmd
docker run -d ^
  -p 8080:8080 ^
  -e PORT=8080 ^
  --name frontend_momopass ^
  --restart unless-stopped ^
  app-insights-dashboard
```

**Linux/Mac:**
```bash
docker run -d \
  -p 8080:8080 \
  -e PORT=8080 \
  --name frontend_momopass \
  --restart unless-stopped \
  app-insights-dashboard
```

### Step 5: Verify

```bash
# Check container is running
docker ps | grep frontend_momopass

# Check logs
docker logs frontend_momopass

# Test in browser
# Open: http://localhost:8080
# Open browser console (F12) and check Network tab
# API calls should now go to http://172.30.38.193:5005
```

---

## 🔍 Verification Steps

### 1. Check Build Arguments Were Applied

```bash
# The build should show these values during npm run build
# Look for output like:
# Creating an optimized production build...
# Environment variables:
#   REACT_APP_API_PROTOCOL=http
#   REACT_APP_API_HOSTNAME=172.30.38.193
#   REACT_APP_API_PORT=5005
```

### 2. Check API Calls in Browser

1. Open `http://localhost:8080`
2. Press `F12` to open Developer Tools
3. Go to **Network** tab
4. Refresh the page
5. Look for API calls - they should go to `http://172.30.38.193:5005`

### 3. Check JavaScript Bundle

```bash
# Extract and check the built JavaScript
docker run --rm app-insights-dashboard cat /usr/share/nginx/html/static/js/main.*.js | grep "172.30.38.193"

# Should show port 5005, not 8081
```

---

## 📝 Understanding Build vs Runtime Variables

### Build-Time Variables (Baked into JavaScript)

These are embedded into the JavaScript bundle during `npm run build`:

```dockerfile
ARG REACT_APP_API_PROTOCOL=http
ARG REACT_APP_API_HOSTNAME=172.30.38.193
ARG REACT_APP_API_PORT=5005
```

**When to change:** When you need different API endpoints  
**How to change:** Rebuild the Docker image with new `--build-arg` values

### Runtime Variables (Can Change Without Rebuild)

These can be changed when starting the container:

```bash
-e PORT=8080
```

**When to change:** When you need different container port  
**How to change:** Just restart container with new `-e` values

---

## 🚀 Quick Rebuild Script

### Windows (rebuild.bat)

```batch
@echo off
echo Stopping and removing old container...
docker stop frontend_momopass 2>nul
docker rm frontend_momopass 2>nul

echo Removing old image...
docker rmi app-insights-dashboard 2>nul

echo Building new image with correct API configuration...
docker build ^
  --build-arg REACT_APP_API_PROTOCOL=http ^
  --build-arg REACT_APP_API_HOSTNAME=172.30.38.193 ^
  --build-arg REACT_APP_API_PORT=5005 ^
  --build-arg REACT_APP_REGION_NAME="SAN Region" ^
  -t app-insights-dashboard .

echo Starting new container...
docker run -d ^
  -p 8080:8080 ^
  -e PORT=8080 ^
  --name frontend_momopass ^
  --restart unless-stopped ^
  app-insights-dashboard

echo Done! Check http://localhost:8080
docker logs frontend_momopass
```

### Linux/Mac (rebuild.sh)

```bash
#!/bin/bash

echo "Stopping and removing old container..."
docker stop frontend_momopass 2>/dev/null
docker rm frontend_momopass 2>/dev/null

echo "Removing old image..."
docker rmi app-insights-dashboard 2>/dev/null

echo "Building new image with correct API configuration..."
docker build \
  --build-arg REACT_APP_API_PROTOCOL=http \
  --build-arg REACT_APP_API_HOSTNAME=172.30.38.193 \
  --build-arg REACT_APP_API_PORT=5005 \
  --build-arg REACT_APP_REGION_NAME="SAN Region" \
  -t app-insights-dashboard .

echo "Starting new container..."
docker run -d \
  -p 8080:8080 \
  -e PORT=8080 \
  --name frontend_momopass \
  --restart unless-stopped \
  app-insights-dashboard

echo "Done! Check http://localhost:8080"
docker logs frontend_momopass
```

---

## 🔧 Different API Configurations

### For HTTPS API

```bash
docker build \
  --build-arg REACT_APP_API_PROTOCOL=https \
  --build-arg REACT_APP_API_HOSTNAME=api.example.com \
  --build-arg REACT_APP_API_PORT=443 \
  -t app-insights-dashboard .
```

### For Different Port

```bash
docker build \
  --build-arg REACT_APP_API_PROTOCOL=http \
  --build-arg REACT_APP_API_HOSTNAME=172.30.38.193 \
  --build-arg REACT_APP_API_PORT=8081 \
  -t app-insights-dashboard .
```

### For Different Hostname

```bash
docker build \
  --build-arg REACT_APP_API_PROTOCOL=http \
  --build-arg REACT_APP_API_HOSTNAME=192.168.1.100 \
  --build-arg REACT_APP_API_PORT=5005 \
  -t app-insights-dashboard .
```

---

## ⚠️ Common Mistakes

### Mistake 1: Using -e Instead of --build-arg

❌ **Wrong:**
```bash
docker build -e REACT_APP_API_PORT=5005 -t app-insights-dashboard .
```

✅ **Correct:**
```bash
docker build --build-arg REACT_APP_API_PORT=5005 -t app-insights-dashboard .
```

### Mistake 2: Not Rebuilding After Changing API

❌ **Wrong:**
```bash
# Just restarting container won't change API endpoint
docker restart frontend_momopass
```

✅ **Correct:**
```bash
# Must rebuild image
docker build --build-arg REACT_APP_API_PORT=5005 -t app-insights-dashboard .
docker rm -f frontend_momopass
docker run -d -p 8080:8080 --name frontend_momopass app-insights-dashboard
```

### Mistake 3: Forgetting to Remove Old Container

❌ **Wrong:**
```bash
docker build -t app-insights-dashboard .
docker run -d --name frontend_momopass app-insights-dashboard
# Error: container name already in use
```

✅ **Correct:**
```bash
docker stop frontend_momopass
docker rm frontend_momopass
docker build -t app-insights-dashboard .
docker run -d --name frontend_momopass app-insights-dashboard
```

---

## 📊 Troubleshooting

### Issue: Still Calling Wrong Port

**Check 1: Verify build arguments were used**
```bash
docker history app-insights-dashboard | grep REACT_APP
```

**Check 2: Check JavaScript bundle**
```bash
docker run --rm app-insights-dashboard sh -c "cat /usr/share/nginx/html/static/js/main.*.js" | grep -o "172.30.38.193:[0-9]*" | head -1
```

**Check 3: Rebuild with --no-cache**
```bash
docker build --no-cache \
  --build-arg REACT_APP_API_PORT=5005 \
  -t app-insights-dashboard .
```

### Issue: Build Fails

**Check 1: Verify you're in correct directory**
```bash
pwd
# Should show: .../app-insights-dashboard
ls
# Should show: Dockerfile, package.json, src/, etc.
```

**Check 2: Check Docker is running**
```bash
docker ps
```

**Check 3: Check for syntax errors**
```bash
docker build --build-arg REACT_APP_API_PORT=5005 -t app-insights-dashboard . 2>&1 | more
```

---

## 💡 Best Practices

### 1. Document Your API Configuration

Create a file documenting your API setup:

```bash
# api-config.txt
API_PROTOCOL=http
API_HOSTNAME=172.30.38.193
API_PORT=5005
```

### 2. Use Build Scripts

Create reusable build scripts with your configuration:

```bash
# build.sh
#!/bin/bash
source api-config.txt

docker build \
  --build-arg REACT_APP_API_PROTOCOL=$API_PROTOCOL \
  --build-arg REACT_APP_API_HOSTNAME=$API_HOSTNAME \
  --build-arg REACT_APP_API_PORT=$API_PORT \
  -t app-insights-dashboard .
```

### 3. Tag Your Images

```bash
# Tag with API configuration
docker build \
  --build-arg REACT_APP_API_PORT=5005 \
  -t app-insights-dashboard:api-5005 .

# Tag with version
docker build \
  --build-arg REACT_APP_API_PORT=5005 \
  -t app-insights-dashboard:v1.0.0 .
```

### 4. Test Before Deploying

```bash
# Build
docker build --build-arg REACT_APP_API_PORT=5005 -t app-insights-dashboard:test .

# Test
docker run -d -p 9999:8080 -e PORT=8080 --name test app-insights-dashboard:test

# Verify
curl http://localhost:9999
# Check in browser

# If good, tag as latest
docker tag app-insights-dashboard:test app-insights-dashboard:latest

# Cleanup test
docker rm -f test
```

---

## 📋 Summary

**Problem:** API calls going to port 8081 instead of 5005

**Root Cause:** Image was built with wrong `REACT_APP_API_PORT`

**Solution:** Rebuild image with correct build arguments

**Command:**
```bash
docker build \
  --build-arg REACT_APP_API_PROTOCOL=http \
  --build-arg REACT_APP_API_HOSTNAME=172.30.38.193 \
  --build-arg REACT_APP_API_PORT=5005 \
  -t app-insights-dashboard .
```

**Remember:** React environment variables are **BUILD TIME**, not runtime!
