#!/usr/bin/env bash
# Deploys an image tag to staging or production, waits for a healthy response,
# and automatically rolls back to the previous version if the health check fails.
# Usage: deploy.sh <staging|production> <image-tag> <expected-version>
set -euo pipefail

ENVIRONMENT="$1"
TAG="$2"
EXPECTED_VERSION="$3"

case "$ENVIRONMENT" in
  staging)    CONTAINER=incident-staging ;;
  production) CONTAINER=incident-prod ;;
  *) echo "Unknown environment: $ENVIRONMENT"; exit 1 ;;
esac

COMPOSE_FILE="docker-compose.${ENVIRONMENT}.yml"
HEALTH_URL="http://${CONTAINER}:3000/health"

PREVIOUS_TAG=""
if docker inspect "$CONTAINER" >/dev/null 2>&1; then
  PREVIOUS_TAG=$(docker inspect -f '{{.Config.Image}}' "$CONTAINER" | awk -F: '{print $NF}')
fi
echo "Deploying ${TAG} to ${ENVIRONMENT} (currently running: ${PREVIOUS_TAG:-nothing})"

IMAGE_TAG="$TAG" docker compose -f "$COMPOSE_FILE" up -d --remove-orphans

for i in $(seq 1 20); do
  RESPONSE=$(curl -fsS "$HEALTH_URL" 2>/dev/null || true)
  if [ -n "$RESPONSE" ] && echo "$RESPONSE" | jq -e --arg v "$EXPECTED_VERSION" '.status == "ok" and .version == $v' >/dev/null; then
    echo "✅ ${ENVIRONMENT} is healthy: ${RESPONSE}"
    mkdir -p dist
    echo "$TAG" > "dist/${ENVIRONMENT}-version.txt"
    exit 0
  fi
  echo "Waiting for ${ENVIRONMENT} to become healthy (${i}/20)..."
  sleep 3
done

echo "❌ Health check failed for ${TAG} in ${ENVIRONMENT}"
docker logs --tail 50 "$CONTAINER" || true

if [ -n "$PREVIOUS_TAG" ] && [ "$PREVIOUS_TAG" != "$TAG" ]; then
  echo "↩️  Rolling back ${ENVIRONMENT} to ${PREVIOUS_TAG}"
  IMAGE_TAG="$PREVIOUS_TAG" docker compose -f "$COMPOSE_FILE" up -d
fi
exit 1
