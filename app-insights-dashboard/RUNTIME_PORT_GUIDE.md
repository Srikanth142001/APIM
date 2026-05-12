# Runtime Port Configuration Guide

This guide explains how to configure the application port at runtime using environment variables.

## How It Works

### Architecture

```
Docker Build Time:
  ├── React app compiled to static files
  └── nginx.conf.template created with ${PORT} placeholder

Docker Runtime:
  ├── PORT environment variable set (default: 80)
  ├── docker-entrypoint.sh runs
  ├── envsubst replaces ${PORT} in template
  ├── nginx.conf generated with actual port
  └── nginx starts on specified port
```

### Files Involved

1. **nginx.conf.template** - Template with `${PORT}` placeholder
2. **docker-entrypoint.sh** - Script that substitutes PORT value
3. **Dockerfile** - Sets up the environment
4. **docker-compose.yml** - Orchestrates the container

---

## Usage Examples

### Example 1: Default Port (80)

```bash
# Build
docker build -t dashboard .

# Run (uses default PORT=80)
docker run -d -p 3000:80 --name dashboard dashboard

# Access
curl http://localhost:3000
```

**What happens:**
- Container nginx listens on port 80
- Host port 3000 maps to container port 80
- Access via `localhost:3000`

### Example 2: Custom Container Port (8080)

```bash
# Build
docker build -t dashboard .

# Run with custom port
docker run -d \
  -p 8080:8080 \
  -e PORT=8080 \
  --name dashboard \
  dashboard

# Access
curl http://localhost:8080
```

**What happens:**
- `PORT=8080` environment variable set
- entrypoint.sh substitutes `${PORT}` with `8080`
- nginx listens on port 8080
- Host port 8080 maps to container port 8080

### Example 3: Different Host and Container Ports

```bash
# Build
docker build -t dashboard .

# Run: Host 9000, Container 5000
docker run -d \
  -p 9000:5000 \
  -e PORT=5000 \
  --name dashboard \
  dashboard

# Access
curl http://localhost:9000
```

**What happens:**
- nginx listens on port 5000 inside container
- Host port 9000 maps to container port 5000
- Access via `localhost:9000`

### Example 4: Multiple Instances on Different Ports

```bash
# Instance 1: Port 3000
docker run -d \
  -p 3000:80 \
  -e PORT=80 \
  --name dashboard-3000 \
  dashboard

# Instance 2: Port 4000
docker run -d \
  -p 4000:80 \
  -e PORT=80 \
  --name dashboard-4000 \
  dashboard

# Instance 3: Port 5000
docker run -d \
  -p 5000:80 \
  -e PORT=80 \
  --name dashboard-5000 \
  dashboard
```

**Access:**
- Instance 1: `http://localhost:3000`
- Instance 2: `http://localhost:4000`
- Instance 3: `http://localhost:5000`

---

## Using Docker Compose

### Basic Configuration

**docker-compose.yml:**
```yaml
version: '3.8'

services:
  dashboard:
    build:
      context: .
      args:
        - REACT_APP_REGION_NAME=${REACT_APP_REGION_NAME:-SAN Region}
    environment:
      - PORT=${PORT:-80}
    ports:
      - "${HOST_PORT:-3000}:${PORT:-80}"
    restart: unless-stopped
```

**Usage:**
```bash
# Default (port 3000)
docker-compose up -d

# Custom port
PORT=8080 HOST_PORT=8080 docker-compose up -d

# Using .env file
echo "PORT=8080" > .env
echo "HOST_PORT=8080" >> .env
docker-compose up -d
```

### Multi-Region Configuration

