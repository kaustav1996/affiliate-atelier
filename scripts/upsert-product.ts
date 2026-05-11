import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

type ProductArgs = {
  slug: string;
  name: string;
  description: string;
  scentFamily: string;
  priceInCents: number;
  commissionRate: number;
  imageUrl?: string;
  gradient?: string;
};

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required to upsert a product.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

function readArgs(argv: string[]): ProductArgs {
  const values = new Map<string, string>();

  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];

    if (!key?.startsWith("--") || !value) {
      throw new Error(`Invalid argument near "${key || ""}". Use --key value pairs.`);
    }

    values.set(key.slice(2), value);
  }

  const required = ["slug", "name", "description", "scent-family", "price-cents"] as const;
  for (const key of required) {
    if (!values.get(key)) {
      throw new Error(`Missing required argument --${key}.`);
    }
  }

  const priceInCents = Number(values.get("price-cents"));
  const commissionRate = Number(values.get("commission-rate") || "0.1");

  if (!Number.isInteger(priceInCents) || priceInCents <= 0) {
    throw new Error("--price-cents must be a positive integer.");
  }

  if (!Number.isFinite(commissionRate) || commissionRate < 0 || commissionRate > 1) {
    throw new Error("--commission-rate must be between 0 and 1.");
  }

  return {
    slug: values.get("slug")!,
    name: values.get("name")!,
    description: values.get("description")!,
    scentFamily: values.get("scent-family")!,
    priceInCents,
    commissionRate,
    imageUrl: values.get("image-url"),
    gradient: values.get("gradient"),
  };
}

async function main() {
  const product = readArgs(process.argv.slice(2));
  const saved = await prisma.product.upsert({
    where: { slug: product.slug },
    update: product,
    create: product,
  });

  console.log(`Upserted product ${saved.name} (${saved.slug}) with ${Math.round(saved.commissionRate * 100)}% commission.`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
