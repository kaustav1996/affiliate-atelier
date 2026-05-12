import { LedgerKind, OrderKind } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

export type AffiliateMetrics = {
  totalSalesInCents: number;
  totalCommissionInCents: number;
  liveOrderCount: number;
  trend: Array<{
    label: string;
    salesInCents: number;
    commissionInCents: number;
  }>;
  recentOrders: Array<{
    id: string;
    email: string;
    totalAmountInCents: number;
    commissionInCents: number;
    createdAt: string;
  }>;
};

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export async function getAffiliateLiveMetrics(affiliateId: string): Promise<AffiliateMetrics> {
  const [orderAggregate, ledgerAggregate, recentOrders, trendOrders] = await Promise.all([
    prisma.order.aggregate({
      where: { affiliateId, kind: OrderKind.LIVE },
      _count: { _all: true },
      _sum: { totalAmountInCents: true },
    }),
    prisma.commissionLedgerEntry.aggregate({
      where: { affiliateId, kind: LedgerKind.LIVE },
      _sum: { amountInCents: true },
    }),
    prisma.order.findMany({
      where: { affiliateId, kind: OrderKind.LIVE },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        email: true,
        totalAmountInCents: true,
        commissionInCents: true,
        createdAt: true,
      },
    }),
    prisma.order.findMany({
      where: {
        affiliateId,
        kind: OrderKind.LIVE,
        createdAt: {
          gte: new Date(Date.now() - 1000 * 60 * 60 * 24 * 13),
        },
      },
      orderBy: { createdAt: "asc" },
      select: {
        createdAt: true,
        totalAmountInCents: true,
        commissionInCents: true,
      },
    }),
  ]);

  const buckets = new Map<string, { salesInCents: number; commissionInCents: number }>();

  for (let index = 13; index >= 0; index -= 1) {
    const date = new Date(Date.now() - 1000 * 60 * 60 * 24 * index);
    buckets.set(dayKey(date), { salesInCents: 0, commissionInCents: 0 });
  }

  for (const order of trendOrders) {
    const key = dayKey(order.createdAt);
    const bucket = buckets.get(key);

    if (bucket) {
      bucket.salesInCents += order.totalAmountInCents;
      bucket.commissionInCents += order.commissionInCents;
    }
  }

  return {
    totalSalesInCents: orderAggregate._sum.totalAmountInCents || 0,
    totalCommissionInCents: ledgerAggregate._sum.amountInCents || 0,
    liveOrderCount: orderAggregate._count._all,
    trend: Array.from(buckets.entries()).map(([label, value]) => ({ label: label.slice(5), ...value })),
    recentOrders: recentOrders.map((order) => ({
      ...order,
      createdAt: order.createdAt.toISOString(),
    })),
  };
}

export async function getValidationRunDetails(id: string) {
  return prisma.validationRun.findUnique({
    where: { id },
    include: {
      orders: {
        where: { kind: OrderKind.VALIDATION },
        include: { ledgerEntries: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });
}
