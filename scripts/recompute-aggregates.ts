/**
 * Recomputes Content + ContentTag aggregates with photo-level vote rules
 * (the same totals are copied onto every attached tag for ranking).
 *
 * Usage:
 *   DATABASE_URL=... npx tsx scripts/recompute-aggregates.ts
 *   DATABASE_URL=... npx tsx scripts/recompute-aggregates.ts --content-id=<id>
 */
import { prisma } from "../src/lib/db";
import {
  recomputeVoteAggregates,
  recalculateTagRanking,
} from "../src/server/services/content/aggregates";

async function main() {
  const contentIdArg = process.argv.find((a) => a.startsWith("--content-id="))?.split("=")[1];

  const contents = contentIdArg
    ? await prisma.content.findMany({ where: { id: contentIdArg }, select: { id: true } })
    : await prisma.content.findMany({
        where: { status: { not: "DELETED" } },
        select: { id: true },
        orderBy: { createdAt: "asc" },
      });

  console.log(`[recompute-aggregates] processing ${contents.length} content rows`);

  let done = 0;
  for (const { id } of contents) {
    await recomputeVoteAggregates(id);
    done += 1;
    if (done % 25 === 0 || done === contents.length) {
      console.log(`[recompute-aggregates] ${done}/${contents.length}`);
    }
  }

  const tags = await prisma.tag.findMany({ select: { id: true, slug: true } });
  for (const tag of tags) {
    await recalculateTagRanking(tag.id);
    console.log(`[recompute-aggregates] ranking refreshed for #${tag.slug}`);
  }

  console.log("[recompute-aggregates] done");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
