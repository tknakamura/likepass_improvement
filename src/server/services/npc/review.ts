import { prisma } from "@/lib/db";
import { getObjectBuffer } from "@/lib/r2";
import { readLocalImage } from "@/lib/local-images";
import { getNpcReviewProvider, NPC_REVIEW_PROMPT_VERSION } from "@/lib/ai/npc-review";
import { NPC_JUDGE_COUNT } from "@/lib/seed/data";
import { recomputeVoteAggregates, recalculateTagRanking } from "@/server/services/content/aggregates";
import type {
  NpcJudgeProfile,
  NpcReviewResult,
  NpcTagContext,
} from "@/lib/ai/npc-review-schema";

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
 * Runs the world NPC panel review per ContentTag, upserts all decisions,
 * recomputes aggregates, and publishes to EXPLORING when every tag×judge is saved.
 */
export async function runNpcReview(contentId: string): Promise<void> {
  const content = await prisma.content.findUnique({
    where: { id: contentId },
    include: {
      contentTags: {
        where: { status: { not: "REMOVED" } },
        include: { tag: true },
      },
    },
  });
  if (!content) return;

  const tags = content.contentTags;
  if (tags.length === 0) {
    await markNpcReviewFailed(contentId, "no_tags");
    return;
  }

  const expectedCount = NPC_JUDGE_COUNT * tags.length;
  const taggedEvalCount = await prisma.npcEvaluation.count({
    where: { contentId, tagId: { not: null } },
  });

  if (taggedEvalCount >= expectedCount) {
    return;
  }

  // Allow backfill for already-published posts that lack tag-scoped NPC votes.
  if (!["NPC_REVIEWING", "EXPLORING", "ACTIVE"].includes(content.status)) {
    return;
  }

  if (content.aiSafetyStatus !== "SAFE") {
    await markNpcReviewFailed(contentId, "unsafe_content");
    return;
  }

  const judges = await loadActiveJudges();
  const { buffer, mimeType } = await loadImageBuffer(contentId);
  const provider = getNpcReviewProvider();

  const tagContexts: NpcTagContext[] = tags.map((ct) => ({
    id: ct.tagId,
    slug: ct.tag.slug,
    displayName: ct.tag.displayName,
  }));

  const panelResults: Array<{ tag: NpcTagContext; result: NpcReviewResult }> = [];
  for (const tag of tagContexts) {
    const result = await provider.review(buffer, mimeType, judges, tag);
    panelResults.push({ tag, result });
  }

  await prisma.$transaction(async (tx) => {
    for (const { tag, result } of panelResults) {
      for (const decision of result.decisions) {
        await tx.npcEvaluation.upsert({
          where: {
            contentId_judgeId_tagId: {
              contentId,
              judgeId: decision.judgeId,
              tagId: tag.id,
            },
          },
          create: {
            contentId,
            judgeId: decision.judgeId,
            tagId: tag.id,
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
    }

    const saved = await tx.npcEvaluation.count({
      where: { contentId, tagId: { not: null } },
    });
    if (saved < expectedCount) {
      throw new Error(`Incomplete NPC panel after save: ${saved}/${expectedCount}`);
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

  for (const { tagId } of tags) {
    await recalculateTagRanking(tagId);
  }

  console.log(
    `[npc_review_image] ${contentId} -> EXPLORING (${expectedCount} tag-scoped judge votes across ${tags.length} tags)`,
  );
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
