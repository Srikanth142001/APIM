# 🔴 QUICK FIX - API Port Issue

## Problem
Frontend is calling `http://172.30.38.193:8081` but backend is on port `5005`

## Root Cause
The Docker image was built with `REACT_APP_API_PORT=8081` baked into the JavaScript. React environment variables are embedded at BUILD time, not runtime.

## ✅ Solution: Rebuild the Image

### Windows Users:

```cmd
cd app-insights-dashboard
rebuild.bat
```

### Linux/Mac Users:

```bash
cd app-insights-dashboard
chmod +x rebuild.sh
./rebuild.sh
```

### Manual Steps (if scripts don't work):

**1. Stop and remove old container:**
```bash
docker stop frontend_momopass
docker rm frontend_momopass
```

**2. Remove old image:**
```bash
docker rmi app-insights-dashboard
```

**3. Rebuild with correct port:**

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

**4. Run new container:**

**Windows:**
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

**5. Verify:**
```bash
# Check container
docker ps | grep frontend_momopass

# Check logs
docker logs frontend_momopass

# Open browser
# http://localhost:8080
# Press F12, go to Network tab
# API calls should now go to http://172.30.38.193:5005
```

## ✅ Expected Result

After rebuild:
- Frontend: `http://localhost:8080`
- API calls: `http://172.30.38.193:5005` ✅ (was 8081 ❌)

## 📝 Why This Happened

React environment variables starting with `REACT_APP_` are:
- ✅ Embedded into JavaScript during `npm run build`
- ❌ NOT changeable at runtime with `-e` flag

To change API endpoint, you MUST rebuild the image with correct `--build-arg` values.

## 🔍 Verify It's Fixed

1. Open `http://localhost:8080` in browser
2. Press `F12` to open Developer Tools
3. Go to **Network** tab
4. Refresh the page
5. Look at API requests - should show `http://172.30.38.193:5005`

## 📚 More Info

- **REBUILD_GUIDE.md** - Detailed rebuild instructions
- **ENV_VARIABLES_GUIDE.md** - Environment variables guide
- **DEPLOYMENT_GUIDE.md** - Full deployment guide
