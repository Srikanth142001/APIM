@echo off
REM ═══════════════════════════════════════════════════════════════════════════
REM NexGen APIM — Build and run as a single container (Windows)
REM Usage: run-combined.cmd [PORT]
REM ═══════════════════════════════════════════════════════════════════════════

SET PORT=%1
IF "%PORT%"=="" SET PORT=8082

SET IMAGE=nexgen-apim:latest

echo Building combined image...
docker build -f Dockerfile.combined -t %IMAGE% .

echo.
echo Starting container on port %PORT%...
docker run -d ^
  --name nexgen-apim ^
  -p %PORT%:80 ^
  -e REACT_APP_REGION_NAME=%REACT_APP_REGION_NAME% ^
  -e APP_INSIGHTS_APP_ID=%APP_INSIGHTS_APP_ID% ^
  -e APP_INSIGHTS_API_KEY=%APP_INSIGHTS_API_KEY% ^
  -e AZURE_SUBSCRIPTION_ID=%AZURE_SUBSCRIPTION_ID% ^
  -e AZURE_RESOURCE_GROUP=%AZURE_RESOURCE_GROUP% ^
  -e AKS_CLUSTER_NAME=%AKS_CLUSTER_NAME% ^
  -e MYSQL_SERVER_NAME=%MYSQL_SERVER_NAME% ^
  -e LOG_ANALYTICS_AUTH_TOKEN=%LOG_ANALYTICS_AUTH_TOKEN% ^
  -e JWT_SECRET=%JWT_SECRET% ^
  -e ADMIN_USERNAME=%ADMIN_USERNAME% ^
  -e ADMIN_PASSWORD=%ADMIN_PASSWORD% ^
  -e TELEGRAM_BOT_TOKEN=%TELEGRAM_BOT_TOKEN% ^
  -e TELEGRAM_CHAT_ID=%TELEGRAM_CHAT_ID% ^
  %IMAGE%

echo.
echo Container started!
echo Open: http://localhost:%PORT%
echo Logs: docker logs -f nexgen-apim
echo Stop: docker stop nexgen-apim ^&^& docker rm nexgen-apim
