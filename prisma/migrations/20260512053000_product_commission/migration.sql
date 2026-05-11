ALTER TABLE "Product" ADD COLUMN "slug" TEXT;
ALTER TABLE "Product" ADD COLUMN "commissionRate" DOUBLE PRECISION NOT NULL DEFAULT 0.10;

UPDATE "Product"
SET "slug" = regexp_replace(lower("name"), '[^a-z0-9]+', '-', 'g')
WHERE "slug" IS NULL;

ALTER TABLE "Product" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");
CREATE INDEX "Product_slug_idx" ON "Product"("slug");
