#!/usr/bin/env bash
# Deploy tax.solo.engineer to the omniroute VPS.
# Run on the server as `ubuntu` from /opt/tax-solo-engineer/app.
set -euo pipefail

app_path="/opt/tax-solo-engineer/app"
shared_path="/opt/tax-solo-engineer/shared"

mkdir -p "$shared_path"

cd "$app_path"
git fetch origin main
git reset --hard origin/main
npm ci
npm run build
pm2 startOrReload ecosystem.config.cjs --only tax-solo-engineer --update-env
pm2 save --force

sleep 2

for attempt in {1..60}; do
  if curl --fail --silent --show-error http://127.0.0.1:3003/ >/dev/null; then
    echo "tax-solo-engineer healthy on :3003"
    exit 0
  fi
  sleep 1
done

echo "tax-solo-engineer health check failed after 60 seconds." >&2
exit 1
