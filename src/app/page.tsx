import { CommerceExperience } from "@/components/CommerceExperience";
import { getCurrentUser } from "@/lib/auth/current";
import { prisma } from "@/lib/prisma";
import { toProductView } from "@/lib/products";
import { toStorefrontViewer } from "@/lib/storefront-viewer";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [products, user] = await Promise.all([
    prisma.product.findMany({ orderBy: { name: "asc" } }),
    getCurrentUser(),
  ]);

  return <CommerceExperience products={products.map(toProductView)} viewer={toStorefrontViewer(user)} />;
}
