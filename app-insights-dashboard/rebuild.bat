@echo off
REM Rebuild script with correct API configuration

echo ==========================================
echo Rebuilding App Insights Dashboard
echo ==========================================
echo.

echo Step 1: Stopping and removing old container...
docker stop frontend_momopass 2>nul
docker rm frontend_momopass 2>nul
echo [DONE]
echo.

echo Step 2: Removing old image...
docker rmi app-insights-dashboard 2>nul
echo [DONE]
echo.

echo Step 3: Building new image with correct API configuration...
echo API Configuration:
echo   Protocol: http
echo   Hostname: 172.30.38.193
echo   Port: 5005
echo   Region: SAN Region
echo.

docker build ^
  --build-arg REACT_APP_API_PROTOCOL=http ^
  --build-arg REACT_APP_API_HOSTNAME=172.30.38.193 ^
  --build-arg REACT_APP_API_PORT=5005 ^
  --build-arg REACT_APP_REGION_NAME="SAN Region" ^
  -t app-insights-dashboard .

if %errorlevel% neq 0 (
    echo [ERROR] Build failed!
    exit /b 1
)
echo [DONE]
echo.

echo Step 4: Starting new container...
docker run -d ^
  -p 8080:8080 ^
  -e PORT=8080 ^
  --name frontend_momopass ^
  --restart unless-stopped ^
  app-insights-dashboard

if %errorlevel% neq 0 (
    echo [ERROR] Failed to start container!
    exit /b 1
)
echo [DONE]
echo.

echo ==========================================
echo Rebuild Complete!
echo ==========================================
echo.
echo Container: frontend_momopass
echo Access: http://localhost:8080
echo API Endpoint: http://172.30.38.193:5005
echo.
echo Checking container status...
docker ps | findstr frontend_momopass
echo.
echo Checking logs...
docker logs frontend_momopass
echo.
echo ==========================================
