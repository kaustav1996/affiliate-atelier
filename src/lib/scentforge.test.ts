import { randomUUID } from "node:crypto";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CommerceExperience } from "@/components/CommerceExperience";
import { ValidationStatus } from "@/generated/prisma/enums";
import { hashPassword } from "@/lib/auth/password";
import { buildCodexPrompt, codexExecArgs, determineGenerationMode } from "@/lib/codex/run-codex";
import { calculateCommission } from "@/lib/money";
import { getAffiliateLiveMetrics } from "@/lib/metrics";
import { createCheckoutOrder } from "@/lib/orders";
import { getPublishGate } from "@/lib/publish";
import { prisma } from "@/lib/prisma";
import { defaultManifest } from "@/lib/storefront-theme";

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
  it("uses the supported non-interactive Codex exec bypass flag", () => {
    expect(codexExecArgs()).toEqual([
      "exec",
      "--dangerously-bypass-approvals-and-sandbox",
      "--json",
      "-",
    ]);
    expect(codexExecArgs()).not.toContain("--ask-for-approval");
  });

  it("classifies narrow follow-up prompts as surgical revisions", () => {
    expect(determineGenerationMode("the Secure test checkout email and address is still dark", true)).toBe("surgical-revision");
    expect(determineGenerationMode("change design to go along with https://www.thedevilwearsprada.co.uk/", true)).toBe("design-revision");
    expect(determineGenerationMode("cyberpunk with led borders", false)).toBe("full-generation");
  });

  it("keeps surgical Codex prompts scoped to minimal diffs", () => {
    const prompt = buildCodexPrompt({
      slug: "demo",
      prompt: "the Secure test checkout email and address is still dark",
      mode: "surgical-revision",
    });

    expect(prompt).toContain("Surgical revision rules");
    expect(prompt).toContain("Preserve the existing manifest title");
    expect(prompt).toContain("Do not reinterpret the storefront aesthetic");
    expect(prompt).toContain("Do not assume edits to generated CheckoutExperience.tsx");
    expect(prompt).toContain("exit immediately with a short summary");
  });

  it("allows browser and network access for reference-driven design prompts", () => {
    const prompt = buildCodexPrompt({
      slug: "demo",
      prompt: "change design to go along with https://www.thedevilwearsprada.co.uk/",
      mode: "design-revision",
    });

    expect(prompt).toContain("use browser access to open it");
    expect(prompt).toContain("You may use network access");
    expect(prompt).not.toContain("Do not call external network APIs.");
  });

  it("renders manifest-driven floating bubbles for generated storefront effects", () => {
    const manifest = {
      ...defaultManifest("demo"),
      subcopy: "A neon perfume bar with glowing floating bubbles.",
      effects: ["floating-bubbles"],
    };

    const html = renderToStaticMarkup(
      createElement(CommerceExperience, {
        products: [],
        affiliateSlug: "demo",
        generated: true,
        manifest,
      }),
    );

    expect(html).toContain("effect-bubbles");
    expect(html).toContain("floating-bubbles");
  });

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
