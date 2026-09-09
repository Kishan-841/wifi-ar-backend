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
REMOTE_DIR="~/wifi-ar"

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
  echo "→ creating the first admin"
  ssh "$TARGET" "cd $REMOTE_DIR/deploy && docker compose exec api npm run seed:admin"
fi

HOST="${TARGET#*@}"
PORT=$(ssh "$TARGET" "cd $REMOTE_DIR/deploy && grep -E '^PUBLIC_PORT=' .env | cut -d= -f2" || true)
PORT="${PORT:-80}"
URL="http://$HOST"; [ "$PORT" != "80" ] && URL="$URL:$PORT"
echo "→ health check: $URL/health"
curl -fsS --max-time 10 "$URL/health" && echo && echo "✓ backend is up at $URL" || echo "✗ no answer yet — check 'docker compose logs -f' on the VM and the VM firewall for port $PORT"
