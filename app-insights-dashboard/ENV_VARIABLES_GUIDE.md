# Environment Variables Guide

Complete guide for configuring the App Insights Dashboard using environment variables.

## Available Environment Variables

### Application Port

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `PORT` | Port nginx listens on inside container | `80` | `8080` |

### API Configuration

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `REACT_APP_API_PROTOCOL` | API protocol (http/https) | `http` | `https` |
| `REACT_APP_API_HOSTNAME` | API server hostname or IP | `172.30.38.193` | `api.example.com` |
| `REACT_APP_API_PORT` | API server port | `5005` | `443` |

### Application Configuration

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `REACT_APP_REGION_NAME` | Region name displayed in header | `SAN Region` | `US East Region` |
| `REACT_APP_ENV` | Environment identifier | `development` | `production` |

---

## Usage Examples

### Example 1: Basic HTTP API

```bash
docker run -d \
  -p 8080:8080 \
  -e PORT=8080 \
  -e REACT_APP_API_PROTOCOL=http \
  -e REACT_APP_API_HOSTNAME=172.30.38.193 \
  -e REACT_APP_API_PORT=5005 \
  -e REACT_APP_REGION_NAME="SAN Region" \
  --name frontend_momopass \
  app-insights-dashboard
```

**Result:** API calls will go to `http://172.30.38.193:5005`

### Example 2: HTTPS API

```bash
docker run -d \
  -p 8080:8080 \
  -e PORT=8080 \
  -e REACT_APP_API_PROTOCOL=https \
  -e REACT_APP_API_HOSTNAME=api.production.com \
  -e REACT_APP_API_PORT=443 \
  -e REACT_APP_REGION_NAME="Production" \
  -e REACT_APP_ENV=production \
  --name frontend_momopass \
  app-insights-dashboard
```

**Result:** API calls will go to `https://api.production.com:443`

### Example 3: Different API Port

```bash
docker run -d \
  -p 8080:8080 \
  -e PORT=8080 \
  -e REACT_APP_API_PROTOCOL=http \
  -e REACT_APP_API_HOSTNAME=192.168.1.100 \
  -e REACT_APP_API_PORT=8081 \
  -e REACT_APP_REGION_NAME="Dev Environment" \
  --name frontend_momopass \
  app-insights-dashboard
```

**Result:** API calls will go to `http://192.168.1.100:8081`

### Example 4: Domain Name

```bash
docker run -d \
  -p 80:80 \
  -e PORT=80 \
  -e REACT_APP_API_PROTOCOL=https \
  -e REACT_APP_API_HOSTNAME=backend.mycompany.com \
  -e REACT_APP_API_PORT=443 \
  -e REACT_APP_REGION_NAME="US East" \
  -e REACT_APP_ENV=production \
  --name frontend_momopass \
  app-insights-dashboard
```

**Result:** API calls will go to `https://backend.mycompany.com:443`

---

## Configuration Methods

### Method 1: Command Line (Inline)

**Windows (CMD):**
```cmd
docker run -d ^
  -p 8080:8080 ^
  -e PORT=8080 ^
  -e REACT_APP_API_PROTOCOL=http ^
  -e REACT_APP_API_HOSTNAME=172.30.38.193 ^
  -e REACT_APP_API_PORT=5005 ^
  -e REACT_APP_REGION_NAME="SAN Region" ^
  --name frontend_momopass ^
  app-insights-dashboard
```

**Linux/Mac:**
```bash
docker run -d \
  -p 8080:8080 \
  -e PORT=8080 \
  -e REACT_APP_API_PROTOCOL=http \
  -e REACT_APP_API_HOSTNAME=172.30.38.193 \
  -e REACT_APP_API_PORT=5005 \
  -e REACT_APP_REGION_NAME="SAN Region" \
  --name frontend_momopass \
  app-insights-dashboard
```

### Method 2: Environment File

**Create .env.production:**
```bash
# Container Port
PORT=8080

# API Configuration
REACT_APP_API_PROTOCOL=http
REACT_APP_API_HOSTNAME=172.30.38.193
REACT_APP_API_PORT=5005

# Application Configuration
REACT_APP_REGION_NAME=SAN Region
REACT_APP_ENV=production
```

**Run with env file:**
```bash
docker run -d \
  -p 8080:8080 \
  --env-file .env.production \
  --name frontend_momopass \
  app-insights-dashboard
```

### Method 3: Docker Compose

**docker-compose.yml:**
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
      - REACT_APP_API_PROTOCOL=http
      - REACT_APP_API_HOSTNAME=172.30.38.193
      - REACT_APP_API_PORT=5005
      - REACT_APP_REGION_NAME=SAN Region
      - REACT_APP_ENV=production
    restart: unless-stopped
