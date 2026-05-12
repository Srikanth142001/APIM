# Complete Deployment Guide

## Quick Start

### Step 1: Build the Docker Image

```bash
cd app-insights-dashboard
docker build -t app-insights-dashboard .
```

### Step 2: Run the Container

**For Windows (CMD):**
```cmd
docker run -d ^
  -p 8080:8080 ^
  -e PORT=8080 ^
  -e REACT_APP_API_BASE_URL=http://172.30.38.193:5005 ^
  -e REACT_APP_REGION_NAME="SAN Region" ^
  -e REACT_APP_ENV=development ^
  --name frontend_momopass ^
  --restart unless-stopped ^
  app-insights-dashboard
```

**For Windows (PowerShell):**
```powershell
docker run -d `
  -p 8080:8080 `
  -e PORT=8080 `
  -e REACT_APP_API_BASE_URL=http://172.30.38.193:5005 `
  -e REACT_APP_REGION_NAME="SAN Region" `
  -e REACT_APP_ENV=development `
  --name frontend_momopass `
  --restart unless-stopped `
  app-insights-dashboard
```

**For Linux/Mac:**
```bash
docker run -d \
  -p 8080:8080 \
  -e PORT=8080 \
  -e REACT_APP_API_BASE_URL=http://172.30.38.193:5005 \
  -e REACT_APP_REGION_NAME="SAN Region" \
  -e REACT_APP_ENV=development \
  --name frontend_momopass \
  --restart unless-stopped \
  app-insights-dashboard
```

### Step 3: Verify Deployment

```bash
# Check if container is running
docker ps | grep frontend_momopass

# Check logs
docker logs frontend_momopass

# Test the application
curl http://localhost:8080
# Or open in browser: http://localhost:8080
```

---

## Environment Variables Explained

| Variable | Description | Example Value | Required |
|----------|-------------|---------------|----------|
| `PORT` | Port nginx listens on inside container | `8080` | Yes |
| `REACT_APP_API_BASE_URL` | Backend API URL | `http://172.30.38.193:5005` | Yes |
| `REACT_APP_REGION_NAME` | Region name shown in dashboard header | `SAN Region` | No (default: SAN Region) |
| `REACT_APP_ENV` | Environment identifier | `development` or `production` | No |

---

## Different Deployment Scenarios

### Scenario 1: Development (Port 8080)

```bash
docker run -d \
  -p 8080:8080 \
  -e PORT=8080 \
  -e REACT_APP_API_BASE_URL=http://172.30.38.193:5005 \
  -e REACT_APP_REGION_NAME="SAN Region - Dev" \
  -e REACT_APP_ENV=development \
  --name frontend_momopass_dev \
  --restart unless-stopped \
  app-insights-dashboard
```

**Access:** http://localhost:8080

### Scenario 2: Production (Port 80)

```bash
docker run -d \
  -p 80:80 \
  -e PORT=80 \
  -e REACT_APP_API_BASE_URL=http://172.30.38.193:5005 \
  -e REACT_APP_REGION_NAME="SAN Region - Production" \
  -e REACT_APP_ENV=production \
  --name frontend_momopass_prod \
  --restart unless-stopped \
  app-insights-dashboard
```

**Access:** http://localhost

### Scenario 3: Multiple Regions

**SAN Region (Port 3000):**
```bash
docker run -d \
  -p 3000:80 \
  -e PORT=80 \
  -e REACT_APP_API_BASE_URL=http://172.30.38.193:5005 \
  -e REACT_APP_REGION_NAME="SAN Region" \
  -e REACT_APP_ENV=production \
  --name frontend_momopass_san \
  --restart unless-stopped \
  app-insights-dashboard
```

**US East Region (Port 4000):**
```bash
docker run -d \
  -p 4000:80 \
  -e PORT=80 \
  -e REACT_APP_API_BASE_URL=http://172.30.38.194:5005 \
  -e REACT_APP_REGION_NAME="US East Region" \
  -e REACT_APP_ENV=production \
  --name frontend_momopass_useast \
  --restart unless-stopped \
  app-insights-dashboard
```

**EU West Region (Port 5000):**
```bash
docker run -d \
  -p 5000:80 \
  -e PORT=80 \
  -e REACT_APP_API_BASE_URL=http://172.30.38.195:5005 \
  -e REACT_APP_REGION_NAME="EU West Region" \
  -e REACT_APP_ENV=production \
  --name frontend_momopass_euwest \
  --restart unless-stopped \
  app-insights-dashboard
```

---

## Using Docker Compose

### Create docker-compose.yml

```yaml
version: '3.8'

services:
  frontend_momopass:
    image: app-insights-dashboard
    container_name: frontend_momopass
    ports:
      - "8080:8080"
    environment:
      - PORT=8080
      - REACT_APP_API_BASE_URL=http://172.30.38.193:5005
      - REACT_APP_REGION_NAME=SAN Region
      - REACT_APP_ENV=development
    restart: unless-stopped
    networks:
      - app-network

networks:
  app-network:
    driver: bridge
```

