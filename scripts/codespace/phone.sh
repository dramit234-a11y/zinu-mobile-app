#!/usr/bin/env bash
# One command to preview ZINU on a phone with Expo Go from a GitHub Codespace:
#   1. starts PostgreSQL, Redis and file storage in Docker (private to the Codespace)
#   2. prepares the database and runs the API + worker
#   3. opens ONE public https address with a Cloudflare quick tunnel (free, no account, temporary) to a local
#      gateway that only passes the app's API routes, signed storage requests and the Expo bundler (gateway.mjs)
#   4. checks that address from the internet side, then prints a QR code for Expo Go
# Why not Codespaces port forwarding or Expo's ngrok tunnel: see docs/IPHONE_PREVIEW.md ("Why a Cloudflare tunnel").
# Development settings only: the login OTP is printed in THIS terminal (never returned over the network) and maps
# use DEMONSTRATION data (no Google key).
set -euo pipefail
cd "$(dirname "$0")/../.."
ROOT=$(pwd)
LOGS=/tmp/zinu
mkdir -p "$LOGS"
GATEWAY_PORT=8090
CF_VERSION=2026.10.0
CF_SHA256=d33ff2d14475178d2012c2c56beba87389ac5ded27649519f198a7d3134a99db
CF="$HOME/.local/bin/cloudflared"

say() { printf '\n\033[1;32m▶ %s\033[0m\n' "$1"; }
ok() { printf '  \033[32m✓\033[0m %s\n' "$1"; }
warn() { printf '\n\033[1;33m! %s\033[0m\n' "$1"; }
fail() { printf '\n\033[1;31m✗ %s\033[0m\n' "$1"; exit 1; }
# Stops background programs from an earlier run (matched on their exact command line, never this script).
stop() { ps -eo pid=,args= | awk -v pat="$1" 'index($0, pat) && !/awk/ {print $1}' | xargs -r kill 2>/dev/null || true; }

say "Starting database, Redis and file storage (first run downloads them: 2-4 minutes)"
for _ in $(seq 1 30); do docker info >/dev/null 2>&1 && break; sleep 2; done
docker info >/dev/null 2>&1 || fail "Docker is not running. Rebuild the Codespace (F1 → Codespaces: Rebuild Container)."
docker compose -f infra/docker-compose.yml up -d
for _ in $(seq 1 60); do
  docker compose -f infra/docker-compose.yml exec -T postgres pg_isready -U zinu >/dev/null 2>&1 && break
  sleep 2
done

if [ -n "${CODESPACE_NAME:-}" ]; then
  # Earlier versions of this script made these public. The tunnel below replaces that, so keep them private.
  gh codespace ports visibility 4000:private 9000:private 8081:private -c "$CODESPACE_NAME" >/dev/null 2>&1 || true
fi

if ! "$CF" --version 2>/dev/null | grep -q "$CF_VERSION"; then
  say "Installing cloudflared $CF_VERSION (one time)"
  [ "$(uname -m)" = x86_64 ] || fail "This script supports x86_64 Codespaces only (found $(uname -m))."
  mkdir -p "$(dirname "$CF")"
  curl -fsSL -o "$CF.download" "https://github.com/cloudflare/cloudflared/releases/download/$CF_VERSION/cloudflared-linux-amd64"
  echo "$CF_SHA256  $CF.download" | sha256sum -c --quiet - || { rm -f "$CF.download"; fail "cloudflared download failed its checksum."; }
  chmod +x "$CF.download" && mv "$CF.download" "$CF"
fi

say "Opening a temporary public https address for your phone"
stop "scripts/codespace/gateway.mjs"
stop "tunnel --no-autoupdate --url http://127.0.0.1:$GATEWAY_PORT"
# Ctrl+C (or any failure) closes the public address. The API, worker and databases keep running privately.
trap 'stop "tunnel --no-autoupdate --url http://127.0.0.1:$GATEWAY_PORT"; stop "scripts/codespace/gateway.mjs"; stop "tail -n0 -F $LOGS/api.log"; printf "\nPublic address closed.\n"' EXIT
BUCKET=$(grep -E '^S3_BUCKET=' apps/api/.env 2>/dev/null | cut -d= -f2 || true)
S3_BUCKET="${BUCKET:-zinu-dev}" GATEWAY_PORT=$GATEWAY_PORT nohup node scripts/codespace/gateway.mjs >"$LOGS/gateway.log" 2>&1 &
: >"$LOGS/tunnel.log"
nohup "$CF" tunnel --no-autoupdate --url "http://127.0.0.1:$GATEWAY_PORT" >"$LOGS/tunnel.log" 2>&1 &
PUBLIC_URL=""
for _ in $(seq 1 60); do
  PUBLIC_URL=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$LOGS/tunnel.log" | grep -v '//api\.' | head -1 || true)
  [ -n "$PUBLIC_URL" ] && grep -q "Registered tunnel connection" "$LOGS/tunnel.log" && break
  sleep 1