```

**Run:**
```bash
docker-compose up -d
```

### Method 4: Docker Compose with External Env File

**docker-compose.yml:**
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

**Run:**
```bash
docker-compose --env-file .env.production up -d
```

---

## Environment-Specific Configurations

### Development Environment

**.env.development:**
```bash
PORT=3000
REACT_APP_API_PROTOCOL=http
REACT_APP_API_HOSTNAME=localhost
REACT_APP_API_PORT=5005
REACT_APP_REGION_NAME=Development
REACT_APP_ENV=development
```

### Staging Environment

**.env.staging:**
```bash
PORT=8080
REACT_APP_API_PROTOCOL=https
REACT_APP_API_HOSTNAME=api-staging.example.com
REACT_APP_API_PORT=443
REACT_APP_REGION_NAME=Staging - SAN
REACT_APP_ENV=staging
```

### Production Environment

**.env.production:**
```bash
PORT=80
REACT_APP_API_PROTOCOL=https
REACT_APP_API_HOSTNAME=api.example.com
REACT_APP_API_PORT=443
REACT_APP_REGION_NAME=Production - SAN
REACT_APP_ENV=production
```

---

## Multi-Region Deployment

### SAN Region

```bash
docker run -d \
  -p 3000:80 \
  -e PORT=80 \
  -e REACT_APP_API_PROTOCOL=http \
  -e REACT_APP_API_HOSTNAME=172.30.38.193 \
  -e REACT_APP_API_PORT=5005 \
  -e REACT_APP_REGION_NAME="SAN Region" \
  --name frontend_momopass_san \
  app-insights-dashboard
```

### US East Region

```bash
docker run -d \
  -p 4000:80 \
  -e PORT=80 \
  -e REACT_APP_API_PROTOCOL=http \
  -e REACT_APP_API_HOSTNAME=172.30.38.194 \
  -e REACT_APP_API_PORT=5005 \
  -e REACT_APP_REGION_NAME="US East Region" \
  --name frontend_momopass_useast \
  app-insights-dashboard
```

### EU West Region

```bash
docker run -d \
  -p 5000:80 \
  -e PORT=80 \
  -e REACT_APP_API_PROTOCOL=http \
  -e REACT_APP_API_HOSTNAME=172.30.38.195 \
  -e REACT_APP_API_PORT=5005 \
  -e REACT_APP_REGION_NAME="EU West Region" \
  --name frontend_momopass_euwest \
  app-insights-dashboard
```

---

## Verification

### Check Environment Variables

```bash
# View all environment variables
docker exec frontend_momopass env

# View specific variables
docker exec frontend_momopass env | grep REACT_APP

# Check API configuration
docker exec frontend_momopass env | grep REACT_APP_API
```

### Test API Connection

```bash
# From inside container
docker exec frontend_momopass sh -c 'echo "API URL: $REACT_APP_API_PROTOCOL://$REACT_APP_API_HOSTNAME:$REACT_APP_API_PORT"'

# Test API endpoint (if accessible)
docker exec frontend_momopass wget -O- http://$REACT_APP_API_HOSTNAME:$REACT_APP_API_PORT/health
```

### Check Browser Console

Open browser console (F12) and check:
```javascript
// The API calls should go to your configured endpoint
// Check Network tab for API requests
```

---

## Common Scenarios

### Scenario 1: Change API Endpoint

**Problem:** Need to point to different API server

**Solution:**
```bash
# Stop and remove old container
docker stop frontend_momopass
docker rm frontend_momopass

# Start with new API endpoint
docker run -d \
  -p 8080:8080 \
  -e PORT=8080 \
  -e REACT_APP_API_PROTOCOL=http \
  -e REACT_APP_API_HOSTNAME=NEW_IP_ADDRESS \
  -e REACT_APP_API_PORT=NEW_PORT \
  -e REACT_APP_REGION_NAME="SAN Region" \
  --name frontend_momopass \
  app-insights-dashboard
```

### Scenario 2: Switch from HTTP to HTTPS

**Problem:** API now uses HTTPS

**Solution:**
```bash
docker stop frontend_momopass
docker rm frontend_momopass

docker run -d \
  -p 8080:8080 \
  -e PORT=8080 \
  -e REACT_APP_API_PROTOCOL=https \
  -e REACT_APP_API_HOSTNAME=172.30.38.193 \
  -e REACT_APP_API_PORT=443 \
  -e REACT_APP_REGION_NAME="SAN Region" \
  --name frontend_momopass \
  app-insights-dashboard
