#!/bin/bash
# Docker Run Commands with All Environment Variables

# =============================================================================
# Configuration 1: Development Environment (Port 8080)
# =============================================================================
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

# =============================================================================
# Configuration 2: Production Environment (Port 80)
# =============================================================================
# docker run -d \
#   -p 80:80 \
#   -e PORT=80 \
#   -e REACT_APP_API_PROTOCOL=http \
#   -e REACT_APP_API_HOSTNAME=172.30.38.193 \
#   -e REACT_APP_API_PORT=5005 \
#   -e REACT_APP_REGION_NAME="SAN Region" \
#   -e REACT_APP_ENV=production \
#   --name frontend_momopass \
#   --restart unless-stopped \
#   app-insights-dashboard

# =============================================================================
# Configuration 3: Custom Port 3000
# =============================================================================
# docker run -d \
#   -p 3000:3000 \
#   -e PORT=3000 \
#   -e REACT_APP_API_PROTOCOL=http \
#   -e REACT_APP_API_HOSTNAME=172.30.38.193 \
#   -e REACT_APP_API_PORT=5005 \
#   -e REACT_APP_REGION_NAME="SAN Region" \
#   -e REACT_APP_ENV=development \
#   --name frontend_momopass \
#   --restart unless-stopped \
#   app-insights-dashboard

# =============================================================================
# Configuration 4: HTTPS Backend
# =============================================================================
# docker run -d \
#   -p 8080:8080 \
#   -e PORT=8080 \
#   -e REACT_APP_API_PROTOCOL=https \
#   -e REACT_APP_API_HOSTNAME=api.example.com \
#   -e REACT_APP_API_PORT=443 \
#   -e REACT_APP_REGION_NAME="SAN Region" \
#   -e REACT_APP_ENV=production \
#   --name frontend_momopass \
#   --restart unless-stopped \
#   app-insights-dashboard

# =============================================================================
# Useful Commands
# =============================================================================

# View logs
# docker logs -f frontend_momopass

# Stop container
# docker stop frontend_momopass

# Start container
# docker start frontend_momopass

# Restart container
# docker restart frontend_momopass

# Remove container
# docker rm -f frontend_momopass

# Check container status
# docker ps | grep frontend_momopass

# Check environment variables
# docker exec frontend_momopass env | grep REACT_APP

# Access container shell
# docker exec -it frontend_momopass sh

# Check nginx config
# docker exec frontend_momopass cat /etc/nginx/conf.d/default.conf
