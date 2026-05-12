#!/bin/bash
# ── NexGen APIM — Build, Push & Deploy Script ────────────────────────────────
# Usage:
#   ./deploy.sh                          # build + push + deploy with defaults
#   ./deploy.sh --tag v1.2.3             # specific image tag
#   ./deploy.sh --registry myacr.azurecr.io  # custom registry
#   ./deploy.sh --build-only             # build images only, no push/deploy
#   ./deploy.sh --deploy-only            # deploy only (images already pushed)
# ─────────────────────────────────────────────────────────────────────────────

set -e

# ── Defaults ──────────────────────────────────────────────────────────────────
REGISTRY="${REGISTRY:-nexgen-apim}"
TAG="${IMAGE_TAG:-latest}"
COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env"
BUILD_ONLY=false
DEPLOY_ONLY=false

# ── Parse args ────────────────────────────────────────────────────────────────
while [[ "$#" -gt 0 ]]; do
  case $1 in
    --tag)        TAG="$2";        shift ;;
    --registry)   REGISTRY="$2";   shift ;;
    --build-only) BUILD_ONLY=true  ;;
    --deploy-only) DEPLOY_ONLY=true ;;
    --env-file)   ENV_FILE="$2";   shift ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
  shift
done

# ── Load env file ─────────────────────────────────────────────────────────────
if [ -f "$ENV_FILE" ]; then
  export $(grep -v '^#' "$ENV_FILE" | xargs)
  echo "✅ Loaded env from $ENV_FILE"
else
  echo "⚠️  No $ENV_FILE found. Using environment variables."
fi

export REGISTRY TAG IMAGE_TAG=$TAG

BACKEND_IMAGE="$REGISTRY/apim-backend:$TAG"
FRONTEND_IMAGE="$REGISTRY/apim-frontend:$TAG"

echo ""
echo "═══════════════════════════════════════════════════"
echo "  NexGen APIM — Production Deployment"
echo "═══════════════════════════════════════════════════"
echo "  Registry:  $REGISTRY"
echo "  Tag:       $TAG"
echo "  Backend:   $BACKEND_IMAGE"
echo "  Frontend:  $FRONTEND_IMAGE"
echo "═══════════════════════════════════════════════════"
echo ""

# ── Build ─────────────────────────────────────────────────────────────────────
if [ "$DEPLOY_ONLY" = false ]; then
  echo "🔨 Building images..."

  echo "  → Building backend..."
  docker build \
    -t "$BACKEND_IMAGE" \
    ./app-insights-backend

  echo "  → Building frontend..."
  docker build \
    --build-arg REACT_APP_REGION_NAME="${REACT_APP_REGION_NAME:-SAN Region}" \
    --build-arg REACT_APP_API_PROTOCOL="${REACT_APP_API_PROTOCOL:-http}" \
    --build-arg REACT_APP_API_HOSTNAME="${REACT_APP_API_HOSTNAME:-172.30.38.193}" \
    --build-arg REACT_APP_API_PORT="${REACT_APP_API_PORT:-5005}" \
    -t "$FRONTEND_IMAGE" \
    ./app-insights-dashboard

  echo "✅ Build complete"
fi

# ── Push ──────────────────────────────────────────────────────────────────────
if [ "$BUILD_ONLY" = false ] && [ "$DEPLOY_ONLY" = false ]; then
  echo ""
  echo "📤 Pushing images to registry..."
  docker push "$BACKEND_IMAGE"
  docker push "$FRONTEND_IMAGE"
  echo "✅ Push complete"
fi

# ── Deploy ────────────────────────────────────────────────────────────────────
if [ "$BUILD_ONLY" = false ]; then
  echo ""
  echo "🚀 Deploying with docker-compose..."

  docker-compose -f "$COMPOSE_FILE" pull 2>/dev/null || true
  docker-compose -f "$COMPOSE_FILE" up -d --remove-orphans

  echo ""
  echo "⏳ Waiting for services to be healthy..."
  sleep 10

  echo ""
  echo "📊 Service status:"
  docker-compose -f "$COMPOSE_FILE" ps

  echo ""
  echo "═══════════════════════════════════════════════════"
  echo "✅ Deployment complete!"
  echo ""
  echo "  Frontend: http://localhost:${FRONTEND_HOST_PORT:-3000}"
  echo "  Backend:  http://localhost:${BACKEND_HOST_PORT:-5005}"
  echo ""
  echo "  Logs:  docker-compose -f $COMPOSE_FILE logs -f"
  echo "  Stop:  docker-compose -f $COMPOSE_FILE down"
  echo "═══════════════════════════════════════════════════"
fi
