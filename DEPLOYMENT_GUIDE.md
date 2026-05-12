# 🚀 NexGen APIM - Complete Deployment Guide

## 📦 Docker Image: `reddy321678/apim:latest`

This guide covers deploying the combined APIM container with all configuration options.

---

## 🎯 Quick Start

### 1. Create Environment File

```bash
# Copy the example file
cp .env.combined.example .env.combined

# Edit with your values
nano .env.combined
```

### 2. Deploy with Docker Compose

```bash
docker-compose -f docker-compose.combined.yml up -d
```

### 3. Access the Dashboard

```
http://localhost:8082
```

**Default Credentials:**
- Username: `admin`
- Password: (set in `.env.combined`)

---

## 🔧 Configuration Options

### Required Environment Variables

```bash
# Azure App Insights (REQUIRED)
APP_INSIGHTS_APP_ID=your-app-id
APP_INSIGHTS_API_KEY=your-api-key

# Azure Infrastructure (REQUIRED)
AZURE_SUBSCRIPTION_ID=your-subscription-id
AZURE_RESOURCE_GROUP=your-resource-group

# Authentication (REQUIRED)
JWT_SECRET=your-strong-secret-min-32-chars
ADMIN_PASSWORD=your-secure-password
```

### Optional Environment Variables

```bash
# AKS Cluster (for Infrastructure tab)
AKS_CLUSTER_NAME=your-aks-cluster

# MySQL Monitoring (for MySQL tab)
MYSQL_SERVER_NAME=your-mysql-server

# Log Analytics (for advanced queries)
LOG_ANALYTICS_WORKSPACE_ID=your-workspace-id
LOG_ANALYTICS_AUTH_TOKEN=your-bearer-token

# Telegram Notifications
TELEGRAM_BOT_TOKEN=your-bot-token
TELEGRAM_CHAT_ID=your-chat-id

# WhatsApp Notifications
WHATSAPP_API_URL=your-whatsapp-api
WHATSAPP_API_KEY=your-api-key
```

---

## 🎛️ Feature Flags - Hide/Show Panels

The dashboard **automatically hides panels** based on which environment variables are configured:

### Panel Visibility Rules

| Panel/Feature | Required Env Var | Auto-Hidden If Missing |
|---------------|------------------|------------------------|
| **MySQL Tab** | `MYSQL_SERVER_NAME` | ✅ Yes |
| **MySQL Active Connections Card** | `MYSQL_SERVER_NAME` | ✅ Yes |
| **Infrastructure Tab** | `AKS_CLUSTER_NAME` | ✅ Yes |
| **Node CPU/Health** | `AKS_CLUSTER_NAME` | ✅ Yes |
| **Log Analytics Queries** | `LOG_ANALYTICS_AUTH_TOKEN` | ✅ Yes |
| **Telegram Alerts** | `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` | ✅ Yes |
| **ML Alerts Tab** | Always visible | ❌ No |
| **API Analytics** | Always visible | ❌ No |

### How It Works

The backend exposes `/api/features` endpoint that returns:

```json
{
  "mysql": true,          // MYSQL_SERVER_NAME is set
  "infrastructure": true, // AKS_CLUSTER_NAME is set
  "logAnalytics": true,   // LOG_ANALYTICS_AUTH_TOKEN is set
  "telegram": false       // TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID are set
}
```

The frontend automatically:
- **Hides tabs** that aren't available
- **Removes metric cards** for disabled features
- **Skips API calls** for disabled features
- **Shows "N/A"** status for unavailable metrics

### Example Configurations

#### Minimal Setup (App Insights Only)
```bash
# Only show API monitoring, no infrastructure/MySQL
APP_INSIGHTS_APP_ID=xxx
APP_INSIGHTS_API_KEY=xxx
AZURE_SUBSCRIPTION_ID=xxx
AZURE_RESOURCE_GROUP=xxx
JWT_SECRET=xxx
ADMIN_PASSWORD=xxx

# Result: Only Overview, API Analytics, and ML Alerts tabs visible
```

