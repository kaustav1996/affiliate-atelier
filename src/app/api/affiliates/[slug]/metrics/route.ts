import { NextResponse } from "next/server";
import { getAffiliateLiveMetrics } from "@/lib/metrics";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const affiliate = await prisma.affiliate.findUnique({ where: { slug } });

  if (!affiliate) {
    return NextResponse.json({ error: "Affiliate not found." }, { status: 404 });
  }

  const metrics = await getAffiliateLiveMetrics(affiliate.id);
  return NextResponse.json({ metrics });
}
