import sharp from "sharp";
import { prisma } from "@/lib/db";
import { getImageAnalysisProvider } from "@/lib/ai/image-analysis";
import { GENERIC_TAG_SLUGS, MAX_AI_TAGS, normalizeTagSlug } from "@/lib/ai/image-analysis-schema";
import { getObjectBuffer, putObject } from "@/lib/r2";
import { readLocalImage, saveLocalImage, isR2Configured } from "@/lib/local-images";
import { recalculateTagRanking } from "@/server/services/content/aggregates";
import { markNpcReviewFailed, runNpcReview } from "@/server/services/npc/review";
import { NPC_REVIEW_JOB_OPTIONS, PROCESS_IMAGE_JOB_OPTIONS } from "@/lib/jobs";
import type { TagCategory } from "@prisma/client";
import type PgBoss from "pg-boss";

const CATEGORY_MAP: Record<string, TagCategory> = {
  SUBJECT: "SUBJECT",
  SCENE: "SCENE",
  STYLE: "STYLE",
  ATTRIBUTE: "ATTRIBUTE",
  LOCATION: "LOCATION",
};

async function markContentReviewRequired(contentId: string, reason: string) {
  await prisma.content.update({
    where: { id: contentId },
    data: {
      status: "REVIEW_REQUIRED",
      publishedAt: null,
      aiSafetyStatus: "REVIEW_REQUIRED",
    },
  });
  console.error(`[process_image] ${contentId} held as REVIEW_REQUIRED (${reason})`);
}

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
          `[process_image] Original not found (${content.originalObjectKey}); using placeholder`,
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
  const large = await sharp(buffer)
    .rotate()
    .resize(1920, 1920, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer();
  const medium = await sharp(buffer)
    .rotate()
    .resize(800, 800, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
  const thumbnail = await sharp(buffer)
    .rotate()
    .resize(200, 200, { fit: "cover" })
    .webp({ quality: 75 })
    .toBuffer();

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

  const alreadyPublished = ["EXPLORING", "ACTIVE", "DORMANT"].includes(content.status);
  let status: "NPC_REVIEWING" | "REVIEW_REQUIRED" | "REJECTED" | "EXPLORING" | "ACTIVE" | "DORMANT" =
    "NPC_REVIEWING";
  if (analysis.safety.status === "REJECTED") {
    status = "REJECTED";
  } else if (analysis.safety.status === "REVIEW_REQUIRED") {
    status = "REVIEW_REQUIRED";
  } else if (alreadyPublished) {
    // Retag / reprocess must not unpublish already-live content (including legacy posts).
    status = content.status as "EXPLORING" | "ACTIVE" | "DORMANT";
  }

  const needsNpcReview = status === "NPC_REVIEWING";

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
      publishedAt: needsNpcReview
        ? null
        : content.publishedAt ?? (alreadyPublished ? new Date() : null),
    },
  });

  // Replace prior AI tags so reprocessing does not leave stale generic tags.
  await prisma.contentTag.deleteMany({
    where: { contentId, source: "AI" },
  });

  const tagReady = status !== "REJECTED" && status !== "REVIEW_REQUIRED";
  for (const tag of analysis.tags.slice(0, MAX_AI_TAGS)) {
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
        status: tagReady ? "PENDING" : "REMOVED",
      },
      update: {
        source: "AI",
        confidence: tag.confidence,
        status: tagReady ? "PENDING" : "REMOVED",
      },
    });
  }

  if (needsNpcReview) {
    const { enqueueJob } = await import("@/lib/jobs");
    await enqueueJob("npc_review_image", { contentId });
  } else if (alreadyPublished) {
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
    case "npc_review_image":
      await runNpcReview(data.contentId as string);
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
  await b!.work(
    "process_image",
    { includeMetadata: true },
    async (jobs) => {
      const job = Array.isArray(jobs) ? jobs[0] : jobs;
      if (!job) return;
      const contentId = (job.data as { contentId: string }).contentId;
      try {
        await processImage(contentId);
      } catch (error) {
        console.error(`[process_image] ${contentId} failed`, error);
        if (job.retryCount >= job.retryLimit) {
          const reason = error instanceof Error ? error.message : "unknown_error";
          await markContentReviewRequired(contentId, reason);
        }
        throw error;
      }
    },
  );

  await b!.work(
    "npc_review_image",
    { includeMetadata: true },
    async (jobs) => {
      const job = Array.isArray(jobs) ? jobs[0] : jobs;
      if (!job) return;
      const contentId = (job.data as { contentId: string }).contentId;
      try {
        await runNpcReview(contentId);
      } catch (error) {
        console.error(`[npc_review_image] ${contentId} failed`, error);
        if (job.retryCount >= job.retryLimit) {
          const reason = error instanceof Error ? error.message : "unknown_error";
          await markNpcReviewFailed(contentId, reason);
        }
        throw error;
      }
    },
  );

  await b!.work("recalculate_ranking", async (jobs) => {
    const job = Array.isArray(jobs) ? jobs[0] : jobs;
    if (!job) return;
    const data = job.data as { tagId?: string };
    if (data.tagId) await recalculateTagRanking(data.tagId);
    else await recalculateAllRankings();
  });

  await b!.schedule("recalculate_ranking", "*/15 * * * *", {}, { tz: "UTC" });

  await requeuePendingImages(b!);
  await requeuePendingNpcReviews(b!);
  await requeueEnvContentIds(b!);

  console.log("LIKEPASS worker started");
}

