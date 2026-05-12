# App Insights Backend

## Running with Docker

### Quick Start - Using Scripts

**Windows (CMD):**
```cmd
run-docker.cmd
```

**Windows (PowerShell):**
```powershell
.\run-docker.ps1
```

**Linux/Mac:**
```bash
chmod +x run-docker.sh
./run-docker.sh
```

### Manual Docker Commands

**Build the image:**
```bash
docker build -t app-insights-backend .
```

**Run with environment variables:**
```bash
docker run -d \
  -p 5000:5000 \
  -e PORT=5000 \
  -e APP_INSIGHTS_APP_ID=bb398d1e-b326-4a43-b403-fb8b2fe9c641 \
  -e APP_INSIGHTS_API_KEY=1q6x11cg5hmf5rjh8ekyr4s74qnjaoz8yfkuajt0 \
  -e LOG_ANALYTICS_URL=https://api.loganalytics.io/v1/subscriptions/cb7b373e-321b-4fe7-a7d1-d0cf4708e887/resourcegroups/rg-dch-mma-prd-san-2/providers/Microsoft.ContainerService/managedClusters/aks-dch-mma-prd-san-1/query \
  -e LOG_ANALYTICS_AUTH_TOKEN=b51c6b635fbd427d82832c416d409304 \
  --name app-insights-backend \
  app-insights-backend
```

**To change the port (e.g., 8080):**
```bash
docker run -d \
  -p 8080:8080 \
  -e PORT=8080 \
  -e APP_INSIGHTS_APP_ID=bb398d1e-b326-4a43-b403-fb8b2fe9c641 \
  -e APP_INSIGHTS_API_KEY=1q6x11cg5hmf5rjh8ekyr4s74qnjaoz8yfkuajt0 \
  -e LOG_ANALYTICS_URL=https://api.loganalytics.io/v1/subscriptions/cb7b373e-321b-4fe7-a7d1-d0cf4708e887/resourcegroups/rg-dch-mma-prd-san-2/providers/Microsoft.ContainerService/managedClusters/aks-dch-mma-prd-san-1/query \
  -e LOG_ANALYTICS_AUTH_TOKEN=b51c6b635fbd427d82832c416d409304 \
  --name app-insights-backend \
  app-insights-backend
```

### Docker Management Commands

**View logs:**
```bash
docker logs app-insights-backend
```

**Stop container:**
```bash
docker stop app-insights-backend
```

**Remove container:**
```bash
docker rm app-insights-backend
```

**Restart container:**
```bash
docker restart app-insights-backend
```

## Environment Variables

Required environment variables:
- `PORT` - Server port (default: 5000)
- `APP_INSIGHTS_APP_ID` - Azure Application Insights App ID
- `APP_INSIGHTS_API_KEY` - Azure Application Insights API Key
- `LOG_ANALYTICS_URL` - Azure Log Analytics URL
- `LOG_ANALYTICS_AUTH_TOKEN` - Azure Log Analytics Auth Token

## Running Locally (without Docker)

```bash
npm install
node index.js
```

Make sure to set environment variables or have a .env file in the app-insights-backend directory.
