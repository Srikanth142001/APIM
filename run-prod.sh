#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# NexGen APIM — Start production containers
# Usage: ./run-prod.sh
# ─────────────────────────────────────────────────────────────────────────────

set -e

# Check .env exists
if [ ! -f .env ]; then
  echo "❌ .env file not found. Copy .env.prod to .env and fill in your values:"
  echo "   cp .env.prod .env && nano .env"
  exit 1
fi

echo "🚀 Pulling latest images..."
docker pull reddy321678/momo_backend:latest
docker pull reddy321678/momo_frontend:latest

echo ""
echo "🚀 Starting NexGen APIM..."
docker-compose -f docker-compose.prod.yml --env-file .env up -d

echo ""
echo "✅ Started!"
source .env 2>/dev/null || true
echo "   Frontend: http://$(hostname -I | awk '{print $1}'):${FRONTEND_PORT:-8082}"
echo "   Backend:  http://$(hostname -I | awk '{print $1}'):${BACKEND_PORT:-5000}"
echo ""
echo "   Logs:  docker-compose -f docker-compose.prod.yml logs -f"
echo "   Stop:  docker-compose -f docker-compose.prod.yml down"