**docker-compose.multi.yml:**
```yaml
version: '3.8'

services:
  dashboard-san:
    build:
      context: .
      args:
        - REACT_APP_REGION_NAME=SAN Region
    environment:
      - PORT=80
    ports:
      - "3000:80"
    container_name: dashboard-san

  dashboard-useast:
    build:
      context: .
      args:
        - REACT_APP_REGION_NAME=US East Region
    environment:
      - PORT=80
    ports:
      - "4000:80"
    container_name: dashboard-useast

  dashboard-euwest:
    build:
      context: .
      args:
        - REACT_APP_REGION_NAME=EU West Region
    environment:
      - PORT=80
    ports:
      - "5000:80"
    container_name: dashboard-euwest
```

**Usage:**
```bash
docker-compose -f docker-compose.multi.yml up -d

# Access:
# SAN: http://localhost:3000
# US East: http://localhost:4000
# EU West: http://localhost:5000
```

---

## Environment Variables

### Available Variables

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `PORT` | Port nginx listens on inside container | `80` | `8080` |
| `REACT_APP_REGION_NAME` | Region name displayed in UI | `SAN Region` | `US East` |
| `REACT_APP_API_BASE_URL` | Backend API URL | - | `http://api.example.com` |

### Setting Environment Variables

**Method 1: Command Line**
```bash
docker run -e PORT=8080 -e REACT_APP_REGION_NAME="US East" dashboard
```

**Method 2: .env File**
```bash
# Create .env.docker
cat > .env.docker << EOF
PORT=8080
REACT_APP_REGION_NAME=US East Region
REACT_APP_API_BASE_URL=http://172.16.11.241:5000
EOF

# Use with docker-compose
docker-compose --env-file .env.docker up -d
```

**Method 3: docker-compose.yml**
```yaml
services:
  dashboard:
    environment:
      - PORT=8080
      - REACT_APP_REGION_NAME=US East Region
```

---

## Verification & Testing

### 1. Check Container is Running

```bash
docker ps
# Should show your container with port mapping
```

### 2. Check Port Mapping

```bash
docker port dashboard
# Output: 80/tcp -> 0.0.0.0:3000
```

### 3. Check Environment Variables

```bash
docker exec dashboard env | grep PORT
# Output: PORT=80
```

### 4. Check Generated nginx Config

```bash
docker exec dashboard cat /etc/nginx/conf.d/default.conf
# Should show actual port number (not ${PORT})
```

### 5. Check nginx is Listening

```bash
docker exec dashboard netstat -tlnp | grep nginx
# Should show nginx listening on your specified port
```

### 6. Test HTTP Request

```bash
# Test from host
curl http://localhost:3000

# Test from inside container
docker exec dashboard wget -O- http://localhost:80
```

### 7. Check Logs

```bash
# View startup logs
docker logs dashboard

# Follow logs
docker logs -f dashboard

# Check nginx access logs
docker exec dashboard tail -f /var/log/nginx/access.log

# Check nginx error logs
docker exec dashboard tail -f /var/log/nginx/error.log
```

---

## Troubleshooting

### Issue 1: Port Already in Use

**Error:**
```
Error starting userland proxy: listen tcp4 0.0.0.0:3000: bind: address already in use
```

**Solution:**
```bash
# Find what's using the port
netstat -ano | findstr :3000

# Use different port
docker run -p 4000:80 dashboard
```

### Issue 2: nginx Won't Start

**Check logs:**
```bash
docker logs dashboard
```

**Common causes:**
- Invalid port number
- nginx config syntax error
- Permission issues

**Verify config:**
```bash
docker exec dashboard nginx -t
```

### Issue 3: Can't Access Application

**Check 1: Container running?**
```bash
docker ps | grep dashboard
```

**Check 2: Port mapped correctly?**
```bash
docker port dashboard
```

**Check 3: nginx listening?**
```bash
docker exec dashboard netstat -tlnp
```

**Check 4: Firewall blocking?**
```bash
# Windows
netsh advfirewall firewall show rule name=all | findstr 3000

# Test locally
curl http://localhost:3000
```

### Issue 4: Wrong Port in nginx Config

**Check generated config:**
```bash
docker exec dashboard cat /etc/nginx/conf.d/default.conf
```

