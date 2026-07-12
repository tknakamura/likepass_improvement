import sharp from "sharp";
import { prisma } from "@/lib/db";
import { getImageAnalysisProvider } from "@/lib/ai/image-analysis";
import { normalizeTagSlug } from "@/lib/ai/image-analysis-schema";
import { getObjectBuffer, putObject } from "@/lib/r2";
import { readLocalImage, saveLocalImage, isR2Configured } from "@/lib/local-images";
import { recalculateTagRanking } from "@/server/services/content/aggregates";
import type { TagCategory } from "@prisma/client";

const CATEGORY_MAP: Record<string, TagCategory> = {
  SUBJECT: "SUBJECT",
  SCENE: "SCENE",
  STYLE: "STYLE",
  ATTRIBUTE: "ATTRIBUTE",
  LOCATION: "LOCATION",
};

async function processImage(contentId: string) {
  const content = await prisma.content.findUnique({ where: { id: contentId } });
  if (!content) return;

  let buffer: Buffer;
  let imageSource: "r2" | "local" | "placeholder" = "placeholder";

  if (content.originalObjectKey) {
    const fetched = await getObjectBuffer(content.originalObjectKey);
    if (fetched) {
      buffer = fetched;
      imageSource = "r2";
    } else {
      const local = await readLocalImage(content.originalObjectKey);
      if (local) {
        buffer = local;
        imageSource = "local";
      } else {
        console.warn(
          `[process_image] Original not found (${content.originalObjectKey}); using placeholder`
        );
        buffer = await generatePlaceholder();
        imageSource = "placeholder";
      }
    }
  } else {
    console.warn(`[process_image] ${contentId} has no originalObjectKey; using placeholder`);
    buffer = await generatePlaceholder();
  }

  const metadata = await sharp(buffer).metadata();
  const large = await sharp(buffer).rotate().resize(1920, 1920, { fit: "inside", withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
  const medium = await sharp(buffer).rotate().resize(800, 800, { fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
  const thumbnail = await sharp(buffer).rotate().resize(200, 200, { fit: "cover" }).webp({ quality: 75 }).toBuffer();

  const largeKey = `processed/${contentId}/large.webp`;
  const mediumKey = `processed/${contentId}/medium.webp`;
  const thumbKey = `processed/${contentId}/thumbnail.webp`;

  try {
    if (isR2Configured()) {
      await putObject(largeKey, large, "image/webp");
      await putObject(mediumKey, medium, "image/webp");
      await putObject(thumbKey, thumbnail, "image/webp");
    } else {
      await saveLocalImage(largeKey, large);
      await saveLocalImage(mediumKey, medium);
      await saveLocalImage(thumbKey, thumbnail);
    }
  } catch {
    await saveLocalImage(largeKey, large);
    await saveLocalImage(mediumKey, medium);
    await saveLocalImage(thumbKey, thumbnail);
  }

  const knownTags = await prisma.tag.findMany({
    where: { status: "ACTIVE" },
    orderBy: { usageCount: "desc" },
    take: 50,
    select: { slug: true, category: true, displayName: true },
  });

  const provider = getImageAnalysisProvider();
  const analysis = await provider.analyze(buffer, content.mimeType ?? "image/jpeg", { knownTags });

  let status: "EXPLORING" | "REVIEW_REQUIRED" | "REJECTED" = "EXPLORING";
  if (analysis.safety.status === "REJECTED") {
    status = "REJECTED";
  }
  // MVP: no admin review workflow yet — publish unless explicitly rejected.

  await prisma.content.update({
    where: { id: contentId },
    data: {
      largeObjectKey: largeKey,
      mediumObjectKey: mediumKey,
      thumbnailObjectKey: thumbKey,
      width: metadata.width,
      height: metadata.height,
      aspectRatio: metadata.width && metadata.height ? metadata.width / metadata.height : null,
      aiQualityScore: analysis.quality.aesthetic,
      aiSafetyStatus: analysis.safety.status,
      status,
      publishedAt: status === "EXPLORING" ? new Date() : null,
    },
  });

  for (const tag of analysis.tags.slice(0, 5)) {
    const slug = normalizeTagSlug(tag.name);
    if (!slug) continue;
    const dbTag = await prisma.tag.upsert({
      where: { slug },
      create: {
        slug,
        displayName: tag.name,
        category: CATEGORY_MAP[tag.category] ?? "SUBJECT",
        usageCount: 1,
      },
      update: { usageCount: { increment: 1 } },
    });

    await prisma.contentTag.upsert({
      where: { contentId_tagId: { contentId, tagId: dbTag.id } },
      create: {
        contentId,
        tagId: dbTag.id,
        source: "AI",
        confidence: tag.confidence,
        status: status === "EXPLORING" ? "PENDING" : "REMOVED",
      },
      update: {},
    });
  }

  if (status === "EXPLORING") {
    const tags = await prisma.contentTag.findMany({ where: { contentId } });
    for (const ct of tags) {
      await recalculateTagRanking(ct.tagId);
    }
  }

  console.log(`[process_image] ${contentId} -> ${status} (image: ${imageSource}, tags: ${analysis.tags.length})`);
}

async function generatePlaceholder(): Promise<Buffer> {
  return sharp({
    create: {
      width: 800,
      height: 800,
      channels: 3,
      background: { r: 40, g: 40, b: 50 },
    },
  })
    .jpeg()
    .toBuffer();
}

async function recalculateAllRankings() {
  const tags = await prisma.tag.findMany({ where: { status: "ACTIVE" } });
  for (const tag of tags) {
    await recalculateTagRanking(tag.id);
  }
}

export async function processJobInline(name: string, data: Record<string, unknown>) {
  switch (name) {
    case "process_image":
      await processImage(data.contentId as string);
      break;
    case "recalculate_ranking":
      if (data.tagId) await recalculateTagRanking(data.tagId as string);
      else await recalculateAllRankings();
      break;
    default:
      break;
  }
}

export async function startWorker() {
  const boss = await import("@/lib/jobs").then((m) => m.getBoss());
  if (!boss) {
    console.log("pg-boss not available, worker idle");
    return;
  }

  const b = await boss;
  await b!.work("process_image", async (jobs) => {
    const job = Array.isArray(jobs) ? jobs[0] : jobs;
    if (!job) return;
    const contentId = (job.data as { contentId: string }).contentId;
    try {
      await processImage(contentId);
    } catch (error) {
      console.error(`[process_image] ${contentId} failed`, error);
      throw error;
    }
  });

  await b!.work("recalculate_ranking", async (jobs) => {
    const job = Array.isArray(jobs) ? jobs[0] : jobs;
    if (!job) return;
    const data = job.data as { tagId?: string };
    if (data.tagId) await recalculateTagRanking(data.tagId);
    else await recalculateAllRankings();
  });

  await b!.schedule("recalculate_ranking", "*/15 * * * *", {}, { tz: "UTC" });

  await requeuePendingImages(b!);

  console.log("LIKEPASS worker started");
}

async function requeuePendingImages(boss: Awaited<ReturnType<typeof import("@/lib/jobs").getBoss>>) {
  const pending = await prisma.content.findMany({
    where: { status: { in: ["PROCESSING", "REVIEW_REQUIRED"] } },
    select: { id: true },
    orderBy: { createdAt: "asc" },
    take: 50,
  });

  for (const { id } of pending) {
    await boss!.send("process_image", { contentId: id });
  }

  if (pending.length > 0) {
    console.log(`Requeued ${pending.length} pending image job(s)`);
  }
}
