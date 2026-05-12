@echo off
REM Test script for runtime port configuration

echo ==========================================
echo Testing Runtime Port Configuration
echo ==========================================
echo.

set IMAGE_NAME=dashboard-test
set CONTAINER_NAME=dashboard-test

echo Step 1: Building Docker image...
docker build -t %IMAGE_NAME% .
if %errorlevel% neq 0 (
    echo [ERROR] Build failed!
    exit /b 1
)
echo [SUCCESS] Build completed
echo.

echo Step 2: Testing default port (80)...
docker run -d -p 3000:80 --name %CONTAINER_NAME%-default %IMAGE_NAME%
timeout /t 5 /nobreak >nul
echo Checking if accessible on port 3000...
curl -s http://localhost:3000 >nul
if %errorlevel% equ 0 (
    echo [SUCCESS] Default port works!
) else (
    echo [ERROR] Default port failed!
)
docker rm -f %CONTAINER_NAME%-default
echo.

echo Step 3: Testing custom port (8080)...
docker run -d -p 8080:8080 -e PORT=8080 --name %CONTAINER_NAME%-8080 %IMAGE_NAME%
timeout /t 5 /nobreak >nul
echo Checking if accessible on port 8080...
curl -s http://localhost:8080 >nul
if %errorlevel% equ 0 (
    echo [SUCCESS] Custom port 8080 works!
) else (
    echo [ERROR] Custom port 8080 failed!
)
docker rm -f %CONTAINER_NAME%-8080
echo.

echo Step 4: Testing another custom port (5000)...
docker run -d -p 5000:5000 -e PORT=5000 --name %CONTAINER_NAME%-5000 %IMAGE_NAME%
timeout /t 5 /nobreak >nul
echo Checking if accessible on port 5000...
curl -s http://localhost:5000 >nul
if %errorlevel% equ 0 (
    echo [SUCCESS] Custom port 5000 works!
) else (
    echo [ERROR] Custom port 5000 failed!
)
docker rm -f %CONTAINER_NAME%-5000
echo.

echo Step 5: Verifying nginx config generation...
docker run -d -p 9000:9000 -e PORT=9000 --name %CONTAINER_NAME%-verify %IMAGE_NAME%
timeout /t 3 /nobreak >nul
echo Checking generated nginx config...
docker exec %CONTAINER_NAME%-verify cat /etc/nginx/conf.d/default.conf | findstr "listen 9000"
if %errorlevel% equ 0 (
    echo [SUCCESS] nginx config correctly generated with port 9000!
) else (
    echo [ERROR] nginx config generation failed!
)
docker rm -f %CONTAINER_NAME%-verify
echo.

echo ==========================================
echo Testing Complete!
echo ==========================================
echo.
echo Cleanup: Removing test image...
docker rmi %IMAGE_NAME%
echo.
echo All tests completed!
