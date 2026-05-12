@echo off
REM Run Multiple Instances of App Insights Dashboard
REM Each instance can have different port and API endpoint

echo ==========================================
echo Multi-Instance Deployment
echo ==========================================
echo.

REM Build the image once (if not already built)
echo Building Docker image...
docker build -t app-insights-dashboard:latest ^
  --build-arg REACT_APP_API_PROTOCOL=http ^
  --build-arg REACT_APP_API_HOSTNAME=172.30.38.193 ^
  --build-arg REACT_APP_API_PORT=5005 ^
  --build-arg REACT_APP_REGION_NAME="Default Region" ^
  .

echo.
echo ==========================================
echo Starting Multiple Instances
echo ==========================================
echo.

REM Instance 1: SAN Region on port 8080
echo Starting SAN Region instance on port 8080...
docker run -d ^
  -p 8080:8080 ^
  -e PORT=8080 ^
  -e REACT_APP_API_PROTOCOL=http ^
  -e REACT_APP_API_HOSTNAME=172.30.38.193 ^
  -e REACT_APP_API_PORT=5005 ^
  -e REACT_APP_REGION_NAME="SAN Region" ^
  --name frontend_san ^
  app-insights-dashboard:latest

REM Instance 2: US East Region on port 9090
echo Starting US East Region instance on port 9090...
docker run -d ^
  -p 9090:9090 ^
  -e PORT=9090 ^
  -e REACT_APP_API_PROTOCOL=http ^
  -e REACT_APP_API_HOSTNAME=10.20.30.40 ^
  -e REACT_APP_API_PORT=5006 ^
  -e REACT_APP_REGION_NAME="US East Region" ^
  --name frontend_useast ^
  app-insights-dashboard:latest

REM Instance 3: EU West Region on port 7070
echo Starting EU West Region instance on port 7070...
docker run -d ^
  -p 7070:7070 ^
  -e PORT=7070 ^
  -e REACT_APP_API_PROTOCOL=http ^
  -e REACT_APP_API_HOSTNAME=192.168.1.100 ^
  -e REACT_APP_API_PORT=5007 ^
  -e REACT_APP_REGION_NAME="EU West Region" ^
  --name frontend_euwest ^
  app-insights-dashboard:latest

echo.
echo ==========================================
echo All instances started!
echo ==========================================
echo.
echo Access your dashboards at:
echo   SAN Region:     http://localhost:8080
echo   US East Region: http://localhost:9090
echo   EU West Region: http://localhost:7070
echo.
echo To view logs:
echo   docker logs frontend_san
echo   docker logs frontend_useast
echo   docker logs frontend_euwest
echo.
echo To stop all instances:
echo   docker stop frontend_san frontend_useast frontend_euwest
echo.
echo To remove all instances:
echo   docker rm frontend_san frontend_useast frontend_euwest
echo.
pause
