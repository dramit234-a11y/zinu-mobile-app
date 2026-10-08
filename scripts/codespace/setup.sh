#!/usr/bin/env bash
# Runs once when the Codespace is created: installs dependencies and prepares local settings.
set -euo pipefail
cd "$(dirname "$0")/../.."
corepack enable
corepack prepare pnpm@10.28.0 --activate
pnpm install --frozen-lockfile
[ -f apps/api/.env ] || cp apps/api/.env.example apps/api/.env
echo
echo "ZINU is installed. To preview on your iPhone, run:  pnpm phone"
