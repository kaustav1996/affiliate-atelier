import type { Product } from "@/generated/prisma/client";
import type { ProductView } from "@/lib/storefront-contract";

export const seedProducts = [
  {
    slug: "nocturne-chai",
    name: "Nocturne Chai",
    scentFamily: "Spice / Amber",
    priceInCents: 490000,
    commissionRate: 0.1,
    description: "Black tea, cardamom, saffron threads, and warm amber over polished woods.",
    imageUrl: "/products/nocturne-chai.png",
    gradient: "amber",
  },
  {
    slug: "monsoon-vetiver",
    name: "Monsoon Vetiver",
    scentFamily: "Green / Aquatic",
    priceInCents: 440000,
    commissionRate: 0.1,
    description: "Wet vetiver, green tea, iris petals, and rain cooling black stone.",
    imageUrl: "/products/monsoon-vetiver.png",
    gradient: "rain",
  },
  {
    slug: "petrichor-terra",
    name: "Petrichor Terra",
    scentFamily: "Earth / Aquatic",
    priceInCents: 460000,
    commissionRate: 0.1,
    description: "First rain on warm loam, mineral moss, violet leaf, and damp cedar root.",
    imageUrl: "/products/petrichor-terra.png",
    gradient: "rain",
  },
  {
    slug: "rose-ember",
    name: "Rose Ember",
    scentFamily: "Floral / Amber",
    priceInCents: 420000,
    commissionRate: 0.1,
    description: "Damask rose, pink pepper, smoked vanilla, and glowing amber resin.",
    imageUrl: "/products/rose-ember.png",
    gradient: "rose",
  },
];

export function toProductView(product: Product): ProductView {
  return {
    id: product.id,
    slug: product.slug || slugifyProductName(product.name),
    name: product.name,
    description: product.description,
    priceInCents: product.priceInCents,
    scentFamily: product.scentFamily,
    commissionRate: Number.isFinite(product.commissionRate) ? product.commissionRate : 0.1,
    imageUrl: product.imageUrl,
    gradient: product.gradient,
  };
}

function slugifyProductName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