#### Full Setup (All Features)
```bash
# Show everything
APP_INSIGHTS_APP_ID=xxx
APP_INSIGHTS_API_KEY=xxx
AZURE_SUBSCRIPTION_ID=xxx
AZURE_RESOURCE_GROUP=xxx
AKS_CLUSTER_NAME=xxx              # ← Enables Infrastructure tab
MYSQL_SERVER_NAME=xxx             # ← Enables MySQL tab
LOG_ANALYTICS_WORKSPACE_ID=xxx    # ← Enables advanced queries
LOG_ANALYTICS_AUTH_TOKEN=xxx
TELEGRAM_BOT_TOKEN=xxx            # ← Enables Telegram alerts
TELEGRAM_CHAT_ID=xxx
JWT_SECRET=xxx
ADMIN_PASSWORD=xxx

# Result: All tabs and features visible
```

---

## 🐳 Deployment Methods

### Method 1: Docker Compose (Recommended)

```bash
docker-compose -f docker-compose.combined.yml up -d
```

**Advantages:**
- Easy configuration via `.env.combined`
- Automatic restarts
- Volume management
- Health checks

### Method 2: Docker Run

```bash
docker run -d \
  -p 8082:80 \
  -e REACT_APP_REGION_NAME="SAN Region" \
  -e APP_INSIGHTS_APP_ID=xxx \
  -e APP_INSIGHTS_API_KEY=xxx \
  -e AZURE_SUBSCRIPTION_ID=xxx \
  -e AZURE_RESOURCE_GROUP=xxx \
  -e AKS_CLUSTER_NAME=xxx \
  -e MYSQL_SERVER_NAME=xxx \
  -e LOG_ANALYTICS_WORKSPACE_ID=xxx \
  -e LOG_ANALYTICS_AUTH_TOKEN=xxx \
  -e JWT_SECRET=xxx \
  -e ADMIN_PASSWORD=xxx \
  --name nexgen-apim \
  --restart unless-stopped \
  reddy321678/apim:latest
```

### Method 3: Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nexgen-apim
spec:
  replicas: 2
  selector:
    matchLabels:
      app: nexgen-apim
  template:
    metadata:
      labels:
        app: nexgen-apim
    spec:
      containers:
      - name: apim
        image: reddy321678/apim:latest
        ports:
        - containerPort: 80
        env:
        - name: REACT_APP_REGION_NAME
          value: "SAN Region"
        - name: APP_INSIGHTS_APP_ID
          valueFrom:
            secretKeyRef:
              name: apim-secrets
              key: app-insights-app-id
        - name: APP_INSIGHTS_API_KEY
          valueFrom:
            secretKeyRef:
              name: apim-secrets
              key: app-insights-api-key
        # ... add other env vars
        livenessProbe:
          httpGet:
            path: /health
            port: 80
          initialDelaySeconds: 20
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /health
            port: 80
          initialDelaySeconds: 10
          periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: nexgen-apim
spec:
  type: LoadBalancer
  ports:
  - port: 80
    targetPort: 80
  selector:
    app: nexgen-apim
```

---

## 🔐 Security Best Practices

### 1. Generate Strong JWT Secret
```bash
openssl rand -base64 32
```

### 2. Use Docker Secrets (Production)
```yaml
services:
  apim-combined:
    image: reddy321678/apim:latest
    secrets:
      - app_insights_key
      - jwt_secret
      - admin_password
    environment:
      APP_INSIGHTS_API_KEY_FILE: /run/secrets/app_insights_key
      JWT_SECRET_FILE: /run/secrets/jwt_secret
      ADMIN_PASSWORD_FILE: /run/secrets/admin_password

secrets:
  app_insights_key:
    external: true
  jwt_secret:
    external: true
  admin_password:
    external: true
```

### 3. Network Isolation
```yaml
networks:
  apim-network:
    driver: bridge
    internal: false
    ipam:
      config:
        - subnet: 172.28.0.0/16
```

---

## 📊 Monitoring & Health Checks

### Health Endpoint
```bash
curl http://localhost:8082/health
# Response: healthy
```

### Container Logs
```bash
# View all logs
docker logs nexgen-apim-combined

# Follow logs
docker logs -f nexgen-apim-combined

# Last 100 lines
docker logs --tail 100 nexgen-apim-combined
```

### Check Running Services
```bash
# Inside container
docker exec nexgen-apim-combined supervisorctl status

# Expected output:
# backend    RUNNING   pid 12, uptime 0:05:23
# nginx      RUNNING   pid 13, uptime 0:05:23
```

---

## 🔄 Updates & Maintenance

### Update to Latest Version
```bash
# Pull latest image
docker pull reddy321678/apim:latest

