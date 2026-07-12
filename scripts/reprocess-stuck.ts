import { prisma } from "../src/lib/db";
import { processJobInline } from "../src/lib/jobs/handlers";

async function main() {
  const stuck = await prisma.content.findMany({
    where: { status: "PROCESSING" },
    select: { id: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  if (stuck.length === 0) {
    console.log("No PROCESSING contents found.");
    return;
  }

  console.log(`Reprocessing ${stuck.length} content(s)...`);

  for (const { id } of stuck) {
    try {
      await processJobInline("process_image", { contentId: id });
      const updated = await prisma.content.findUnique({
        where: { id },
        select: { status: true },
      });
      console.log(`- ${id}: ${updated?.status ?? "unknown"}`);
    } catch (error) {
      console.error(`- ${id}: failed`, error);
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
