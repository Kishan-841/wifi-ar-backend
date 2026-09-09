#!/bin/bash
# Copy the backend + deploy config to the VM and (re)start the stack there.
#
# Usage:
#   ./tools/deploy-vm.sh user@VM_IP            sync + `docker compose up -d --build`
#   ./tools/deploy-vm.sh user@VM_IP seed       …then create the first admin from deploy/.env
#
# Requires on the VM: Docker Engine with the compose plugin, and your SSH key.
# Requires here: rsync (ships with macOS).
#
# Only source is copied. node_modules, .env files and markdown stay local;
# the image is built on the VM from what was synced.
set -euo pipefail

TARGET="${1:?usage: deploy-vm.sh user@host [seed]}"
ACTION="${2:-}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REMOTE_DIR="~/wifi-ar-backend"

echo "→ syncing backend/ and deploy/ to $TARGET:$REMOTE_DIR"
ssh "$TARGET" "mkdir -p $REMOTE_DIR"
rsync -az --delete \
  --exclude node_modules --exclude '.env' --exclude '*.md' --exclude '.DS_Store' \
  "$ROOT/backend" "$ROOT/deploy" "$TARGET:$REMOTE_DIR/"

echo "→ building and starting containers"
ssh "$TARGET" "cd $REMOTE_DIR/deploy && \
  if [ ! -f .env ]; then echo 'deploy/.env missing on the VM — copy .env.example to .env and fill it in'; exit 1; fi && \
  docker compose up -d --build && docker compose ps"

if [ "$ACTION" = "seed" ]; then
  echo "→ waiting for the API to finish migrations"
  ssh "$TARGET" "cd $REMOTE_DIR/deploy && for i in \$(seq 1 30); do \
    docker compose logs api 2>/dev/null | grep -q 'backend listening' && exit 0; sleep 2; done; \
    echo 'API did not come up in 60s'; docker compose logs api | tail -20; exit 1"
  echo "→ creating the first admin"
  ssh "$TARGET" "cd $REMOTE_DIR/deploy && docker compose exec api npm run seed:admin"
fi

URL=$(ssh "$TARGET" "cd $REMOTE_DIR/deploy && grep -E '^API_URL=' .env | cut -d= -f2-" || true)
URL="${URL:-http://${TARGET#*@}:8080}"
echo "→ health check: $URL/health"
curl -fsS --max-time 10 "$URL/health" && echo && echo "✓ backend is up at $URL" || echo "✗ no answer yet — check 'docker compose logs -f api' on the VM, the nginx site, and DNS for $URL"
