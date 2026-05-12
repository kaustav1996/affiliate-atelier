import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { ValidationStatus } from "@/generated/prisma/enums";
import { hashPassword } from "@/lib/auth/password";
import { calculateCommission } from "@/lib/money";
import { getAffiliateLiveMetrics } from "@/lib/metrics";
import { createCheckoutOrder } from "@/lib/orders";
import { getPublishGate } from "@/lib/publish";
import { prisma } from "@/lib/prisma";

async function createFixture() {
  const suffix = randomUUID().slice(0, 8);
  const product = await prisma.product.findFirst({
    where: { priceInCents: 490000 },
    orderBy: { name: "asc" },
  });

  if (!product) {
    throw new Error("Seed products are required before running integration tests.");
  }
  const user = await prisma.user.create({
    data: {
      email: `spec-${suffix}@scentforge.test`,
      name: `Spec ${suffix}`,
      passwordHash: hashPassword("password123"),
      affiliate: {
        create: {
          slug: `spec-${suffix}`,
          commissionRate: 0.1,
        },
      },
    },
    include: { affiliate: true },
  });

  if (!user.affiliate) {
    throw new Error("Fixture affiliate was not created.");
  }

  return { user, affiliate: user.affiliate, product };
}

describe("ScentForge business rules", () => {
  it("calculates 10% commission on a 490000-cent order", () => {
    expect(calculateCommission(490000, 0.1)).toBe(49000);
  });

  it("keeps validation orders out of live dashboard metrics", async () => {
    const { affiliate, product } = await createFixture();
    const run = await prisma.validationRun.create({
      data: { affiliateId: affiliate.id, status: ValidationStatus.RUNNING },
    });

    await createCheckoutOrder({
      email: "live@example.test",
      address: "Live address, Mumbai",
      affiliateSlug: affiliate.slug,
      items: [{ productId: product.id, quantity: 1 }],
    });
    await createCheckoutOrder({
      email: "validation@example.test",
      address: "Validation address, Mumbai",
      affiliateSlug: affiliate.slug,
      validationRunId: run.id,
      items: [{ productId: product.id, quantity: 1 }],
    });

    const metrics = await getAffiliateLiveMetrics(affiliate.id);

    expect(metrics.liveOrderCount).toBe(1);
    expect(metrics.totalSalesInCents).toBe(490000);
    expect(metrics.totalCommissionInCents).toBe(49000);
  });

  it("uses validationRunId to create VALIDATION orders and no validationRunId to create LIVE orders", async () => {
    const { affiliate, product } = await createFixture();
    const run = await prisma.validationRun.create({
      data: { affiliateId: affiliate.id, status: ValidationStatus.RUNNING },
    });

    const validationOrder = await createCheckoutOrder({
      email: "validation-mode@example.test",
      address: "Validation flow address",
      affiliateSlug: affiliate.slug,
      validationRunId: run.id,
      items: [{ productId: product.id, quantity: 1 }],
    });
    const liveOrder = await createCheckoutOrder({
      email: "live-mode@example.test",
      address: "Live flow address",
      affiliateSlug: affiliate.slug,
      items: [{ productId: product.id, quantity: 1 }],
    });

    expect(validationOrder.kind).toBe("VALIDATION");
    expect(liveOrder.kind).toBe("LIVE");
  });

  it("blocks publish until the latest validation run passes", async () => {
    const { affiliate } = await createFixture();

    await expect(getPublishGate(affiliate.id)).resolves.toMatchObject({ canPublish: false });

    await prisma.validationRun.create({
      data: {
        affiliateId: affiliate.id,
        status: ValidationStatus.FAILED,
        failureReason: "Checkout button missing",
      },
    });
    await expect(getPublishGate(affiliate.id)).resolves.toMatchObject({ canPublish: false });

    await prisma.validationRun.create({
      data: {
        affiliateId: affiliate.id,
        status: ValidationStatus.PASSED,
      },
    });
    await expect(getPublishGate(affiliate.id)).resolves.toMatchObject({ canPublish: true });
  });

  it("requires validation after a newer draft is generated", async () => {
    const { affiliate } = await createFixture();
    await prisma.validationRun.create({
      data: {
        affiliateId: affiliate.id,
        status: ValidationStatus.PASSED,
        completedAt: new Date(Date.now() - 10_000),
      },
    });
    await prisma.affiliate.update({
      where: { id: affiliate.id },
      data: { draftGeneratedAt: new Date() },
    });

    await expect(getPublishGate(affiliate.id)).resolves.toMatchObject({ canPublish: false });
  });
});
