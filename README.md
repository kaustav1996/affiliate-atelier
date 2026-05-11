# ScentForge Atelier

ScentForge Atelier is a complete local demo for a fictional perfume affiliate marketplace. Customers can buy perfume through a mock checkout, affiliates can log in and see LIVE sales/commission metrics, and the Atelier can generate a custom storefront through `codex exec`, validate it with Playwright, and publish only after tests pass.

## Stack

- Next.js App Router, TypeScript, Tailwind CSS
- Prisma 7 with PostgreSQL through Docker Compose
- Cookie-based credentials auth
- Vitest for business-rule tests
- Playwright for public, affiliate, and generated-storefront flows
- `execa` for server-side Codex CLI invocation

## Setup

```bash
npm install
cp .env.example .env
docker compose up -d postgres
npm run db:migrate -- --name init
npm run db:seed
npm run dev
```

Docker maps Postgres to local port `5433` to avoid collisions with a local Postgres on `5432`.

Demo affiliate:

```text
demo@scentforge.test
password123
```

## Scripts

```bash
npm run dev
npm run build
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run test:generated
npm run db:migrate
npm run db:seed
npm run demo:reset
npm run demo:start
npm run local:start
npm run product:upsert
```

`demo:reset` removes generated storefront artifacts, resets the database, and reseeds the demo affiliate/products. It does not seed transactions or commission, so the affiliate dashboard starts at zero before user testing.

Seeded products are real database rows. Each product includes a slug, product image URL, description, price, scent family, and `commissionRate`; the demo products are seeded at 10% commission.

## Codex CLI Integration

The server module `src/lib/codex/run-codex.ts` exposes `generateAffiliateStorefront({ slug, prompt })`.

It writes an auditable prompt to `generated/affiliates/[slug]/draft-prompt.md`, then invokes:

```bash
codex exec --sandbox workspace-write --ask-for-approval never "<strict prompt>"
```

The prompt instructs Codex to create or edit files only inside:

```text
generated/affiliates/[slug]/draft
```

Generated packages include `Storefront.tsx`, component files, `storefront.css`, `manifest.json`, and `generated.test.tsx`. If the local `codex` command is missing, the Atelier shows a clear error. For automated tests, set:

```bash
CODEX_MOCK=1
```

Mock mode writes a deterministic multi-file storefront package without invoking Codex. Without `CODEX_MOCK=1`, the app invokes the real Codex CLI and writes the generated files under `generated/affiliates/[slug]/draft`.

If validation fails, `/api/atelier/run-tests` launches a second Codex CLI call with the Playwright failure logs and asks Codex to repair only the draft generated package. The route then reruns validation once. If the repair still fails, publish remains disabled and the combined failure/repair logs are shown in the Atelier console.

## Generated Storefront Rendering

The app keeps the core platform stable. Generated React files are stored as artifacts, while the runtime preview reads `manifest.json` and renders through the platform commerce shell. This keeps checkout, attribution, and validation controlled while still demonstrating a multi-file generated package boundary.

Drafts live in:

```text
generated/affiliates/[slug]/draft
```

Published packages are copied to:

```text
generated/affiliates/[slug]/published
```

## Validation Order Isolation

Checkout accepts an optional `validationRunId`.

- No `validationRunId` creates a `LIVE` order and LIVE ledger entry.
- A valid `validationRunId` creates a `VALIDATION` order and validation ledger entry.
- Dashboard metrics query only `LIVE` orders/ledger entries.
- Validation orders remain visible through `/api/validation-runs/[id]`.

The generated storefront validation test opens the real preview URL, adds a product, checks out through the real UI/API, verifies validation commission, then confirms live commission and live order count are unchanged.

## Testing

Start the app before Playwright tests:

```bash
npm run dev
BASE_URL=http://localhost:3000 npm run test:e2e
```

For generated validation, the Atelier route creates the validation run and launches `tests/generated-storefront.spec.ts` with the required env vars. To run it manually, create a RUNNING validation run and provide:

```bash
AFFILIATE_SLUG=demo VALIDATION_RUN_ID=<id> BASE_URL=http://localhost:3000 npm run test:generated
```

After any browser or unit test that writes orders, run:

```bash
npm run demo:reset
```

before handing the app to someone else for manual testing.

## Repo-Local Skills

This repo includes two Codex skills under `.codex/skills/`:

- `scentforge-add-product`: add a perfume with image generation, project-local image assets, direct DB upsert through `npm run product:upsert`, seed data updates, and verification.
- `scentforge-run-local`: reset/start the local app with Docker Postgres, Prisma, clean demo data, and test commands.

The `.codex/hooks/session_banner.sh` SessionStart hook announces these skills to new Codex sessions.

The Impeccable skill from `pbakaus/impeccable` is installed under `.agents/skills/impeccable` for redesign, polish, audit, and layout work.

## Git Notes

Generated affiliate storefront files live under `generated/affiliates/**` and are ignored by git. Commit product seed data and product images, but do not commit generated affiliate drafts or published runtime artifacts.

## Five-Minute Demo Script

1. Open `/` and show the fragrance storefront.
2. Add a perfume to cart, open checkout, and complete mock payment.
3. Log in as the demo affiliate.
4. Show `/dashboard`: referral link, LIVE sales, LIVE commission, trend, and recent orders.
5. Open `/a/demo`, purchase a product, and return to dashboard to show LIVE commission changed.
6. Open `/dashboard/atelier`.
7. Enter a design prompt and click Generate with Codex.
8. Show generated files and the draft preview.
9. Run validation tests.
10. Show “Generated storefront passed validation,” validation checkout completed, commission verified, and live dashboard unchanged.
11. Click Publish.
12. Open `/a/demo` and show the generated storefront is now live.

## How It Was Built

The app combines a stable Next.js commerce platform with constrained generated storefront artifacts. Prisma/Postgres persists users, affiliates, products, orders, validation runs, and commission ledger entries. Cookie auth protects dashboard and Atelier routes. Codex is invoked only server-side with `execa` and a strict file-boundary prompt. Playwright validates generated storefronts by using the same checkout UI/API as customers, while metrics code filters strictly to LIVE business data.
