# PowerShell script to run Docker container with environment variables

# Build the Docker image
Write-Host "Building Docker image..." -ForegroundColor Green
docker build -t app-insights-backend .

# Run the container with environment variables
Write-Host "Starting container..." -ForegroundColor Green
docker run -d `
  -p 5000:5000 `
  -e PORT=5000 `
  -e APP_INSIGHTS_APP_ID=bb398d1e-b326-4a43-b403-fb8b2fe9c641 `
  -e APP_INSIGHTS_API_KEY=1q6x11cg5hmf5rjh8ekyr4s74qnjaoz8yfkuajt0 `
  -e LOG_ANALYTICS_URL=https://api.loganalytics.io/v1/subscriptions/cb7b373e-321b-4fe7-a7d1-d0cf4708e887/resourcegroups/rg-dch-mma-prd-san-2/providers/Microsoft.ContainerService/managedClusters/aks-dch-mma-prd-san-1/query `
  -e LOG_ANALYTICS_AUTH_TOKEN=b51c6b635fbd427d82832c416d409304 `
  --name app-insights-backend `
  app-insights-backend

Write-Host "Container started successfully!" -ForegroundColor Green
Write-Host "Access the application at http://localhost:5000" -ForegroundColor Cyan
