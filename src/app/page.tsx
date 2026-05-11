import { CommerceExperience } from "@/components/CommerceExperience";
import { prisma } from "@/lib/prisma";
import { toProductView } from "@/lib/products";

export const dynamic = "force-dynamic";

export default async function Home() {
  const products = await prisma.product.findMany({ orderBy: { name: "asc" } });

  return <CommerceExperience products={products.map(toProductView)} />;
}
