#!/bin/bash
set -euo pipefail

PORT="${1:-3002}"
export CODEX_MOCK="${CODEX_MOCK:-1}"

docker compose up -d postgres
npm run db:migrate
npm run demo:reset
npm run dev -- -p "$PORT"
