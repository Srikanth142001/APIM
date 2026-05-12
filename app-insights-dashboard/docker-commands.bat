@echo off
REM App Insights Dashboard - Docker Commands Helper Script (Windows)
REM This script provides easy commands to manage the Docker container with dynamic ports

setlocal enabledelayedexpansion

set IMAGE_NAME=app-insights-dashboard
set CONTAINER_NAME=app-insights-dashboard
set DEFAULT_PORT=80
set DEFAULT_HOST_PORT=3000

if "%1"=="" goto help
if "%1"=="help" goto help
if "%1"=="--help" goto help
if "%1"=="-h" goto help
if "%1"=="build" goto build
if "%1"=="run" goto run
if "%1"=="stop" goto stop
if "%1"=="start" goto start
if "%1"=="restart" goto restart
if "%1"=="logs" goto logs
if "%1"=="remove" goto remove
if "%1"=="clean" goto clean
if "%1"=="status" goto status
if "%1"=="shell" goto shell

echo [ERROR] Unknown command: %1
goto help

:build
echo [INFO] Building Docker image: %IMAGE_NAME%
docker build -t %IMAGE_NAME% .
if %errorlevel% equ 0 (
    echo [INFO] Build completed successfully!
) else (
    echo [ERROR] Build failed!
    exit /b 1
)
goto end

:run
set PORT=%2
set HOST_PORT=%3
if "%PORT%"=="" set PORT=%DEFAULT_PORT%
if "%HOST_PORT%"=="" set HOST_PORT=%DEFAULT_HOST_PORT%

echo [INFO] Starting container on port %HOST_PORT% (container port: %PORT%)

REM Check if container exists and remove it
docker ps -a --format "{{.Names}}" | findstr /x "%CONTAINER_NAME%" >nul 2>&1
if %errorlevel% equ 0 (
    echo [WARNING] Container %CONTAINER_NAME% already exists. Removing it...
    docker rm -f %CONTAINER_NAME%
)

docker run -d -p %HOST_PORT%:%PORT% -e PORT=%PORT% --name %CONTAINER_NAME% %IMAGE_NAME%
if %errorlevel% equ 0 (
    echo [INFO] Container started successfully!
    echo [INFO] Access the application at: http://localhost:%HOST_PORT%
) else (
    echo [ERROR] Failed to start container!
    exit /b 1
)
goto end

:stop
echo [INFO] Stopping container: %CONTAINER_NAME%
docker stop %CONTAINER_NAME%
if %errorlevel% equ 0 (
    echo [INFO] Container stopped successfully!
) else (
    echo [ERROR] Failed to stop container!
)
goto end

:start
echo [INFO] Starting container: %CONTAINER_NAME%
docker start %CONTAINER_NAME%
if %errorlevel% equ 0 (
    echo [INFO] Container started successfully!
) else (
    echo [ERROR] Failed to start container!
)
goto end

:restart
echo [INFO] Restarting container: %CONTAINER_NAME%
docker restart %CONTAINER_NAME%
if %errorlevel% equ 0 (
    echo [INFO] Container restarted successfully!
) else (
    echo [ERROR] Failed to restart container!
)
goto end

:logs
echo [INFO] Showing logs for container: %CONTAINER_NAME%
docker logs -f %CONTAINER_NAME%
goto end

:remove
echo [INFO] Removing container: %CONTAINER_NAME%
docker rm -f %CONTAINER_NAME%
if %errorlevel% equ 0 (
    echo [INFO] Container removed successfully!
) else (
    echo [ERROR] Failed to remove container!
)
goto end

:clean
echo [WARNING] This will remove the container and image. Continue? (Y/N)
set /p response=
if /i "%response%"=="Y" (
    echo [INFO] Cleaning up...
    docker rm -f %CONTAINER_NAME% 2>nul
    docker rmi %IMAGE_NAME% 2>nul
    echo [INFO] Cleanup completed!
) else (
    echo [INFO] Cleanup cancelled.
)
goto end

:status
echo [INFO] Container status:
docker ps -a --filter "name=%CONTAINER_NAME%" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
goto end

:shell
echo [INFO] Opening shell in container: %CONTAINER_NAME%
docker exec -it %CONTAINER_NAME% sh
goto end

:help
echo App Insights Dashboard - Docker Management Script (Windows)
echo.
echo Usage: docker-commands.bat [COMMAND] [OPTIONS]
echo.
echo Commands:
echo     build                   Build the Docker image
echo     run [PORT] [HOST_PORT]  Run container (default: container=80, host=3000)
echo     stop                    Stop the container
echo     start                   Start the container
echo     restart                 Restart the container
echo     logs                    View container logs (follow mode)
echo     remove                  Remove the container
echo     clean                   Remove container and image
echo     status                  Show container status
echo     shell                   Open shell in container
echo     help                    Show this help message
echo.
echo Examples:
echo     REM Build image
echo     docker-commands.bat build
echo.
echo     REM Run on default ports (container: 80, host: 3000)
echo     docker-commands.bat run
echo.
echo     REM Run on custom ports (container: 8080, host: 8080)
echo     docker-commands.bat run 8080 8080
echo.
echo     REM Run on port 5000 inside container, 9000 on host
echo     docker-commands.bat run 5000 9000
echo.
echo     REM View logs
echo     docker-commands.bat logs
echo.
echo     REM Stop container
echo     docker-commands.bat stop
echo.
echo     REM Clean up everything
echo     docker-commands.bat clean
echo.
goto end

:end
endlocal
