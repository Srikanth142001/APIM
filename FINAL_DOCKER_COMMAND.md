# Final Docker Run Command

## ✅ Complete Command with All Environment Variables

### For Windows (CMD):
```cmd
docker run -d ^
  -p 8080:8080 ^
  -e PORT=8080 ^
  -e REACT_APP_API_PROTOCOL=http ^
  -e REACT_APP_API_HOSTNAME=172.30.38.193 ^
  -e REACT_APP_API_PORT=5005 ^
  -e REACT_APP_REGION_NAME="SAN Region" ^
  -e REACT_APP_ENV=development ^
  --name frontend_momopass ^
  --restart unless-stopped ^
  app-insights-dashboard
```

### For Windows (PowerShell):
```powershell
docker run -d `
  -p 8080:8080 `
  -e PORT=8080 `
  -e REACT_APP_API_PROTOCOL=http `
  -e REACT_APP_API_HOSTNAME=172.30.38.193 `
  -e REACT_APP_API_PORT=5005 `
  -e REACT_APP_REGION_NAME="SAN Region" `
  -e REACT_APP_ENV=development `
  --name frontend_momopass `
  --restart unless-stopped `
  app-insights-dashboard
```

### For Linux/Mac:
```bash
docker run -d \
  -p 8080:8080 \
  -e PORT=8080 \
  -e REACT_APP_API_PROTOCOL=http \
  -e REACT_APP_API_HOSTNAME=172.30.38.193 \
  -e REACT_APP_API_PORT=5005 \
  -e REACT_APP_REGION_NAME="SAN Region" \
  -e REACT_APP_ENV=development \
  --name frontend_momopass \
  --restart unless-stopped \
  app-insights-dashboard
```

---

## 📋 Environment Variables Explained

| Variable | Value | Description |
|----------|-------|-------------|
| `PORT` | `8080` | Port nginx listens on inside container |
| `REACT_APP_API_PROTOCOL` | `http` | API protocol (http or https) |
| `REACT_APP_API_HOSTNAME` | `172.30.38.193` | API server IP or hostname |
| `REACT_APP_API_PORT` | `5005` | API server port |
| `REACT_APP_REGION_NAME` | `SAN Region` | Region name shown in dashboard |
| `REACT_APP_ENV` | `development` | Environment identifier |

**Result:** API calls will go to `http://172.30.38.193:5005`

---

## 🚀 Quick Start

### Step 1: Build
```bash
cd app-insights-dashboard
docker build -t app-insights-dashboard .
```

### Step 2: Run
```bash
# Use the appropriate command for your OS (see above)
docker-run-commands.bat  # Windows
# OR
./docker-run-commands.sh  # Linux/Mac
```

### Step 3: Verify
```bash
# Check container
docker ps | grep frontend_momopass

# Check logs
docker logs frontend_momopass

# Test application
curl http://localhost:8080
# OR open browser: http://localhost:8080
```

---

## 🔧 Customization Examples

### Example 1: HTTPS API
```bash
docker run -d \
  -p 8080:8080 \
  -e PORT=8080 \
  -e REACT_APP_API_PROTOCOL=https \
  -e REACT_APP_API_HOSTNAME=api.example.com \
  -e REACT_APP_API_PORT=443 \
  -e REACT_APP_REGION_NAME="Production" \
  --name frontend_momopass \
  app-insights-dashboard
```
**API URL:** `https://api.example.com:443`

### Example 2: Different Port
```bash
docker run -d \
  -p 3000:3000 \
  -e PORT=3000 \
  -e REACT_APP_API_PROTOCOL=http \
  -e REACT_APP_API_HOSTNAME=192.168.1.100 \
  -e REACT_APP_API_PORT=8081 \
  -e REACT_APP_REGION_NAME="Dev" \
  --name frontend_momopass \
  app-insights-dashboard
```
**API URL:** `http://192.168.1.100:8081`

### Example 3: Production Setup
```bash
docker run -d \
  -p 80:80 \
  -e PORT=80 \
  -e REACT_APP_API_PROTOCOL=https \
  -e REACT_APP_API_HOSTNAME=api.production.com \
  -e REACT_APP_API_PORT=443 \
  -e REACT_APP_REGION_NAME="Production - SAN" \
  -e REACT_APP_ENV=production \
  --name frontend_momopass \
  app-insights-dashboard
```
**API URL:** `https://api.production.com:443`

---

## 📝 Management Commands

```bash
# View logs
docker logs -f frontend_momopass

# Stop
docker stop frontend_momopass

# Start
docker start frontend_momopass

# Restart
docker restart frontend_momopass

# Remove
docker rm -f frontend_momopass

# Check environment variables
docker exec frontend_momopass env | grep REACT_APP

# Shell access
docker exec -it frontend_momopass sh
```

---

## 📚 Documentation

- **ENV_VARIABLES_GUIDE.md** - Complete environment variables guide
- **DEPLOYMENT_GUIDE.md** - Full deployment documentation
- **RUNTIME_PORT_GUIDE.md** - Port configuration guide
- **ARCHITECTURE_EXPLAINED.md** - Architecture overview

---

## ✅ What's Configured

- ✅ Container port: 8080
- ✅ API Protocol: http
- ✅ API Hostname: 172.30.38.193
- ✅ API Port: 5005
- ✅ Region Name: SAN Region
- ✅ Environment: development
- ✅ Auto-restart: enabled

**Access:** http://localhost:8080  
**API Endpoint:** http://172.30.38.193:5005
