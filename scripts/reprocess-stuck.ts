import { prisma } from "../src/lib/db";
import { processJobInline } from "../src/lib/jobs/handlers";
import { GENERIC_TAG_SLUGS } from "../src/lib/ai/image-analysis-schema";

function parseIdsArg(argv: string[]): string[] {
  const idsFlag = argv.findIndex((arg) => arg === "--ids");
  if (idsFlag >= 0 && argv[idsFlag + 1]) {
    return argv[idsFlag + 1]
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
  }
  return [];
}

async function findGenericTaggedContents() {
  const candidates = await prisma.content.findMany({
    where: {
      status: { in: ["EXPLORING", "ACTIVE", "REVIEW_REQUIRED"] },
      contentTags: { some: { source: "AI" } },
    },
    select: {
      id: true,
      status: true,
      createdAt: true,
      contentTags: {
        where: { source: "AI" },
        select: { tag: { select: { slug: true } } },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return candidates.filter((content) => {
    const slugs = content.contentTags.map((ct) => ct.tag.slug);
    return slugs.length > 0 && slugs.every((slug) => GENERIC_TAG_SLUGS.has(slug));
  });
}

async function main() {
  const explicitIds = parseIdsArg(process.argv.slice(2));
  const includeGeneric = process.argv.includes("--include-generic-tags") || explicitIds.length === 0;

  const stuck = await prisma.content.findMany({
    where: { status: { in: ["PROCESSING", "REVIEW_REQUIRED"] } },
    select: { id: true, status: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const byId = new Map(stuck.map((item) => [item.id, item]));

  if (explicitIds.length > 0) {
    for (const id of explicitIds) {
      if (!byId.has(id)) {
        const content = await prisma.content.findUnique({
          where: { id },
          select: { id: true, status: true, createdAt: true },
        });
        if (content) byId.set(id, content);
        else console.warn(`Content not found: ${id}`);
      }
    }
  }

  if (includeGeneric && explicitIds.length === 0) {
    const genericTagged = await findGenericTaggedContents();
    for (const content of genericTagged) {
      byId.set(content.id, {
        id: content.id,
        status: content.status,
        createdAt: content.createdAt,
      });
    }
  }

  const targets = [...byId.values()].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );

  if (targets.length === 0) {
    console.log("No PROCESSING, REVIEW_REQUIRED, or generic-AI-tagged contents found.");
    return;
  }

  console.log(`Reprocessing ${targets.length} content(s)...`);

  for (const { id, status } of targets) {
    try {
      await processJobInline("process_image", { contentId: id });
      const updated = await prisma.content.findUnique({
        where: { id },
        select: {
          status: true,
          contentTags: {
            where: { source: "AI" },
            select: { tag: { select: { slug: true } } },
          },
        },
      });
      const tags = updated?.contentTags.map((ct) => ct.tag.slug).join(", ") || "(none)";
      console.log(`- ${id} (${status} -> ${updated?.status ?? "unknown"}; tags: ${tags})`);
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
