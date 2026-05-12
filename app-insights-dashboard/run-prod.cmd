@echo off
REM ─────────────────────────────────────────────────────────────────────────────
REM NexGen APIM — Start production containers (Windows)
REM Usage: run-prod.cmd
REM ─────────────────────────────────────────────────────────────────────────────

IF NOT EXIST .env (
  echo ERROR: .env file not found. Copy .env.prod to .env and fill in your values:
  echo   copy .env.prod .env
  exit /b 1
)

echo Pulling latest images...
docker pull reddy321678/momo_backend:latest
docker pull reddy321678/momo_frontend:latest

echo.
echo Starting NexGen APIM...
docker-compose -f docker-compose.prod.yml --env-file .env up -d

echo.
echo Started! Open http://YOUR_SERVER_IP:8082
echo.
echo Logs:  docker-compose -f docker-compose.prod.yml logs -f
echo Stop:  docker-compose -f docker-compose.prod.yml down
