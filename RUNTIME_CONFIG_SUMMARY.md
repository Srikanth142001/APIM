# Runtime Configuration Summary

## What Changed?

Your application now supports **RUNTIME configuration** for API endpoints and region names. This means you can run the same Docker image with different configurations without rebuilding.

## Key Features

### ✅ Before (Build Time Only)
- Had to rebuild Docker image to change API endpoint
- Had to rebuild Docker image to change region name
- One image = one configuration

### ✅ After (Runtime Configurable)
- **No rebuild** needed to change API endpoint
- **No rebuild** needed to change region name
- **No rebuild** needed to change frontend port
- **One image = unlimited configurations**

## How It Works

### 1. Runtime Configuration File
Created `public/config.js` that gets updated at container startup:
```javascript
window.ENV_CONFIG = {
  API_PROTOCOL: 'http',
  API_HOSTNAME: '172.30.38.193',
  API_PORT: '5005',
  REGION_NAME: 'SAN Region'
};
```

### 2. Updated API Config
Modified `src/config/apiConfig.js` to check runtime config first, then fall back to build-time env vars.

### 3. Updated Docker Entrypoint
Modified `docker-entrypoint.sh` to replace values in `config.js` at container startup using `envsubst`.

### 4. Updated Dashboard
Modified `Dashboard.js` to read region name from runtime config.

## Quick Start

### Build Once
```bash
docker build -t app-insights-dashboard:latest .
```

### Run Multiple Times with Different Configs

**Instance 1: SAN Region**
```bash
docker run -d -p 8080:8080 \
  -e PORT=8080 \
  -e REACT_APP_API_HOSTNAME=172.30.38.193 \
  -e REACT_APP_API_PORT=5005 \
  -e REACT_APP_REGION_NAME="SAN Region" \
  --name frontend_san \
  app-insights-dashboard:latest
```

**Instance 2: US East Region**
```bash
docker run -d -p 9090:9090 \
  -e PORT=9090 \
  -e REACT_APP_API_HOSTNAME=10.20.30.40 \
  -e REACT_APP_API_PORT=5006 \
  -e REACT_APP_REGION_NAME="US East Region" \
  --name frontend_useast \
  app-insights-dashboard:latest
```

## Environment Variables

| Variable | Purpose | Default | When Applied |
|----------|---------|---------|--------------|
| `PORT` | Frontend container port | `80` | Runtime |
| `REACT_APP_API_PROTOCOL` | Backend protocol (http/https) | `http` | Runtime |
| `REACT_APP_API_HOSTNAME` | Backend hostname/IP | `172.30.38.193` | Runtime |
| `REACT_APP_API_PORT` | Backend port | `5005` | Runtime |
| `REACT_APP_REGION_NAME` | Region display name | `SAN Region` | Runtime |

## Files Modified

1. ✅ `public/config.js` - NEW: Runtime configuration template
2. ✅ `public/index.html` - Added script tag to load config.js
3. ✅ `src/config/apiConfig.js` - Updated to read runtime config
4. ✅ `src/pages/Dashboard.js` - Updated to read runtime region name
5. ✅ `docker-entrypoint.sh` - Updated to replace runtime config values

## Files Created

1. ✅ `MULTI_INSTANCE_GUIDE.md` - Comprehensive guide for running multiple instances
2. ✅ `run-multiple-instances.bat` - Windows script to run 3 instances
3. ✅ `run-multiple-instances.sh` - Linux/Mac script to run 3 instances
4. ✅ `RUNTIME_CONFIG_SUMMARY.md` - This file

## Testing

### 1. Build the image
```bash
cd app-insights-dashboard
docker build -t app-insights-dashboard:latest .
```

### 2. Run with custom config
```bash
docker run -d -p 8080:8080 \
  -e PORT=8080 \
  -e REACT_APP_API_HOSTNAME=YOUR_API_HOST \
  -e REACT_APP_API_PORT=YOUR_API_PORT \
  -e REACT_APP_REGION_NAME="Your Region" \
  --name frontend_test \
  app-insights-dashboard:latest
```

### 3. Check logs
```bash
docker logs frontend_test
```

You should see:
```
==========================================
Starting App Insights Dashboard
==========================================
Container Port: 8080
API Endpoint: http://YOUR_API_HOST:YOUR_API_PORT
Region: Your Region
==========================================
```

### 4. Access dashboard
Open browser: http://localhost:8080

The dashboard header should show "Your Region" and API calls should go to your configured endpoint.

## Benefits

1. **Single Image, Multiple Deployments**: Build once, deploy to SAN, US East, EU West, etc.
2. **Easy Configuration**: Just pass environment variables at runtime
3. **No Rebuild**: Change API endpoint without rebuilding
4. **Cost Effective**: One image in registry, multiple configurations
5. **Fast Deployment**: No build time, just run with new env vars

## Backward Compatibility

✅ Still works with build-time env vars if runtime config is not provided
✅ Existing deployment scripts still work
✅ No breaking changes to existing functionality

## Next Steps

1. Build your Docker image once
2. Push to your container registry
3. Deploy to multiple regions with different env vars
4. Enjoy runtime configuration! 🎉
