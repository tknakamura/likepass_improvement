import { prisma } from "@/lib/db";
import { getAppConfigs } from "@/lib/app-config";
import {
  computeLikeRate,
  computeRankingScore,
  shouldBecomeDormant,
  wilsonLowerBound,
  meetsRankingEligibility,
} from "@/server/services/ranking/scoring";
import type { ContentStatus, ContentTagStatus, Prisma } from "@prisma/client";

type TxClient = Prisma.TransactionClient;

async function countVotesFromSources(contentId: string, tx: TxClient | typeof prisma = prisma) {
  const [humanLikes, humanPasses, npcLikes, npcPasses] = await Promise.all([
    tx.vote.count({ where: { contentId, value: "LIKE" } }),
    tx.vote.count({ where: { contentId, value: "PASS" } }),
    tx.npcEvaluation.count({ where: { contentId, value: "LIKE" } }),
    tx.npcEvaluation.count({ where: { contentId, value: "PASS" } }),
  ]);

  const likeCount = humanLikes + npcLikes;
  const passCount = humanPasses + npcPasses;
  return {
    likeCount,
    passCount,
    voteCount: likeCount + passCount,
    humanLikeCount: humanLikes,
    humanPassCount: humanPasses,
    npcLikeCount: npcLikes,
    npcPassCount: npcPasses,
  };
}

function resolveLifecycleStatus(
  currentStatus: ContentStatus,
  likeCount: number,
  passCount: number,
  dormant: Awaited<ReturnType<typeof getAppConfigs>>["dormant"],
  ranking: Awaited<ReturnType<typeof getAppConfigs>>["ranking"],
): ContentStatus {
  // Do not advance lifecycle while still in pre-publish pipeline.
  if (
    currentStatus === "UPLOADING" ||
    currentStatus === "PROCESSING" ||
    currentStatus === "NPC_REVIEWING" ||
    currentStatus === "REVIEW_REQUIRED" ||
    currentStatus === "REJECTED" ||
    currentStatus === "DELETED"
  ) {
    return currentStatus;
  }

  if (shouldBecomeDormant(likeCount, passCount, dormant) && ["EXPLORING", "ACTIVE"].includes(currentStatus)) {
    return "DORMANT";
  }

  if (
    currentStatus === "EXPLORING" &&
    meetsRankingEligibility(likeCount, passCount, ranking.minVotes, ranking.minLikes)
  ) {
    return "ACTIVE";
  }

  return currentStatus;
}

/**
 * Recomputes Content + ContentTag aggregates from authoritative Vote and NpcEvaluation rows.
 * Safe under concurrent updates (no lost increments).
 */
export async function recomputeVoteAggregates(contentId: string, tx?: TxClient) {
  const run = async (client: TxClient | typeof prisma) => {
    const configs = await getAppConfigs();
    const content = await client.content.findUnique({ where: { id: contentId } });
    if (!content) return null;

    const counts = await countVotesFromSources(contentId, client);
    const likeRate = computeLikeRate(counts.likeCount, counts.passCount);
    const wilsonLower = wilsonLowerBound(counts.likeCount, counts.passCount);
    const status = resolveLifecycleStatus(
      content.status,
      counts.likeCount,
      counts.passCount,
      configs.dormant,
      configs.ranking,
    );

    await client.content.update({
      where: { id: contentId },
      data: {
        likeCount: counts.likeCount,
        passCount: counts.passCount,
        voteCount: counts.voteCount,
        likeRate,
        wilsonLower,
        status,
      },
    });

    const contentTags = await client.contentTag.findMany({ where: { contentId } });
    for (const ct of contentTags) {
      const rankingScore = computeRankingScore({
        likeCount: counts.likeCount,
        passCount: counts.passCount,
        publishedAt: content.publishedAt,
        targetVotes: configs.ranking.targetVotes,
      });

      let tagStatus: ContentTagStatus = ct.status;
      if (ct.status !== "REMOVED") {
        if (shouldBecomeDormant(counts.likeCount, counts.passCount, configs.dormant)) {
          tagStatus = "DORMANT";
        } else if (
          meetsRankingEligibility(
            counts.likeCount,
            counts.passCount,
            configs.ranking.minVotes,
            configs.ranking.minLikes,
          ) &&
          status === "ACTIVE"
        ) {
          tagStatus = "ACTIVE";
        }
      }

      await client.contentTag.update({
        where: { id: ct.id },
        data: {
          likeCount: counts.likeCount,
          passCount: counts.passCount,
          voteCount: counts.voteCount,
          rankingScore,
          status: tagStatus,
        },
      });
    }

    return { ...counts, likeRate, wilsonLower, status };
  };

  if (tx) return run(tx);
  return run(prisma);
}

