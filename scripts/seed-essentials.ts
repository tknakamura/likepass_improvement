import { PrismaClient } from "@prisma/client";
import { seedEssentials } from "@/lib/seed/essentials";

const prisma = new PrismaClient();

async function main() {
  const count = await seedEssentials(prisma);
  console.log(`Seeded ${count} tags and default app config`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
