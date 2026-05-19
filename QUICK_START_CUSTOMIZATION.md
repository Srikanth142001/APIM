# 🚀 Quick Start - Runtime Customization

## What's New?

You can now customize your APIM dashboard **without rebuilding the Docker image**:

- ✅ **Custom Project Name** - Replace "MoMo Insights" with your company name
- ✅ **Custom Logo** - Use your own branding
- ✅ **Configurable Top APIs** - Show 10, 20, 50, or any number of top APIs

---

## How to Use

### 1. Build the Image (One Time)

```bash
docker build -f Dockerfile.combined.ci -t reddy321678/apim:latest .
```

### 2. Run with Your Custom Settings

```bash
docker run -d -p 8082:80 \
  -e PROJECT_NAME="Acme Corp API Monitor" \
  -e PROJECT_LOGO="/acme-logo.png" \
  -e TOP_APIS_LIMIT="25" \
  -e REACT_APP_REGION_NAME="US East Production" \
  -e APP_INSIGHTS_APP_ID=your-app-id \
  -e APP_INSIGHTS_API_KEY=your-api-key \
  -e AZURE_SUBSCRIPTION_ID=your-subscription-id \
  -e AZURE_RESOURCE_GROUP=your-resource-group \
  -e JWT_SECRET=your-jwt-secret-min-32-chars \
  -e ADMIN_PASSWORD=your-secure-password \
  reddy321678/apim:latest
```

### 3. Access Your Dashboard

Open browser: `http://localhost:8082`

You'll see:
- Your custom project name in the UI
- Your custom logo (if provided)
- Top 25 APIs instead of top 10

---

## Change Settings Anytime

Want to change the project name? Just restart the container with new values:

```bash
# Stop old container
docker stop <container-id>
docker rm <container-id>

# Start with new settings
docker run -d -p 8082:80 \
  -e PROJECT_NAME="New Company Name" \
  -e TOP_APIS_LIMIT="50" \
  ...
  reddy321678/apim:latest
```

**No rebuild needed!** 🎉

---

## Using Custom Logo

### Option 1: Add to Docker Image (Recommended)

Edit `Dockerfile.combined.ci` and add after line with `COPY --from=frontend-builder`:

```dockerfile
# Add custom logo
COPY your-company-logo.png /usr/share/nginx/html/company-logo.png
```

Then rebuild and run:
```bash
docker build -f Dockerfile.combined.ci -t reddy321678/apim:latest .
docker run -d -p 8082:80 -e PROJECT_LOGO="/company-logo.png" ...
```

### Option 2: Mount as Volume (Quick Test)

```bash
docker run -d -p 8082:80 \
  -v /path/to/your/logo.png:/usr/share/nginx/html/custom-logo.png \
  -e PROJECT_LOGO="/custom-logo.png" \
  ...
  reddy321678/apim:latest
```

---

## Default Values

If you don't set these variables, defaults are used:

| Variable | Default Value |
|----------|---------------|
| `PROJECT_NAME` | "MoMo Insights" |
| `PROJECT_LOGO` | "/momo.png" |
| `TOP_APIS_LIMIT` | "10" |
| `REACT_APP_REGION_NAME` | "SAN Region" |

---

## Jenkins Pipeline

Your Jenkins pipeline doesn't need changes! Just build as usual:

```groovy
stage('Build Combined Docker Image') {
    steps {
        sh '''
        docker build \
          -f Dockerfile.combined.ci \
          --build-arg http_proxy=$HTTP_PROXY \
          --build-arg https_proxy=$HTTPS_PROXY \
          -t $IMAGE_NAME:$TAG .
        '''
    }
}
```

The customization happens when you **deploy** the container, not during build.

---

## Docker Compose Example

Create `docker-compose.custom.yml`:

