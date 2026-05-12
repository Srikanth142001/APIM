@echo off
REM Docker Run Commands with All Environment Variables (Windows)

REM =============================================================================
REM Configuration 1: Development Environment (Port 8080)
REM =============================================================================
docker run -d ^
  -p 8080:8080 ^
  -e PORT=8080 ^
  -e REACT_APP_API_PROTOCOL=http ^
  -e REACT_APP_API_HOSTNAME=172.30.38.193 ^
  -e REACT_APP_API_PORT=5005 ^
  -e REACT_APP_REGION_NAME="SAN Region" ^
  -e REACT_APP_ENV=development ^
  --name frontend_momopass ^
  --restart unless-stopped ^
  app-insights-dashboard

REM =============================================================================
REM Configuration 2: Production Environment (Port 80)
REM =============================================================================
REM docker run -d ^
REM   -p 80:80 ^
REM   -e PORT=80 ^
REM   -e REACT_APP_API_PROTOCOL=http ^
REM   -e REACT_APP_API_HOSTNAME=172.30.38.193 ^
REM   -e REACT_APP_API_PORT=5005 ^
REM   -e REACT_APP_REGION_NAME="SAN Region" ^
REM   -e REACT_APP_ENV=production ^
REM   --name frontend_momopass ^
REM   --restart unless-stopped ^
REM   app-insights-dashboard

REM =============================================================================
REM Configuration 3: Custom Port 3000
REM =============================================================================
REM docker run -d ^
REM   -p 3000:3000 ^
REM   -e PORT=3000 ^
REM   -e REACT_APP_API_PROTOCOL=http ^
REM   -e REACT_APP_API_HOSTNAME=172.30.38.193 ^
REM   -e REACT_APP_API_PORT=5005 ^
REM   -e REACT_APP_REGION_NAME="SAN Region" ^
REM   -e REACT_APP_ENV=development ^
REM   --name frontend_momopass ^
REM   --restart unless-stopped ^
REM   app-insights-dashboard

REM =============================================================================
REM Configuration 4: HTTPS Backend
REM =============================================================================
REM docker run -d ^
REM   -p 8080:8080 ^
REM   -e PORT=8080 ^
REM   -e REACT_APP_API_PROTOCOL=https ^
REM   -e REACT_APP_API_HOSTNAME=api.example.com ^
REM   -e REACT_APP_API_PORT=443 ^
REM   -e REACT_APP_REGION_NAME="SAN Region" ^
REM   -e REACT_APP_ENV=production ^
REM   --name frontend_momopass ^
REM   --restart unless-stopped ^
REM   app-insights-dashboard

REM =============================================================================
REM Useful Commands
REM =============================================================================

REM View logs
REM docker logs -f frontend_momopass

REM Stop container
REM docker stop frontend_momopass

REM Start container
REM docker start frontend_momopass

REM Restart container
REM docker restart frontend_momopass

REM Remove container
REM docker rm -f frontend_momopass

REM Check container status
REM docker ps | findstr frontend_momopass

REM Check environment variables
REM docker exec frontend_momopass env | findstr REACT_APP

REM Access container shell
REM docker exec -it frontend_momopass sh

REM Check nginx config
REM docker exec frontend_momopass cat /etc/nginx/conf.d/default.conf
