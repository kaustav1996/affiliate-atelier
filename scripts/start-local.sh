#!/bin/bash
set -euo pipefail

PORT="${1:-3002}"

docker compose up -d postgres
npm run db:migrate
npm run demo:reset
env -u CODEX_MOCK npm run dev -- -p "$PORT"