/** Recomputes aggregates from Vote + NpcEvaluation (delta args ignored; kept for call-site compatibility). */
export async function updateVoteAggregates(
  contentId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  oldValue?: "LIKE" | "PASS",
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  newValue?: "LIKE" | "PASS",
) {
  await recomputeVoteAggregates(contentId);
  await evaluateLifecycle(contentId);
}

export async function evaluateLifecycle(contentId: string) {
  const content = await prisma.content.findUnique({
    where: { id: contentId },
    include: { contentTags: true },
  });
  if (!content) return;

  if (content.reportCount >= 3 && content.status === "ACTIVE") {
    await prisma.content.update({
      where: { id: contentId },
      data: { status: "REVIEW_REQUIRED" },
    });
  }
}

export async function recalculateTagRanking(
  tagId: string,
  period: "ALL_TIME" | "DAILY" | "WEEKLY" | "MONTHLY" = "ALL_TIME",
) {
  const configs = await getAppConfigs();
  const periodStart = getPeriodStart(period);

  const contentTags = await prisma.contentTag.findMany({
    where: {
      tagId,
      status: "ACTIVE",
      content: {
        status: "ACTIVE",
        ...(periodStart ? { publishedAt: { gte: periodStart } } : {}),
      },
    },
    include: { content: true },
  });

  const eligible = contentTags
    .filter((ct) =>
      meetsRankingEligibility(
        ct.content.likeCount,
        ct.content.passCount,
        configs.ranking.minVotes,
        configs.ranking.minLikes,
      ),
    )
    .map((ct) => ({
      ...ct,
      rankingScore: computeRankingScore({
        likeCount: ct.content.likeCount,
        passCount: ct.content.passCount,
        publishedAt: ct.content.publishedAt,
        period,
        targetVotes: configs.ranking.targetVotes,
      }),
    }));

  eligible.sort((a, b) => {
    if (b.rankingScore !== a.rankingScore) return b.rankingScore - a.rankingScore;
    if (b.content.wilsonLower !== a.content.wilsonLower) return b.content.wilsonLower - a.content.wilsonLower;
    if (b.voteCount !== a.voteCount) return b.voteCount - a.voteCount;
    if (b.likeCount !== a.likeCount) return b.likeCount - a.likeCount;
    return b.content.createdAt.getTime() - a.content.createdAt.getTime();
  });

  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < eligible.length; i++) {
      const ct = eligible[i];
      const rank = i + 1;
      await tx.contentTag.update({
        where: { id: ct.id },
        data: { previousRank: ct.currentRank, currentRank: rank, rankingScore: ct.rankingScore },
      });
      await tx.rankingSnapshot.create({
        data: {
          tagId,
          period,
          contentId: ct.contentId,
          rank,
          score: ct.rankingScore,
          voteCount: ct.voteCount,
          likeRate: ct.content.likeRate,
        },
      });
    }
  });
}

function getPeriodStart(period: "ALL_TIME" | "DAILY" | "WEEKLY" | "MONTHLY"): Date | null {
  if (period === "ALL_TIME") return null;
  const now = Date.now();
  const hours: Record<string, number> = {
    DAILY: 24,
    WEEKLY: 24 * 7,
    MONTHLY: 24 * 30,
  };
  return new Date(now - (hours[period] ?? 24) * 60 * 60 * 1000);
}