# Restart with new image
docker-compose -f docker-compose.combined.yml down
docker-compose -f docker-compose.combined.yml up -d
```

### Backup Configuration
```bash
# Backup environment file
cp .env.combined .env.combined.backup.$(date +%Y%m%d)

# Backup volumes
docker run --rm -v apim-data:/data -v $(pwd):/backup \
  alpine tar czf /backup/apim-data-backup.tar.gz /data
```

---

## 🐛 Troubleshooting

### Container Won't Start
```bash
# Check logs
docker logs nexgen-apim-combined

# Check environment variables
docker exec nexgen-apim-combined env | grep -E "APP_INSIGHTS|AZURE"

# Verify image
docker inspect reddy321678/apim:latest
```

### Backend Not Responding
```bash
# Check backend process
docker exec nexgen-apim-combined supervisorctl status backend

# Check backend logs
docker exec nexgen-apim-combined tail -f /var/log/supervisord.log

# Restart backend only
docker exec nexgen-apim-combined supervisorctl restart backend
```

### Frontend Not Loading
```bash
# Check nginx process
docker exec nexgen-apim-combined supervisorctl status nginx

# Test nginx config
docker exec nexgen-apim-combined nginx -t

# Restart nginx only
docker exec nexgen-apim-combined supervisorctl restart nginx
```

### Missing Panels/Features
```bash
# Check feature flags
curl http://localhost:8082/api/features

# Verify environment variables are set
docker exec nexgen-apim-combined env | grep -E "MYSQL|AKS|TELEGRAM"
```

---

## 📝 Example Deployment Scenarios

### Scenario 1: Development Environment
```bash
APIM_PORT=8082
REGION_NAME=Dev Environment
APP_INSIGHTS_APP_ID=dev-app-id
APP_INSIGHTS_API_KEY=dev-api-key
AZURE_SUBSCRIPTION_ID=dev-sub-id
AZURE_RESOURCE_GROUP=dev-rg
JWT_SECRET=dev-secret-change-in-production
ADMIN_PASSWORD=DevPassword123!
```

### Scenario 2: Production with All Features
```bash
APIM_PORT=80
REGION_NAME=Production - SAN Region
APP_INSIGHTS_APP_ID=prod-app-id
APP_INSIGHTS_API_KEY=prod-api-key
AZURE_SUBSCRIPTION_ID=prod-sub-id
AZURE_RESOURCE_GROUP=prod-rg
AKS_CLUSTER_NAME=prod-aks-cluster
MYSQL_SERVER_NAME=prod-mysql-server
LOG_ANALYTICS_WORKSPACE_ID=prod-workspace-id
LOG_ANALYTICS_AUTH_TOKEN=prod-bearer-token
TELEGRAM_BOT_TOKEN=prod-bot-token
TELEGRAM_CHAT_ID=prod-chat-id
JWT_SECRET=$(openssl rand -base64 32)
ADMIN_PASSWORD=StrongProductionPassword123!
ENABLE_ML_ALERTS=true
ENABLE_TELEGRAM=true
```

### Scenario 3: Multi-Region Deployment
```bash
# Region 1 - SAN
docker run -d -p 8081:80 \
  -e REACT_APP_REGION_NAME="SAN Region" \
  -e APIM_PORT=8081 \
  ... \
  --name apim-san \
  reddy321678/apim:latest

# Region 2 - EUR
docker run -d -p 8082:80 \
  -e REACT_APP_REGION_NAME="EUR Region" \
  -e APIM_PORT=8082 \
  ... \
  --name apim-eur \
  reddy321678/apim:latest
```

---

## 📚 Additional Resources

- **Docker Hub**: https://hub.docker.com/r/reddy321678/apim
- **GitHub Repository**: https://github.com/Srikanth142001/APIM
- **API Documentation**: http://localhost:8082/api/docs (if enabled)

---

## ✅ Post-Deployment Checklist

- [ ] Container is running: `docker ps | grep apim`
- [ ] Health check passes: `curl http://localhost:8082/health`
- [ ] Can login with admin credentials
- [ ] Dashboard loads and shows data
- [ ] Expected tabs are visible (based on env vars)
- [ ] API calls are successful (check browser console)
- [ ] Alerts are working (if enabled)
- [ ] Logs are clean (no errors)

---

**Need Help?** Check the logs first:
```bash
docker logs -f nexgen-apim-combined
```
