import { prisma } from "@/lib/db";
import { getObjectBuffer } from "@/lib/r2";
import { readLocalImage } from "@/lib/local-images";
import { getNpcReviewProvider, NPC_REVIEW_PROMPT_VERSION } from "@/lib/ai/npc-review";
import { NPC_JUDGE_COUNT } from "@/lib/seed/data";
import { recomputeVoteAggregates, recalculateTagRanking } from "@/server/services/content/aggregates";
import type { NpcJudgeProfile } from "@/lib/ai/npc-review-schema";

async function loadActiveJudges(): Promise<NpcJudgeProfile[]> {
  const judges = await prisma.npcJudge.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
  });

  if (judges.length !== NPC_JUDGE_COUNT) {
    throw new Error(`Expected ${NPC_JUDGE_COUNT} active NPC judges, found ${judges.length}`);
  }

  return judges.map((j) => ({
    id: j.id,
    slug: j.slug,
    displayName: j.displayName,
    countryCode: j.countryCode,
    countryNameJa: j.countryNameJa,
    personaJa: j.personaJa,
    viewingLensJa: j.viewingLensJa,
    initials: j.initials,
    sortOrder: j.sortOrder,
  }));
}

async function loadImageBuffer(contentId: string): Promise<{ buffer: Buffer; mimeType: string }> {
  const content = await prisma.content.findUnique({ where: { id: contentId } });
  if (!content) throw new Error(`Content ${contentId} not found`);

  const key = content.mediumObjectKey ?? content.largeObjectKey ?? content.originalObjectKey;
  if (!key) throw new Error(`Content ${contentId} has no image key`);

  const fromR2 = await getObjectBuffer(key);
  const buffer = fromR2 ?? (await readLocalImage(key));
  if (!buffer) throw new Error(`Image not found for content ${contentId}`);

  return { buffer, mimeType: content.mimeType ?? "image/jpeg" };
}

/**
 * Runs the world NPC panel review, upserts all decisions atomically,
 * recomputes aggregates, and publishes to EXPLORING.
 */
export async function runNpcReview(contentId: string): Promise<void> {
  const content = await prisma.content.findUnique({ where: { id: contentId } });
  if (!content) return;

  const existingCount = await prisma.npcEvaluation.count({ where: { contentId } });
  if (
    existingCount >= NPC_JUDGE_COUNT &&
    ["EXPLORING", "ACTIVE", "DORMANT"].includes(content.status)
  ) {
    return;
  }

  if (content.status !== "NPC_REVIEWING") {
    return;
  }

  if (content.aiSafetyStatus !== "SAFE") {
    await markNpcReviewFailed(contentId, "unsafe_content");
    return;
  }

  const judges = await loadActiveJudges();
  const { buffer, mimeType } = await loadImageBuffer(contentId);
  const provider = getNpcReviewProvider();
  const result = await provider.review(buffer, mimeType, judges);

  await prisma.$transaction(async (tx) => {
    for (const decision of result.decisions) {
      await tx.npcEvaluation.upsert({
        where: {
          contentId_judgeId: { contentId, judgeId: decision.judgeId },
        },
        create: {
          contentId,
          judgeId: decision.judgeId,
          value: decision.value,
          commentJa: decision.commentJa,
          confidence: decision.confidence,
          modelName: result.modelName,
          promptVersion: result.promptVersion ?? NPC_REVIEW_PROMPT_VERSION,
        },
        update: {
          value: decision.value,
          commentJa: decision.commentJa,
          confidence: decision.confidence,
          modelName: result.modelName,
          promptVersion: result.promptVersion ?? NPC_REVIEW_PROMPT_VERSION,
        },
      });
    }

    const saved = await tx.npcEvaluation.count({ where: { contentId } });
    if (saved < NPC_JUDGE_COUNT) {
      throw new Error(`Incomplete NPC panel after save: ${saved}/${NPC_JUDGE_COUNT}`);
    }

    await tx.content.update({
      where: { id: contentId },
      data: {
        status: "EXPLORING",
        publishedAt: content.publishedAt ?? new Date(),
      },
    });

    await tx.contentTag.updateMany({
      where: { contentId, status: "REMOVED" },
      data: { status: "PENDING" },
    });

    await recomputeVoteAggregates(contentId, tx);
  });

  const tags = await prisma.contentTag.findMany({ where: { contentId }, select: { tagId: true } });
  for (const { tagId } of tags) {
    await recalculateTagRanking(tagId);
  }

  console.log(`[npc_review_image] ${contentId} -> EXPLORING (${result.decisions.length} judges)`);
}

export async function markNpcReviewFailed(contentId: string, reason: string) {
  await prisma.content.update({
    where: { id: contentId },
    data: {
      status: "REVIEW_REQUIRED",
      publishedAt: null,
    },
  });
  console.error(`[npc_review_image] ${contentId} held as REVIEW_REQUIRED (${reason})`);
}
