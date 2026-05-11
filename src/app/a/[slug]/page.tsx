import { notFound } from "next/navigation";
import { CommerceExperience } from "@/components/CommerceExperience";
import { readGeneratedManifest } from "@/lib/generated-storefront";
import { prisma } from "@/lib/prisma";
import { toProductView } from "@/lib/products";

export const dynamic = "force-dynamic";

export default async function AffiliateStorefront({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const affiliate = await prisma.affiliate.findUnique({ where: { slug } });

  if (!affiliate) {
    notFound();
  }

  const [products, manifest] = await Promise.all([
    prisma.product.findMany({ orderBy: { name: "asc" } }),
    readGeneratedManifest(slug, "published"),
  ]);

  return (
    <CommerceExperience
      products={products.map(toProductView)}
      affiliateSlug={slug}
      generated={Boolean(manifest)}
      manifest={manifest}
    />
  );
}