function parseReprocessContentIds(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return [...new Set(raw.split(",").map((id) => id.trim()).filter(Boolean))];
}

async function requeueEnvContentIds(boss: PgBoss) {
  const ids = parseReprocessContentIds(process.env.REPROCESS_CONTENT_IDS);
  if (ids.length === 0) return;

  for (const id of ids) {
    await boss.send("process_image", { contentId: id }, PROCESS_IMAGE_JOB_OPTIONS);
  }

  console.log(`Requeued ${ids.length} content(s) from REPROCESS_CONTENT_IDS`);
}

async function findGenericTaggedContentIds(limit = 50): Promise<string[]> {
  const candidates = await prisma.content.findMany({
    where: {
      status: { in: ["EXPLORING", "ACTIVE"] },
      contentTags: { some: { source: "AI" } },
    },
    select: {
      id: true,
      contentTags: {
        where: { source: "AI" },
        select: { tag: { select: { slug: true } } },
      },
    },
    orderBy: { createdAt: "asc" },
    take: 100,
  });

  return candidates
    .filter((content) => {
      const slugs = content.contentTags.map((ct) => ct.tag.slug);
      return slugs.length > 0 && slugs.every((slug) => GENERIC_TAG_SLUGS.has(slug));
    })
    .slice(0, limit)
    .map((content) => content.id);
}

async function requeuePendingImages(boss: PgBoss) {
  // Only PROCESSING — REVIEW_REQUIRED requires manual reprocess to avoid infinite loops.
  const pending = await prisma.content.findMany({
    where: { status: "PROCESSING" },
    select: { id: true },
    orderBy: { createdAt: "asc" },
    take: 50,
  });

  const genericTaggedIds = await findGenericTaggedContentIds(50);
  const ids = [...new Set([...pending.map((p) => p.id), ...genericTaggedIds])];

  for (const id of ids) {
    await boss.send("process_image", { contentId: id }, PROCESS_IMAGE_JOB_OPTIONS);
  }

  if (pending.length > 0) {
    console.log(`Requeued ${pending.length} pending image job(s)`);
  }
  if (genericTaggedIds.length > 0) {
    console.log(`Requeued ${genericTaggedIds.length} generic-AI-tagged content(s) for retagging`);
  }
}

async function requeuePendingNpcReviews(boss: PgBoss) {
  const pending = await prisma.content.findMany({
    where: { status: "NPC_REVIEWING", aiSafetyStatus: "SAFE" },
    select: { id: true },
    orderBy: { createdAt: "asc" },
    take: 50,
  });

  for (const { id } of pending) {
    await boss.send("npc_review_image", { contentId: id }, NPC_REVIEW_JOB_OPTIONS);
  }

  if (pending.length > 0) {
    console.log(`Requeued ${pending.length} pending NPC review job(s)`);
  }
}
