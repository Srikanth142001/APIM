#!/bin/bash

# Build the Docker image
docker build -t app-insights-backend .

# Run the container with environment variables
docker run -d \
  -p 5000:5000 \
  -e PORT=5000 \
  -e APP_INSIGHTS_APP_ID=bb398d1e-b326-4a43-b403-fb8b2fe9c641 \
  -e APP_INSIGHTS_API_KEY=1q6x11cg5hmf5rjh8ekyr4s74qnjaoz8yfkuajt0 \
  -e AZURE_SUBSCRIPTION_ID=cb7b373e-321b-4fe7-a7d1-d0cf4708e887 \
  -e AZURE_RESOURCE_GROUP=rg-dch-mma-prd-san-2 \
  -e AKS_CLUSTER_NAME=aks-dch-mma-prd-san-1 \
  -e MYSQL_SERVER_NAME=mysql-dch-mma-prd-san-1 \
  -e LOG_ANALYTICS_AUTH_TOKEN=b51c6b635fbd427d82832c416d409304 \
  --name app-insights-backend \
  app-insights-backend

echo "Container started successfully!"
echo "Access the application at http://localhost:5000"
