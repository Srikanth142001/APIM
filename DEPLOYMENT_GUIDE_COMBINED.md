# NexGen APIM Combined Container - Deployment Guide

## 📦 Image Information
- **Docker Image:** `reddy321678/apim:latest`
- **Architecture:** Combined frontend + backend in single container
- **Exposed Port:** 80 (nginx serves frontend + proxies /api to backend)

---

## 🐳 Docker Compose Deployment

### Step 1: Prepare Environment File
```bash
# Copy the example environment file
cp .env.combined.example .env

# Edit .env with your actual values
nano .env  # or use your preferred editor
```

### Step 2: Deploy with Docker Compose
```bash
# Start the container
docker-compose -f docker-compose.combined.yml up -d

# Check status
docker-compose -f docker-compose.combined.yml ps

# View logs
docker-compose -f docker-compose.combined.yml logs -f

# Stop the container
docker-compose -f docker-compose.combined.yml down
```

### Step 3: Access the Application
```
http://localhost:8082
```

---

## 🚀 Direct Docker Run

### Basic Command:
```bash
docker run -d \
  -p 8082:80 \
  --name apim-combined \
  --restart unless-stopped \
  -e REACT_APP_REGION_NAME="SAN Region" \
  -e APP_INSIGHTS_APP_ID="your-app-id" \
  -e APP_INSIGHTS_API_KEY="your-api-key" \
  -e AZURE_SUBSCRIPTION_ID="your-subscription-id" \
  -e AZURE_RESOURCE_GROUP="your-resource-group" \
  -e AKS_CLUSTER_NAME="your-aks-cluster" \
  -e MYSQL_SERVER_NAME="your-mysql-server" \
  -e LOG_ANALYTICS_WORKSPACE_ID="your-workspace-id" \
  -e LOG_ANALYTICS_AUTH_TOKEN="your-auth-token" \
  -e JWT_SECRET="your-jwt-secret" \
  -e ADMIN_PASSWORD="your-admin-password" \
  reddy321678/apim:latest
```

### With All Optional Features:
```bash
docker run -d \
  -p 8082:80 \
  --name apim-combined \
  --restart unless-stopped \
  -e REACT_APP_REGION_NAME="SAN Region" \
  -e REACT_APP_ENV="production" \
  -e APP_INSIGHTS_APP_ID="your-app-id" \
  -e APP_INSIGHTS_API_KEY="your-api-key" \
  -e AZURE_SUBSCRIPTION_ID="your-subscription-id" \
  -e AZURE_RESOURCE_GROUP="your-resource-group" \
  -e AKS_CLUSTER_NAME="your-aks-cluster" \
  -e MYSQL_SERVER_NAME="your-mysql-server" \
  -e LOG_ANALYTICS_WORKSPACE_ID="your-workspace-id" \
  -e LOG_ANALYTICS_AUTH_TOKEN="your-auth-token" \
  -e JWT_SECRET="your-jwt-secret" \
  -e ADMIN_USERNAME="admin" \
  -e ADMIN_PASSWORD="your-admin-password" \
  -e TELEGRAM_BOT_TOKEN="your-telegram-token" \
  -e TELEGRAM_CHAT_ID="your-chat-id" \
  -e ENABLE_ML_ALERTS="true" \
  -e ML_ALERT_THRESHOLD="0.8" \
  -v apim-data:/app/shared \
  -v apim-logs:/var/log \
  reddy321678/apim:latest
```

---

## ☸️ Kubernetes Deployment

### Step 1: Update Secrets
Edit `kubernetes-deployment.yml` and replace all placeholder values in the `Secret` section:
```yaml
stringData:
  APP_INSIGHTS_APP_ID: "your-actual-app-id"
  APP_INSIGHTS_API_KEY: "your-actual-api-key"
  # ... etc
```

### Step 2: Deploy to Kubernetes
```bash
# Apply the deployment
kubectl apply -f kubernetes-deployment.yml

# Check deployment status
kubectl get all -n apim

# Check pods
kubectl get pods -n apim

# View logs
kubectl logs -f deployment/apim-combined -n apim

# Check service
kubectl get svc -n apim
```

### Step 3: Access the Application

#### Option A: LoadBalancer (if available)
```bash
# Get external IP
kubectl get svc apim-service -n apim

# Access via: http://<EXTERNAL-IP>
```

#### Option B: NodePort
```bash
# Access via: http://<NODE-IP>:30082
```

#### Option C: Port Forward (for testing)
```bash
kubectl port-forward -n apim svc/apim-service 8082:80

# Access via: http://localhost:8082
```

### Step 4: Configure Ingress (Optional)
Update the Ingress section in `kubernetes-deployment.yml`:
```yaml
spec:
  tls:
  - hosts:
    - apim.yourdomain.com  # Change to your domain
    secretName: apim-tls-secret
  rules:
  - host: apim.yourdomain.com  # Change to your domain
```

Then apply:
```bash
kubectl apply -f kubernetes-deployment.yml
```

---

## 🔧 Configuration