**If ${PORT} is still there:**
- entrypoint.sh didn't run properly
- envsubst not installed
- Template file missing

**Fix:**
```bash
# Rebuild image
docker build --no-cache -t dashboard .

# Run again
docker run -p 3000:80 -e PORT=80 dashboard
```

### Issue 5: Health Check Failing

**Test health endpoint:**
```bash
curl http://localhost:3000/health
# Should return: healthy
```

**If fails:**
```bash
# Check nginx status
docker exec dashboard ps aux | grep nginx

# Check nginx error logs
docker exec dashboard cat /var/log/nginx/error.log
```

---

## Advanced Configuration

### Custom nginx Configuration

If you need to modify nginx settings beyond the port:

**1. Create custom template:**
```nginx
# custom-nginx.conf.template
server {
    listen ${PORT};
    
    # Your custom settings
    client_max_body_size 100M;
    proxy_read_timeout 300s;
    
    location / {
        try_files $uri /index.html;
    }
}
```

**2. Update Dockerfile:**
```dockerfile
COPY custom-nginx.conf.template /etc/nginx/templates/default.conf.template
```

### Multiple Port Exposure

If you need nginx to listen on multiple ports:

**nginx.conf.template:**
```nginx
server {
    listen ${PORT};
    listen ${PORT_SSL} ssl;
    
    # SSL configuration
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    
    location / {
        try_files $uri /index.html;
    }
}
```

**Run:**
```bash
docker run -d \
  -p 3000:80 \
  -p 3443:443 \
  -e PORT=80 \
  -e PORT_SSL=443 \
  dashboard
```

---

## Best Practices

### 1. Use Standard Ports in Container

```bash
# Good: Standard port 80 in container
docker run -p 3000:80 -e PORT=80 dashboard

# Avoid: Non-standard port in container (unless necessary)
docker run -p 3000:8888 -e PORT=8888 dashboard
```

### 2. Document Port Usage

Keep a record of which ports are used:
```
Port 3000: SAN Region Dashboard
Port 4000: US East Dashboard
Port 5000: EU West Dashboard
Port 6000: APAC Dashboard
```

### 3. Use Environment Files

```bash
# .env.production
PORT=80
HOST_PORT=3000
REACT_APP_REGION_NAME=Production - SAN
REACT_APP_API_BASE_URL=https://api.production.com

# Deploy
docker-compose --env-file .env.production up -d
```

### 4. Health Checks

Add health checks to docker-compose:
```yaml
services:
  dashboard:
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:${PORT}/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

### 5. Logging

Configure proper logging:
```yaml
services:
  dashboard:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

---

## Quick Reference

### Common Commands

```bash
# Build
docker build -t dashboard .

# Run default
docker run -d -p 3000:80 dashboard

# Run custom port
docker run -d -p 8080:8080 -e PORT=8080 dashboard

# Stop
docker stop dashboard

# Start
docker start dashboard

# Restart
docker restart dashboard

# Remove
docker rm -f dashboard

# Logs
docker logs dashboard

# Shell access
docker exec -it dashboard sh

# Check config
docker exec dashboard cat /etc/nginx/conf.d/default.conf
```

### Port Mapping Patterns

```bash
# Pattern: -p HOST_PORT:CONTAINER_PORT -e PORT=CONTAINER_PORT

# Standard
-p 3000:80 -e PORT=80

# Custom
-p 8080:8080 -e PORT=8080

# Different
-p 9000:5000 -e PORT=5000
```

---

## Summary

✅ **Port is configured at RUNTIME** using `PORT` environment variable  
✅ **nginx.conf.template** contains `${PORT}` placeholder  
✅ **docker-entrypoint.sh** substitutes actual port value  
✅ **nginx** starts on the specified port  
✅ **Docker** maps host port to container port  

**Key Command:**
```bash
docker run -d -p HOST_PORT:CONTAINER_PORT -e PORT=CONTAINER_PORT dashboard
```
