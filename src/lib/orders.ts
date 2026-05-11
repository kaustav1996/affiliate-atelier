import { LedgerKind, OrderKind, ValidationStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

export type CheckoutInput = {
  email: string;
  address: string;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
  affiliateSlug?: string | null;
  validationRunId?: string | null;
};

export async function createCheckoutOrder(input: CheckoutInput) {
  const normalizedItems = input.items
    .map((item) => ({
      productId: item.productId,
      quantity: Math.max(1, Math.min(9, Math.floor(item.quantity || 1))),
    }))
    .filter((item) => item.productId);

  if (!input.email.includes("@")) {
    throw new Error("Enter a valid email address.");
  }

  if (input.address.trim().length < 8) {
    throw new Error("Enter a delivery address.");
  }

  if (normalizedItems.length === 0) {
    throw new Error("Your cart is empty.");
  }

  return prisma.$transaction(async (tx) => {
    const products = await tx.product.findMany({
      where: { id: { in: normalizedItems.map((item) => item.productId) } },
    });
    const productMap = new Map(products.map((product) => [product.id, product]));

    if (products.length !== new Set(normalizedItems.map((item) => item.productId)).size) {
      throw new Error("One or more products are unavailable.");
    }

    let affiliate:
      | {
          id: string;
          slug: string;
          commissionRate: number;
        }
      | null = null;
    let kind: OrderKind = OrderKind.LIVE;
    let validationRunId: string | null = null;

    if (input.validationRunId) {
      const run = await tx.validationRun.findUnique({
        where: { id: input.validationRunId },
        include: { affiliate: true },
      });

      if (!run || run.status !== ValidationStatus.RUNNING) {
        throw new Error("Validation run is not active.");
      }

      if (input.affiliateSlug && run.affiliate.slug !== input.affiliateSlug) {
        throw new Error("Validation run does not belong to this affiliate.");
      }

      affiliate = run.affiliate;
      kind = OrderKind.VALIDATION;
      validationRunId = run.id;
    } else if (input.affiliateSlug) {
      affiliate = await tx.affiliate.findUnique({
        where: { slug: input.affiliateSlug },
        select: { id: true, slug: true, commissionRate: true },
      });
    }

    const totalAmountInCents = normalizedItems.reduce((sum, item) => {
      const product = productMap.get(item.productId);
      return sum + (product?.priceInCents || 0) * item.quantity;
    }, 0);
    const commissionInCents = affiliate
      ? normalizedItems.reduce((sum, item) => {
          const product = productMap.get(item.productId);
          if (!product) {
            return sum;
          }

          const commissionRate = Number.isFinite(product.commissionRate)
            ? product.commissionRate
            : affiliate.commissionRate;

          return sum + Math.round(product.priceInCents * item.quantity * commissionRate);
        }, 0)
      : 0;

    const order = await tx.order.create({
      data: {
        kind,
        email: input.email.trim().toLowerCase(),
        address: input.address.trim(),
        totalAmountInCents,
        commissionInCents,
        affiliateId: affiliate?.id,
        validationRunId,
        items: {
          create: normalizedItems.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            priceInCents: productMap.get(item.productId)!.priceInCents,
          })),
        },
      },
      include: {
        items: true,
      },
    });

    if (affiliate && commissionInCents > 0) {
      await tx.commissionLedgerEntry.create({
        data: {
          affiliateId: affiliate.id,
          orderId: order.id,
          amountInCents: commissionInCents,
          kind: kind === OrderKind.LIVE ? LedgerKind.LIVE : LedgerKind.VALIDATION,
          validationRunId,
        },
      });
    }

    return {
      id: order.id,
      kind: order.kind,
      totalAmountInCents: order.totalAmountInCents,
      commissionInCents: order.commissionInCents,
      affiliateSlug: affiliate?.slug,
    };
  });
}