### Deploy with Docker Compose

```bash
# Start
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down

# Restart
docker-compose restart
```

---

## Using Environment File

### Create .env.production

```bash
# .env.production
PORT=8080
REACT_APP_API_BASE_URL=http://172.30.38.193:5005
REACT_APP_REGION_NAME=SAN Region
REACT_APP_ENV=production
```

### Run with Environment File

```bash
docker run -d \
  -p 8080:8080 \
  --env-file .env.production \
  --name frontend_momopass \
  --restart unless-stopped \
  app-insights-dashboard
```

### Docker Compose with Environment File

```yaml
version: '3.8'

services:
  frontend_momopass:
    image: app-insights-dashboard
    container_name: frontend_momopass
    ports:
      - "${PORT}:${PORT}"
    env_file:
      - .env.production
    restart: unless-stopped
```

```bash
docker-compose --env-file .env.production up -d
```

---

## Complete Deployment Workflow

### 1. Prepare Environment

```bash
# Navigate to project directory
cd app-insights-dashboard

# Ensure all files are present
ls -la
# Should see: Dockerfile, nginx.conf.template, docker-entrypoint.sh, etc.
```

### 2. Build Image

```bash
# Build with tag
docker build -t app-insights-dashboard:latest .

# Or build with version tag
docker build -t app-insights-dashboard:v1.0.0 .

# Verify image
docker images | grep app-insights-dashboard
```

### 3. Test Locally

```bash
# Run test container
docker run -d \
  -p 8080:8080 \
  -e PORT=8080 \
  -e REACT_APP_API_BASE_URL=http://172.30.38.193:5005 \
  -e REACT_APP_REGION_NAME="SAN Region - Test" \
  -e REACT_APP_ENV=development \
  --name test_frontend \
  app-insights-dashboard

# Wait a few seconds
sleep 5

# Test
curl http://localhost:8080

# Check logs
docker logs test_frontend

# If successful, remove test container
docker rm -f test_frontend
```

### 4. Deploy Production

```bash
# Stop existing container if any
docker stop frontend_momopass 2>/dev/null || true
docker rm frontend_momopass 2>/dev/null || true

# Deploy new container
docker run -d \
  -p 8080:8080 \
  -e PORT=8080 \
  -e REACT_APP_API_BASE_URL=http://172.30.38.193:5005 \
  -e REACT_APP_REGION_NAME="SAN Region" \
  -e REACT_APP_ENV=production \
  --name frontend_momopass \
  --restart unless-stopped \
  app-insights-dashboard

# Verify
docker ps | grep frontend_momopass
docker logs frontend_momopass
```

### 5. Verify Deployment

```bash
# Check container status
docker ps -a | grep frontend_momopass

# Check logs
docker logs -f frontend_momopass

# Check environment variables
docker exec frontend_momopass env | grep REACT_APP

# Check nginx config
docker exec frontend_momopass cat /etc/nginx/conf.d/default.conf

# Test health endpoint
curl http://localhost:8080/health

# Test application
curl http://localhost:8080
```

---

## Management Commands

### View Logs

```bash
# View all logs
docker logs frontend_momopass

# Follow logs (real-time)
docker logs -f frontend_momopass

# Last 100 lines
docker logs --tail 100 frontend_momopass

# Logs with timestamps
docker logs -t frontend_momopass
```

### Container Control

```bash
# Stop container
docker stop frontend_momopass

# Start container
docker start frontend_momopass

# Restart container
docker restart frontend_momopass

# Remove container
docker rm -f frontend_momopass

# Pause container
docker pause frontend_momopass

# Unpause container
docker unpause frontend_momopass
```

### Inspect Container

```bash
# Full inspection
docker inspect frontend_momopass

# Get IP address
docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' frontend_momopass

# Get port mapping
docker port frontend_momopass

# Get environment variables
docker exec frontend_momopass env

# Get resource usage
docker stats frontend_momopass
```

### Access Container

```bash
# Open shell
docker exec -it frontend_momopass sh

# Run command
docker exec frontend_momopass ls -la /usr/share/nginx/html

# Check nginx config
docker exec frontend_momopass cat /etc/nginx/conf.d/default.conf

# Test nginx config
docker exec frontend_momopass nginx -t

# Reload nginx
docker exec frontend_momopass nginx -s reload
```

---

## Troubleshooting

### Issue 1: Container Won't Start

```bash
# Check logs
docker logs frontend_momopass

# Check if port is already in use
netstat -ano | findstr :8080

# Try different port
docker run -d -p 9090:8080 -e PORT=8080 --name frontend_momopass app-insights-dashboard
```

### Issue 2: Can't Access Application

```bash
# Check if container is running
docker ps | grep frontend_momopass

# Check port mapping
docker port frontend_momopass

# Test from inside container
docker exec frontend_momopass wget -O- http://localhost:8080

# Check nginx status
docker exec frontend_momopass ps aux | grep nginx

# Check nginx error logs
docker exec frontend_momopass cat /var/log/nginx/error.log
```