done
[ -n "$PUBLIC_URL" ] && grep -q "Registered tunnel connection" "$LOGS/tunnel.log" || { tail -15 "$LOGS/tunnel.log"; fail "Cloudflare did not give a tunnel address. Run pnpm phone again."; }
HOST=${PUBLIC_URL#https://}
ok "Address: $PUBLIC_URL"

[ -f apps/api/.env ] || cp apps/api/.env.example apps/api/.env
# Settings for this session override apps/api/.env (process environment wins over --env-file).
export S3_PUBLIC_ENDPOINT="$PUBLIC_URL"
export MAPS_PROVIDER=demo
export OTP_PROVIDER=console
export OTP_DEV_ECHO=false

say "Preparing the database"
pnpm --silent db:migrate
pnpm --silent db:seed

say "Starting the ZINU API and background worker"
stop "apps/api/dist/main.js"
stop "apps/api/dist/worker.js"
(cd apps/api && nohup node --env-file=.env "$ROOT/apps/api/dist/main.js" >"$LOGS/api.log" 2>&1 &)
(cd apps/api && nohup node --env-file=.env "$ROOT/apps/api/dist/worker.js" >"$LOGS/worker.log" 2>&1 &)
for _ in $(seq 1 30); do curl -sf http://127.0.0.1:4000/health >/dev/null && break; sleep 1; done
curl -sf http://127.0.0.1:4000/health >/dev/null || { tail -20 "$LOGS/api.log"; fail "API did not start. Log: $LOGS/api.log"; }
ok "API running"

say "Checking the public address from the internet side"
RESOLVED=""
for _ in $(seq 1 30); do
  RESOLVED=$(curl -s --max-time 5 -H 'accept: application/dns-json' "https://cloudflare-dns.com/dns-query?name=$HOST&type=A" | grep -oE '"data":"[0-9.]+"' | head -1 || true)
  [ -n "$RESOLVED" ] && break
  sleep 2
done
if [ -n "$RESOLVED" ]; then ok "Public DNS knows $HOST"; else warn "Could not confirm $HOST with public DNS (checking https anyway)"; fi
for _ in $(seq 1 30); do curl -sf --max-time 5 "$PUBLIC_URL/health" >/dev/null && break; sleep 2; done
curl -sf --max-time 5 "$PUBLIC_URL/health" >/dev/null || { tail -15 "$LOGS/tunnel.log"; fail "The API does not answer through $PUBLIC_URL"; }
ok "API answers through the tunnel"
[ "$(curl -s -o /dev/null -w '%{http_code}' "$PUBLIC_URL/v1/admin/dashboard")" = 404 ] && ok "Admin API is not reachable from outside"

# Show login codes here: the API logs them, the network never returns them.
stop "tail -n0 -F $LOGS/api.log"
(tail -n0 -F "$LOGS/api.log" 2>/dev/null | grep --line-buffered -oE 'OTP for \+?[0-9]+: [0-9]+' |
  while read -r line; do printf '\n\033[1;36m  🔑 Login code — %s\033[0m\n\n' "$line"; done) &

# After Metro is up: confirm Expo hands out the public https address, then print the QR code for Expo Go.
(
  for _ in $(seq 1 120); do curl -sf --max-time 5 "$PUBLIC_URL/status" 2>/dev/null | grep -q running && break; sleep 2; done
  if ! curl -sf --max-time 5 "$PUBLIC_URL/status" | grep -q running; then
    warn "Expo is not answering through $PUBLIC_URL. Log: $LOGS/tunnel.log"
    exit 0
  fi
  if curl -sf --max-time 60 -H 'expo-platform: ios' -H 'accept: application/expo+json,application/json' "$PUBLIC_URL/" | grep -q "https://$HOST"; then
    ok "Expo is serving the app at $PUBLIC_URL"
  else
    warn "Expo answered, but its app manifest does not point at $PUBLIC_URL"
  fi
  node -e '
    const { printQRCode } = require(process.argv[1]);
    printQRCode(process.argv[2]).print();' \
    "$ROOT/node_modules/@expo/cli/build/src/utils/qr.js" "exps://$HOST" 2>/dev/null || true
  cat <<INFO

  ZINU is ready for your iPhone.
    1. On the iPhone, open Safari: $PUBLIC_URL/status
       It must say "packager-status:running". (If Safari can't find the server, see docs/IPHONE_PREVIEW.md.)
    2. Scan the QR code above with the iPhone Camera and tap "Open in Expo Go",
       or in Expo Go tap "Enter URL manually" and type:  exps://$HOST
    3. Login code: shown in this terminal as "🔑 Login code" after you request it.
    Maps use DEMONSTRATION data for Ranchi (yellow banner in the app).
    Logs: $LOGS/api.log   Stop: Ctrl+C

INFO
) &

say "Starting Expo (Metro). The QR code appears below once the app is reachable."
cd apps/mobile
export EXPO_PUBLIC_API_URL="$PUBLIC_URL"
export EXPO_PACKAGER_PROXY_URL="$PUBLIC_URL"
export EXPO_NO_QR_CODE=1 # Expo's own QR would say exp://…:443 (plain http to an https port); ours above says exps://
npx expo start --clear --port 8081 || true
