---
name: scentforge-add-product
description: Use when adding or replacing ScentForge perfume products. Generates a project-local product image asset, writes product details and commission to the database, updates seed products for first-run local data, removes placeholder/mock product visuals, resets the demo database, and verifies storefront/product tests.
---

# ScentForge Add Product

Use this for requests like "add a new perfume", "add product images", "replace mock products", or "seed more demo products".

## Workflow

1. Read `src/lib/products.ts`, `prisma/schema.prisma`, `prisma/seed.ts`, `scripts/upsert-product.ts`, and `src/components/CommerceExperience.tsx`.
2. Use the `imagegen` skill for each new catalog image.
   - Save final image copies under `public/products/<slug>.png`.
   - Keep the original generated image in `$CODEX_HOME/generated_images`.
   - Use premium perfume product-shot prompts aligned with `DESIGN.md` and `.impeccable.md`.
3. Update `seedProducts` in `src/lib/products.ts`.
   - Include `slug`, `name`, `scentFamily`, `priceInCents`, `commissionRate`, `description`, `imageUrl`, and a fallback `gradient`.
   - Use `commissionRate: 0.1` unless the user gives a different product-level commission.
   - Keep demo products intentional; do not leave test fixture products visible in seed data.
4. Push the product directly into the local database once the image exists:

   ```bash
   npm run product:upsert -- --slug <slug> --name "<name>" --description "<description>" --scent-family "<family>" --price-cents <amount> --commission-rate 0.1 --image-url "/products/<slug>.png" --gradient <token>
   ```

5. Ensure `CommerceExperience` renders `imageUrl` as a real product image and displays the product-level commission from the DB.
6. Run:
   - `npm run typecheck`
   - `npm run lint`
   - `npm run test`
   - `npm run build`
7. Run `npm run demo:reset` before asking the user to test so dashboards contain no mock transactions or seeded commission.

## Product Image Prompt Pattern

```text
Use case: product-mockup.
Asset type: ScentForge Atelier perfume catalog product image.
Create a premium editorial product photograph of a perfume bottle named <name>, inspired by <notes>.
Warm ivory / ink / forest / muted gold / rose / amber palette as appropriate.
Realistic glass bottle, luxury fragrance campaign styling, square composition, no readable text, no watermark.
```