### Issue 3: Wrong API URL

```bash
# Check environment variable
docker exec frontend_momopass env | grep REACT_APP_API_BASE_URL

# If wrong, recreate container with correct URL
docker rm -f frontend_momopass
docker run -d \
  -p 8080:8080 \
  -e PORT=8080 \
  -e REACT_APP_API_BASE_URL=http://CORRECT_IP:5005 \
  --name frontend_momopass \
  app-insights-dashboard
```

### Issue 4: Region Name Not Showing

```bash
# Check if variable is set
docker exec frontend_momopass env | grep REACT_APP_REGION_NAME

# Note: Region name is baked into build, need to rebuild
docker build \
  --build-arg REACT_APP_REGION_NAME="Your Region" \
  -t app-insights-dashboard .
```

---

## Update/Upgrade Process

### Rolling Update

```bash
# 1. Build new image
docker build -t app-insights-dashboard:v2 .

# 2. Start new container on different port
docker run -d \
  -p 9090:8080 \
  -e PORT=8080 \
  -e REACT_APP_API_BASE_URL=http://172.30.38.193:5005 \
  -e REACT_APP_REGION_NAME="SAN Region" \
  --name frontend_momopass_v2 \
  app-insights-dashboard:v2

# 3. Test new version
curl http://localhost:9090

# 4. If good, switch
docker stop frontend_momopass
docker rm frontend_momopass
docker run -d \
  -p 8080:8080 \
  -e PORT=8080 \
  -e REACT_APP_API_BASE_URL=http://172.30.38.193:5005 \
  -e REACT_APP_REGION_NAME="SAN Region" \
  --name frontend_momopass \
  app-insights-dashboard:v2

# 5. Cleanup
docker rm frontend_momopass_v2
docker rmi app-insights-dashboard:v1
```

### Zero-Downtime Update

```bash
# 1. Start new container on different port
docker run -d \
  -p 9090:8080 \
  -e PORT=8080 \
  -e REACT_APP_API_BASE_URL=http://172.30.38.193:5005 \
  -e REACT_APP_REGION_NAME="SAN Region" \
  --name frontend_momopass_new \
  app-insights-dashboard:v2

# 2. Update load balancer/proxy to point to new container

# 3. Wait for traffic to drain from old container

# 4. Stop old container
docker stop frontend_momopass
docker rm frontend_momopass

# 5. Rename new container
docker rename frontend_momopass_new frontend_momopass
```

---

## Backup and Restore

### Backup Container Configuration

```bash
# Export container config
docker inspect frontend_momopass > frontend_momopass_config.json

# Save image
docker save app-insights-dashboard > app-insights-dashboard.tar

# Or compress
docker save app-insights-dashboard | gzip > app-insights-dashboard.tar.gz
```

### Restore from Backup

```bash
# Load image
docker load < app-insights-dashboard.tar

# Or from compressed
gunzip -c app-insights-dashboard.tar.gz | docker load

# Recreate container from config
# (Extract values from frontend_momopass_config.json and run docker run command)
```

---

## Monitoring

### Health Checks

```bash
# Check health endpoint
curl http://localhost:8080/health

# Continuous monitoring
watch -n 5 'curl -s http://localhost:8080/health'
```

### Resource Usage

```bash
# Real-time stats
docker stats frontend_momopass

# One-time stats
docker stats --no-stream frontend_momopass
```

### Logs Monitoring

```bash
# Follow logs
docker logs -f frontend_momopass

# Filter logs
docker logs frontend_momopass 2>&1 | grep ERROR

# Export logs
docker logs frontend_momopass > frontend_momopass.log
```

---

## Quick Reference

### One-Line Commands

```bash
# Build and run
docker build -t app-insights-dashboard . && docker run -d -p 8080:8080 -e PORT=8080 -e REACT_APP_API_BASE_URL=http://172.30.38.193:5005 -e REACT_APP_REGION_NAME="SAN Region" --name frontend_momopass app-insights-dashboard

# Stop and remove
docker stop frontend_momopass && docker rm frontend_momopass

# Restart
docker restart frontend_momopass

# View logs
docker logs -f frontend_momopass

# Shell access
docker exec -it frontend_momopass sh
```

---

## Summary

**Build:**
```bash
docker build -t app-insights-dashboard .
```

**Run:**
```bash
docker run -d \
  -p 8080:8080 \
  -e PORT=8080 \
  -e REACT_APP_API_BASE_URL=http://172.30.38.193:5005 \
  -e REACT_APP_REGION_NAME="SAN Region" \
  -e REACT_APP_ENV=development \
  --name frontend_momopass \
  --restart unless-stopped \
  app-insights-dashboard
```

**Access:**
```
http://localhost:8080
```

**Manage:**
```bash
docker logs -f frontend_momopass    # View logs
docker stop frontend_momopass       # Stop
docker start frontend_momopass      # Start
docker restart frontend_momopass    # Restart
docker rm -f frontend_momopass      # Remove
```