```

### Scenario 3: Different Port for API

**Problem:** API moved to different port

**Solution:**
```bash
docker stop frontend_momopass
docker rm frontend_momopass

docker run -d \
  -p 8080:8080 \
  -e PORT=8080 \
  -e REACT_APP_API_PROTOCOL=http \
  -e REACT_APP_API_HOSTNAME=172.30.38.193 \
  -e REACT_APP_API_PORT=8081 \
  -e REACT_APP_REGION_NAME="SAN Region" \
  --name frontend_momopass \
  app-insights-dashboard
```

---

## Troubleshooting

### Issue: API Calls Failing

**Check 1: Verify environment variables**
```bash
docker exec frontend_momopass env | grep REACT_APP_API
```

**Check 2: Test API connectivity**
```bash
# From host
curl http://172.30.38.193:5005/api/overview?range=24h

# From container
docker exec frontend_momopass wget -O- http://172.30.38.193:5005/api/overview?range=24h
```

**Check 3: Check browser console**
- Open F12 Developer Tools
- Go to Network tab
- Look for failed API requests
- Check the URL being called

### Issue: Wrong API URL

**Symptom:** API calls go to wrong URL

**Solution:**
```bash
# Rebuild with correct build args
docker build \
  --build-arg REACT_APP_API_PROTOCOL=http \
  --build-arg REACT_APP_API_HOSTNAME=172.30.38.193 \
  --build-arg REACT_APP_API_PORT=5005 \
  -t app-insights-dashboard .

# Or recreate container with correct env vars
docker rm -f frontend_momopass
docker run -d \
  -p 8080:8080 \
  -e PORT=8080 \
  -e REACT_APP_API_PROTOCOL=http \
  -e REACT_APP_API_HOSTNAME=172.30.38.193 \
  -e REACT_APP_API_PORT=5005 \
  --name frontend_momopass \
  app-insights-dashboard
```

### Issue: CORS Errors

**Symptom:** Browser shows CORS errors

**Solution:** Configure backend API to allow requests from frontend origin

**Backend needs to set headers:**
```
Access-Control-Allow-Origin: http://localhost:8080
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

---

## Best Practices

### 1. Use Environment Files

```bash
# Create environment-specific files
.env.development
.env.staging
.env.production

# Use appropriate file for deployment
docker run --env-file .env.production ...
```

### 2. Secure Sensitive Data

```bash
# Don't commit .env files with real credentials
echo ".env*" >> .gitignore

# Use secrets management for production
# - Docker Secrets
# - Kubernetes Secrets
# - AWS Secrets Manager
# - Azure Key Vault
```

### 3. Document Your Configuration

```bash
# Create .env.example with placeholders
cat > .env.example << EOF
PORT=8080
REACT_APP_API_PROTOCOL=http
REACT_APP_API_HOSTNAME=YOUR_API_HOST
REACT_APP_API_PORT=YOUR_API_PORT
REACT_APP_REGION_NAME=YOUR_REGION
REACT_APP_ENV=development
EOF
```

### 4. Validate Configuration

```bash
# Create validation script
#!/bin/bash
if [ -z "$REACT_APP_API_HOSTNAME" ]; then
  echo "Error: REACT_APP_API_HOSTNAME not set"
  exit 1
fi

if [ -z "$REACT_APP_API_PORT" ]; then
  echo "Error: REACT_APP_API_PORT not set"
  exit 1
fi

echo "Configuration valid"
```

---

## Quick Reference

### Complete Command Template

```bash
docker run -d \
  -p HOST_PORT:CONTAINER_PORT \
  -e PORT=CONTAINER_PORT \
  -e REACT_APP_API_PROTOCOL=http|https \
  -e REACT_APP_API_HOSTNAME=hostname_or_ip \
  -e REACT_APP_API_PORT=port_number \
  -e REACT_APP_REGION_NAME="Region Name" \
  -e REACT_APP_ENV=development|staging|production \
  --name container_name \
  --restart unless-stopped \
  app-insights-dashboard
```

### Example with Real Values

```bash
docker run -d \
  -p 8080:8080 \
  -e PORT=8080 \
  -e REACT_APP_API_PROTOCOL=http \
  -e REACT_APP_API_HOSTNAME=172.30.38.193 \
  -e REACT_APP_API_PORT=5005 \
  -e REACT_APP_REGION_NAME="SAN Region" \
  -e REACT_APP_ENV=production \
  --name frontend_momopass \
  --restart unless-stopped \
  app-insights-dashboard
```

**Result:** 
- Frontend accessible at: `http://localhost:8080`
- API calls go to: `http://172.30.38.193:5005`
- Dashboard shows: "NexGen APIM Live Dashboard SAN Region"
