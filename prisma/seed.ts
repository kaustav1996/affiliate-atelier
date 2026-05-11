import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { hashPassword } from "../src/lib/auth/password";
import { seedProducts } from "../src/lib/products";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required for seeding.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  await prisma.commissionLedgerEntry.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.validationRun.deleteMany();
  await prisma.product.deleteMany();
  await prisma.affiliate.deleteMany();
  await prisma.user.deleteMany();

  await prisma.product.createMany({
    data: seedProducts,
  });

  const user = await prisma.user.create({
    data: {
      email: "demo@scentforge.test",
      name: "Demo Atelier",
      passwordHash: hashPassword("password123"),
      affiliate: {
        create: {
          slug: "demo",
          commissionRate: 0.1,
          atelierPrompt:
            "Create a cinematic black-and-gold luxury perfume boutique inspired by Paris at midnight.",
        },
      },
    },
    include: { affiliate: true },
  });

  console.log(`Seeded ${user.email} with a clean affiliate dashboard and ${seedProducts.length} image-backed products.`);
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