```yaml
version: '3.8'

services:
  apim-dashboard:
    image: reddy321678/apim:latest
    container_name: apim-custom
    ports:
      - "8082:80"
    environment:
      # Custom Branding
      PROJECT_NAME: "Acme Corp API Monitor"
      PROJECT_LOGO: "/acme-logo.png"
      TOP_APIS_LIMIT: "25"
      
      # Region
      REACT_APP_REGION_NAME: "US East Production"
      
      # Azure App Insights (Required)
      APP_INSIGHTS_APP_ID: ${APP_INSIGHTS_APP_ID}
      APP_INSIGHTS_API_KEY: ${APP_INSIGHTS_API_KEY}
      
      # Azure Infrastructure (Required)
      AZURE_SUBSCRIPTION_ID: ${AZURE_SUBSCRIPTION_ID}
      AZURE_RESOURCE_GROUP: ${AZURE_RESOURCE_GROUP}
      AKS_CLUSTER_NAME: ${AKS_CLUSTER_NAME}
      MYSQL_SERVER_NAME: ${MYSQL_SERVER_NAME}
      
      # Authentication (Required)
      JWT_SECRET: ${JWT_SECRET}
      ADMIN_USERNAME: admin
      ADMIN_PASSWORD: ${ADMIN_PASSWORD}
      
      # Optional Features
      ENABLE_ML_ALERTS: "true"
      ENABLE_OUTAGE_DETECTION: "true"
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

Run with:
```bash
docker-compose -f docker-compose.custom.yml up -d
```

---

## Multiple Deployments

Run the **same image** for different environments with different branding:

### Development
```bash
docker run -d -p 8082:80 \
  -e PROJECT_NAME="APIM Dev" \
  -e REACT_APP_REGION_NAME="Development" \
  ...
  reddy321678/apim:latest
```

### Staging
```bash
docker run -d -p 8083:80 \
  -e PROJECT_NAME="APIM Staging" \
  -e REACT_APP_REGION_NAME="Staging" \
  ...
  reddy321678/apim:latest
```

### Production
```bash
docker run -d -p 8084:80 \
  -e PROJECT_NAME="APIM Production" \
  -e REACT_APP_REGION_NAME="Production" \
  ...
  reddy321678/apim:latest
```

---

## Verify Configuration

Check what settings are active:

```bash
# View container logs
docker logs <container-id>

# Look for:
# ✅ Frontend config.js written
#    Region: Your Region
#    Project: Your Project Name
#    Logo: /your-logo.png
#    Top APIs Limit: 25

# Or check config.js directly
docker exec <container-id> cat /usr/share/nginx/html/config.js
```

---

## Troubleshooting

### Logo Not Showing?

1. Check the logo file exists:
   ```bash
   docker exec <container-id> ls -la /usr/share/nginx/html/
   ```

2. Check the path in config.js:
   ```bash
   docker exec <container-id> cat /usr/share/nginx/html/config.js
   ```

3. Make sure PROJECT_LOGO starts with `/`:
   ```bash
   -e PROJECT_LOGO="/logo.png"  # ✅ Correct
   -e PROJECT_LOGO="logo.png"   # ❌ Wrong
   ```

### Project Name Not Changing?

1. Check container logs:
   ```bash
   docker logs <container-id> | grep "Project:"
   ```

2. Clear browser cache (Ctrl+Shift+R or Cmd+Shift+R)

3. Check config.js:
   ```bash
   docker exec <container-id> cat /usr/share/nginx/html/config.js
   ```

### Top APIs Limit Not Working?

This requires backend code changes (not yet implemented). The environment variable is ready, but the backend routes need to be updated to use it.

---

## What's Ready vs What's Pending

### ✅ Ready Now (Docker Configuration)
- Runtime environment variables
- Config.js generation at startup
- Default values
- Documentation

### ⏳ Pending (Code Implementation)
- Frontend components using PROJECT_NAME and PROJECT_LOGO
- Backend routes using TOP_APIS_LIMIT
- TPS (Transactions Per Second) calculation
- Dynamic browser title

The infrastructure is ready. The UI/backend code changes can be implemented later.

---

## Summary

**Before:** Had to rebuild Docker image to change project name or settings  
**Now:** Just change environment variables and restart container  

**One image, infinite configurations!** 🚀

