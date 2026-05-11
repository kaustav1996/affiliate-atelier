import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toProductView } from "@/lib/products";

export async function GET() {
  const products = await prisma.product.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json({ products: products.map(toProductView) });
}