### Required Environment Variables:
| Variable | Description | Example |
|----------|-------------|---------|
| `APP_INSIGHTS_APP_ID` | Azure App Insights Application ID | `12345678-1234-1234-1234-123456789abc` |
| `APP_INSIGHTS_API_KEY` | Azure App Insights API Key | `abcdef123456...` |
| `AZURE_SUBSCRIPTION_ID` | Azure Subscription ID | `12345678-1234-1234-1234-123456789abc` |
| `AZURE_RESOURCE_GROUP` | Azure Resource Group Name | `my-resource-group` |
| `AKS_CLUSTER_NAME` | AKS Cluster Name | `my-aks-cluster` |
| `MYSQL_SERVER_NAME` | MySQL Server Name | `my-mysql-server` |
| `LOG_ANALYTICS_WORKSPACE_ID` | Log Analytics Workspace ID | `12345678-1234-1234-1234-123456789abc` |
| `LOG_ANALYTICS_AUTH_TOKEN` | Log Analytics Bearer Token | `Bearer eyJ0eXAi...` |
| `JWT_SECRET` | JWT Secret (min 32 chars) | `your-strong-random-secret` |
| `ADMIN_PASSWORD` | Admin User Password | `SecurePassword123!` |

### Optional Environment Variables:
| Variable | Description | Default |
|----------|-------------|---------|
| `REACT_APP_REGION_NAME` | Region display name | `SAN Region` |
| `REACT_APP_ENV` | Environment name | `production` |
| `ADMIN_USERNAME` | Admin username | `admin` |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token | _(empty)_ |
| `TELEGRAM_CHAT_ID` | Telegram chat ID | _(empty)_ |
| `ENABLE_ML_ALERTS` | Enable ML alerts | `true` |
| `ML_ALERT_THRESHOLD` | ML alert threshold | `0.8` |

---

## 🔍 Verification & Testing

### Health Check:
```bash
curl http://localhost:8082/health
# Expected: "healthy"
```

### API Test:
```bash
curl http://localhost:8082/api/features
# Expected: JSON response with feature flags
```

### Container Logs:
```bash
# Docker
docker logs -f apim-combined

# Docker Compose
docker-compose -f docker-compose.combined.yml logs -f

# Kubernetes
kubectl logs -f deployment/apim-combined -n apim
```

### Container Shell Access:
```bash
# Docker
docker exec -it apim-combined sh

# Kubernetes
kubectl exec -it deployment/apim-combined -n apim -- sh
```

---

## 📊 Monitoring

### Docker Stats:
```bash
docker stats apim-combined
```

### Kubernetes Metrics:
```bash
# Pod metrics
kubectl top pods -n apim

# Node metrics
kubectl top nodes

# HPA status
kubectl get hpa -n apim
```

---

## 🔄 Updates & Rollbacks

### Docker Update:
```bash
# Pull latest image
docker pull reddy321678/apim:latest

# Restart with new image
docker-compose -f docker-compose.combined.yml up -d --force-recreate
```

### Kubernetes Update:
```bash
# Update image
kubectl set image deployment/apim-combined apim=reddy321678/apim:latest -n apim

# Check rollout status
kubectl rollout status deployment/apim-combined -n apim

# Rollback if needed
kubectl rollout undo deployment/apim-combined -n apim
```

---

## 🛠️ Troubleshooting

### Container Won't Start:
```bash
# Check logs
docker logs apim-combined

# Check environment variables
docker exec apim-combined env | grep -E "APP_INSIGHTS|AZURE"
```

### Backend Not Responding:
```bash
# Check if backend is running
docker exec apim-combined ps aux | grep node

# Check backend logs
docker exec apim-combined cat /var/log/supervisord.log
```

### Frontend Not Loading:
```bash
# Check nginx status
docker exec apim-combined ps aux | grep nginx

# Check nginx config
docker exec apim-combined cat /etc/nginx/http.d/default.conf
```

### API Calls Failing:
```bash
# Test backend directly
docker exec apim-combined wget -qO- http://localhost:5000/api/features

# Check nginx proxy
docker exec apim-combined cat /etc/nginx/http.d/default.conf | grep proxy_pass
```

---

## 🔐 Security Best Practices

1. **Never commit `.env` files** - Use `.env.example` as template
2. **Use strong JWT secrets** - Minimum 32 characters, random
3. **Rotate API keys regularly** - Update App Insights and Log Analytics tokens
4. **Use HTTPS in production** - Configure TLS/SSL certificates
5. **Limit container resources** - Set memory and CPU limits
6. **Use secrets management** - Kubernetes Secrets or Azure Key Vault
7. **Enable network policies** - Restrict pod-to-pod communication
8. **Regular updates** - Keep base images and dependencies updated

---

## 📚 Additional Resources

- **Docker Hub:** https://hub.docker.com/r/reddy321678/apim
- **GitHub Repository:** https://github.com/Srikanth142001/APIM
- **Azure App Insights:** https://docs.microsoft.com/azure/azure-monitor/app/app-insights-overview
- **Kubernetes Documentation:** https://kubernetes.io/docs/

---

## 🆘 Support

For issues or questions:
1. Check the logs first
2. Review environment variables
3. Verify Azure credentials
4. Check network connectivity
5. Review this deployment guide

---

**Last Updated:** 2026-05-12
**Version:** 1.0.0
