CREATE TYPE "OrderKind" AS ENUM ('LIVE', 'VALIDATION');
CREATE TYPE "ValidationStatus" AS ENUM ('RUNNING', 'PASSED', 'FAILED');
CREATE TYPE "LedgerKind" AS ENUM ('LIVE', 'VALIDATION');

CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Affiliate" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "commissionRate" DOUBLE PRECISION NOT NULL DEFAULT 0.10,
  "atelierPrompt" TEXT,
  "draftGeneratedAt" TIMESTAMP(3),
  "publishedAt" TIMESTAMP(3),
  "lastValidationRunId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Affiliate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Product" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "priceInCents" INTEGER NOT NULL,
  "scentFamily" TEXT NOT NULL,
  "imageUrl" TEXT,
  "gradient" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Order" (
  "id" TEXT NOT NULL,
  "kind" "OrderKind" NOT NULL,
  "email" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "totalAmountInCents" INTEGER NOT NULL,
  "commissionInCents" INTEGER NOT NULL,
  "affiliateId" TEXT,
  "validationRunId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrderItem" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "priceInCents" INTEGER NOT NULL,
  CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ValidationRun" (
  "id" TEXT NOT NULL,
  "affiliateId" TEXT NOT NULL,
  "status" "ValidationStatus" NOT NULL DEFAULT 'RUNNING',
  "prompt" TEXT,
  "logs" TEXT,
  "failureReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "ValidationRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommissionLedgerEntry" (
  "id" TEXT NOT NULL,
  "affiliateId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "amountInCents" INTEGER NOT NULL,
  "kind" "LedgerKind" NOT NULL,
  "validationRunId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommissionLedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "Affiliate_userId_key" ON "Affiliate"("userId");
CREATE UNIQUE INDEX "Affiliate_slug_key" ON "Affiliate"("slug");
CREATE INDEX "Affiliate_slug_idx" ON "Affiliate"("slug");
CREATE INDEX "Order_affiliateId_kind_createdAt_idx" ON "Order"("affiliateId", "kind", "createdAt");
CREATE INDEX "Order_validationRunId_idx" ON "Order"("validationRunId");
CREATE INDEX "ValidationRun_affiliateId_createdAt_idx" ON "ValidationRun"("affiliateId", "createdAt");
CREATE INDEX "CommissionLedgerEntry_affiliateId_kind_createdAt_idx" ON "CommissionLedgerEntry"("affiliateId", "kind", "createdAt");
CREATE INDEX "CommissionLedgerEntry_validationRunId_idx" ON "CommissionLedgerEntry"("validationRunId");

ALTER TABLE "Affiliate" ADD CONSTRAINT "Affiliate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_validationRunId_fkey" FOREIGN KEY ("validationRunId") REFERENCES "ValidationRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ValidationRun" ADD CONSTRAINT "ValidationRun_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommissionLedgerEntry" ADD CONSTRAINT "CommissionLedgerEntry_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommissionLedgerEntry" ADD CONSTRAINT "CommissionLedgerEntry_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
