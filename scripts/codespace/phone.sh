#!/usr/bin/env bash
# One command to preview ZINU on a phone with Expo Go:
#   starts the database, Redis and file storage, prepares the database, runs the API + worker,
#   then starts Expo and prints the QR code.
#   pnpm phone          Expo tunnel mode (default)
#   pnpm phone proxy    fallback if the tunnel will not connect: serves Expo through the Codespace's own port 8081
# Uses development settings only: console OTP (shown on screen) and DEMONSTRATION map data (no Google key).
set -euo pipefail
MODE=${1:-tunnel}
cd "$(dirname "$0")/../.."
ROOT=$(pwd)
LOGS=/tmp/zinu
mkdir -p "$LOGS"

say() { printf '\n\033[1;32m▶ %s\033[0m\n' "$1"; }
warn() { printf '\n\033[1;33m! %s\033[0m\n' "$1"; }

# Public URLs the phone can reach. In Codespaces every forwarded port gets an https address.
if [ -n "${CODESPACE_NAME:-}" ]; then
  DOMAIN=${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-app.github.dev}
  API_URL="https://${CODESPACE_NAME}-4000.${DOMAIN}"
  S3_URL="https://${CODESPACE_NAME}-9000.${DOMAIN}"
else
  IP=$(hostname -I 2>/dev/null | awk '{print $1}')
  API_URL="http://${IP:-localhost}:4000"
  S3_URL="http://${IP:-localhost}:9000"
fi

say "Starting database, Redis and file storage (first run downloads them: 2-4 minutes)"
for i in $(seq 1 30); do docker info >/dev/null 2>&1 && break; sleep 2; done
docker info >/dev/null 2>&1 || { warn "Docker is not running. Rebuild the Codespace (Command Palette → Codespaces: Rebuild Container)."; exit 1; }
docker compose -f infra/docker-compose.yml up -d
for i in $(seq 1 60); do
  docker compose -f infra/docker-compose.yml exec -T postgres pg_isready -U zinu >/dev/null 2>&1 && break
  sleep 2
done

if [ -n "${CODESPACE_NAME:-}" ]; then
  say "Making the API and file storage reachable from your phone"
  PORTS="4000:public 9000:public"
  [ "$MODE" = proxy ] && PORTS="$PORTS 8081:public"
  # shellcheck disable=SC2086
  if ! gh codespace ports visibility $PORTS -c "$CODESPACE_NAME" >/dev/null 2>&1; then
    warn "Could not make ports public automatically. In the PORTS tab, right-click ports ${PORTS//:public/} → Port Visibility → Public."
  fi
fi

[ -f apps/api/.env ] || cp apps/api/.env.example apps/api/.env
# Settings for this session override apps/api/.env (process environment wins over --env-file).
export S3_PUBLIC_ENDPOINT="$S3_URL"
export MAPS_PROVIDER=demo
export OTP_PROVIDER=console
export OTP_DEV_ECHO=true

say "Preparing the database"
pnpm --silent db:migrate
pnpm --silent db:seed

say "Starting the ZINU API and background worker"
pkill -f "apps/api/dist/main.js" 2>/dev/null || true
pkill -f "apps/api/dist/worker.js" 2>/dev/null || true
(cd apps/api && nohup node --env-file=.env "$ROOT/apps/api/dist/main.js" >"$LOGS/api.log" 2>&1 &)
(cd apps/api && nohup node --env-file=.env "$ROOT/apps/api/dist/worker.js" >"$LOGS/worker.log" 2>&1 &)
for i in $(seq 1 30); do
  curl -sf http://localhost:4000/health >/dev/null && break
  sleep 1
done
curl -sf http://localhost:4000/health >/dev/null || { warn "API did not start. Log: $LOGS/api.log"; tail -20 "$LOGS/api.log"; exit 1; }
curl -sf "$API_URL/health" >/dev/null || warn "The API is running, but its public address did not answer yet ($API_URL). Check port 4000 is Public in the PORTS tab."

cat <<INFO

  API for the phone : $API_URL
  Logs              : $LOGS/api.log, $LOGS/worker.log
  Login OTP         : shown on the OTP screen as "Development OTP" (no SMS is sent)
  Maps              : DEMONSTRATION data for Ranchi (yellow banner in the app)

INFO

cd apps/mobile
export EXPO_PUBLIC_API_URL="$API_URL"
if [ "$MODE" = proxy ]; then
  [ -n "${CODESPACE_NAME:-}" ] || { warn "proxy mode only works inside a GitHub Codespace."; exit 1; }
  say "Starting Expo through the Codespace address. Scan the QR code with your iPhone Camera, then open in Expo Go."
  EXPO_PACKAGER_PROXY_URL="https://${CODESPACE_NAME}-8081.${DOMAIN}" exec npx expo start --clear
fi
say "Starting Expo in tunnel mode. Scan the QR code with your iPhone Camera, then open in Expo Go."
echo "  If it says the tunnel took too long to connect, press Ctrl+C and run:  pnpm phone proxy"
exec npx expo start --tunnel --clear
