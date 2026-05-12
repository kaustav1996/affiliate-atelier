---
name: scentforge-run-local
description: Use when starting, resetting, or verifying ScentForge Atelier locally. Handles Docker Postgres, Prisma migration/seed, clean demo state, Next.js dev server, and local test commands.
---

# ScentForge Run Local

Use this for requests like "run the app", "start local", "reset demo", "can I test?", or "verify locally".

## Clean Start

Run:

```bash
if [ ! -d node_modules ]; then npm ci; fi
npx playwright install chromium
docker compose up -d postgres
npm run db:migrate
npm run demo:reset
```

`demo:reset` clears generated storefront artifacts, resets Postgres, reseeds the demo affiliate, and leaves dashboard metrics at zero.
`npx playwright install chromium` is safe to rerun and prevents generated storefront validation from failing before launch because the local Chromium/headless-shell binary is missing.

## Start The App

Prefer:

```bash
npm run dev
```

If port 3000 is occupied, use the port Next reports or run:

```bash
npm run dev -- -p 3002
```

Atelier generation must use the real Codex CLI. Start the app with any inherited mock flag removed:

```bash
env -u CODEX_MOCK npm run dev -- -p 3002
```

## Verification

Run focused checks before handing control back:

```bash
npx playwright install chromium
npm run typecheck
npm run lint
npm run test
BASE_URL=http://localhost:3002 npm run test:e2e
```

After any test suite that writes orders, run `npm run demo:reset` again before asking the user to test.
