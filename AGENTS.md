# ScentForge Atelier Agent Guide

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Project Shape

ScentForge Atelier is a local Next.js App Router demo for perfume affiliate commerce. The core app is stable; Codex-generated affiliate storefront files must stay inside `generated/affiliates/[slug]/draft` or `generated/affiliates/[slug]/published`.

Use these docs before substantial edits:

- `README.md` for setup, demo script, Codex CLI integration, and validation isolation
- `PRODUCT.md` for audience and product promise
- `DESIGN.md` and `.impeccable.md` for Impeccable-style design context

## Local Skills Available

Two repo-local skills live under `.codex/skills/`:

- `scentforge-add-product`: use when adding/replacing perfume products. It covers image generation, project-local product assets, DB upsert through `npm run product:upsert`, seed updates for first-run local data, storefront verification, and clean demo reset.
- `scentforge-run-local`: use when starting or resetting the local app. It covers Docker Postgres, Prisma migration/seed, dev server, and verification commands.

The `.codex/hooks/session_banner.sh` SessionStart hook prints these skill names when a new Codex session starts.

The Impeccable skill from `pbakaus/impeccable` is installed under `.agents/skills/impeccable`; use it for redesign, polish, audit, layout, typography, and live UI iteration.

## Git Workflow

Remote: `git@github.com:kaustav1996/affiliate-atelier.git`.

- The current baseline should live on `main`.
- After this baseline, create a new branch for every change, commit there, and push the branch. Do not push future feature work straight to `main` unless the user explicitly asks.
- Never commit or push affiliate-generated storefront output under `generated/affiliates/**`. Those files are runtime artifacts only.
- Product seed data and product images under `public/products/` are allowed to be committed as local demo seed assets.

## Clean Demo Rule

Before asking the user to test, run:

```bash
npm run demo:reset
```

This removes generated storefront artifacts, resets the database, reseeds the demo affiliate/products, and leaves live sales/commission at zero. Do not hand the app back with test-created orders or seeded commission data.

## Commands

```bash
npm run typecheck
npm run lint
npm run test
npm run build
BASE_URL=http://localhost:3002 npm run test:e2e
```

For local demo work:

```bash
env -u CODEX_MOCK npm run dev -- -p 3002
```

Do not use `CODEX_MOCK`. Atelier generation and validation repair must invoke the real Codex CLI.

## Validation Integrity

- LIVE orders and LIVE ledger entries are the only source for dashboard sales, commission, order count, trend chart, and recent orders.
- VALIDATION orders are persisted and visible through validation runs, but must never affect live metrics.
- Generated storefront validation must use the real preview UI and checkout API; do not fake success by writing orders directly.

If generated validation fails, the app should invoke Codex CLI again with the failure logs to repair only the draft generated package, then rerun validation once.

## Design

The visual direction uses Impeccable-style thinking: premium fragrance commerce, editorial luxury, atelier/workshop metaphor, warm ivory, ink, forest, moss, amber, rose, and smoke. Avoid generic purple AI SaaS styling, crypto dashboards, bland Shopify clones, and heavy glassmorphism.
