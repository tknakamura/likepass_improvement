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

async function countContentTotals(contentId: string, tx: TxClient | typeof prisma = prisma) {
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

  if (shouldBecomeDormant(likeCount, passCount, dormant) && ["EXPLORING", "ACTIVE", "DORMANT"].includes(currentStatus)) {
    return "DORMANT";
  }

  if (
    ["EXPLORING", "ACTIVE", "DORMANT"].includes(currentStatus) &&
    meetsRankingEligibility(likeCount, passCount, ranking.minVotes, ranking.minLikes) &&
    !shouldBecomeDormant(likeCount, passCount, dormant)
  ) {
    return "ACTIVE";
  }

  if (currentStatus === "ACTIVE" || currentStatus === "DORMANT") {
    return "EXPLORING";
  }

  return currentStatus;
}

/**
 * Recomputes Content totals from Vote + NpcEvaluation, then copies the same
 * photo-level counts onto every ContentTag for ranking.
 */
export async function recomputeVoteAggregates(contentId: string, tx?: TxClient) {
  const run = async (client: TxClient | typeof prisma) => {
    const configs = await getAppConfigs();
    const content = await client.content.findUnique({ where: { id: contentId } });
    if (!content) return null;

    const totals = await countContentTotals(contentId, client);
    const likeRate = computeLikeRate(totals.likeCount, totals.passCount);
    const wilsonLower = wilsonLowerBound(totals.likeCount, totals.passCount);
    const status = resolveLifecycleStatus(
      content.status,
      totals.likeCount,
      totals.passCount,
      configs.dormant,
      configs.ranking,
    );

    await client.content.update({
      where: { id: contentId },
      data: {
        likeCount: totals.likeCount,
        passCount: totals.passCount,
        voteCount: totals.voteCount,
        likeRate,
        wilsonLower,
        status,
      },
    });

    const contentTags = await client.contentTag.findMany({ where: { contentId } });
    const rankingScore = computeRankingScore({
      likeCount: totals.likeCount,
      passCount: totals.passCount,
      publishedAt: content.publishedAt,
      targetVotes: configs.ranking.targetVotes,
    });

    for (const ct of contentTags) {
      let tagStatus: ContentTagStatus;
      if (ct.status === "REMOVED") {
        tagStatus = "REMOVED";
      } else if (shouldBecomeDormant(totals.likeCount, totals.passCount, configs.dormant)) {
        tagStatus = "DORMANT";
      } else if (
        status === "ACTIVE" &&
        meetsRankingEligibility(
          totals.likeCount,
          totals.passCount,
          configs.ranking.minVotes,
          configs.ranking.minLikes,
        )
      ) {
        tagStatus = "ACTIVE";
      } else {
        tagStatus = "PENDING";
      }

      await client.contentTag.update({
        where: { id: ct.id },
        data: {
          likeCount: totals.likeCount,
          passCount: totals.passCount,
          voteCount: totals.voteCount,
          likeRate,
          wilsonLower,
          rankingScore,
          status: tagStatus,
        },
      });
    }

    return { ...totals, likeRate, wilsonLower, status };
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
        ct.likeCount,
        ct.passCount,
        configs.ranking.minVotes,
        configs.ranking.minLikes,
      ),
    )
    .map((ct) => ({
      ...ct,
      rankingScore: computeRankingScore({
        likeCount: ct.likeCount,
        passCount: ct.passCount,
        publishedAt: ct.content.publishedAt,
        period,
        targetVotes: configs.ranking.targetVotes,
      }),
    }));

  eligible.sort((a, b) => {
    if (b.rankingScore !== a.rankingScore) return b.rankingScore - a.rankingScore;
    if (b.wilsonLower !== a.wilsonLower) return b.wilsonLower - a.wilsonLower;
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
          likeRate: ct.likeRate,
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
