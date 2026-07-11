import { prisma } from "@/lib/db";
import { getAppConfigs } from "@/lib/app-config";
import {
  computeLikeRate,
  computeRankingScore,
  shouldBecomeDormant,
  wilsonLowerBound,
  meetsRankingEligibility,
} from "@/server/services/ranking/scoring";
import type { ContentStatus, ContentTagStatus } from "@prisma/client";

export async function updateVoteAggregates(contentId: string, oldValue?: "LIKE" | "PASS", newValue?: "LIKE" | "PASS") {
  const configs = await getAppConfigs();
  const content = await prisma.content.findUnique({ where: { id: contentId } });
  if (!content) return;

  let likeCount = content.likeCount;
  let passCount = content.passCount;

  if (oldValue === "LIKE") likeCount--;
  if (oldValue === "PASS") passCount--;
  if (newValue === "LIKE") likeCount++;
  if (newValue === "PASS") passCount++;

  likeCount = Math.max(0, likeCount);
  passCount = Math.max(0, passCount);
  const voteCount = likeCount + passCount;
  const likeRate = computeLikeRate(likeCount, passCount);
  const wilsonLower = wilsonLowerBound(likeCount, passCount);

  let status: ContentStatus = content.status;
  if (shouldBecomeDormant(likeCount, passCount, configs.dormant) && ["EXPLORING", "ACTIVE"].includes(content.status)) {
    status = "DORMANT";
  } else if (
    content.status === "EXPLORING" &&
    meetsRankingEligibility(likeCount, passCount, configs.ranking.minVotes, configs.ranking.minLikes)
  ) {
    status = "ACTIVE";
  }

  await prisma.content.update({
    where: { id: contentId },
    data: { likeCount, passCount, voteCount, likeRate, wilsonLower, status },
  });

  await updateContentTagAggregates(contentId);
  await evaluateLifecycle(contentId);
}

async function updateContentTagAggregates(contentId: string) {
  const configs = await getAppConfigs();
  const content = await prisma.content.findUnique({ where: { id: contentId } });
  if (!content) return;

  const contentTags = await prisma.contentTag.findMany({ where: { contentId } });
  for (const ct of contentTags) {
    const rankingScore = computeRankingScore({
      likeCount: content.likeCount,
      passCount: content.passCount,
      publishedAt: content.publishedAt,
      targetVotes: configs.ranking.targetVotes,
    });

    let tagStatus: ContentTagStatus = ct.status;
    if (shouldBecomeDormant(content.likeCount, content.passCount, configs.dormant)) {
      tagStatus = "DORMANT";
    } else if (
      meetsRankingEligibility(
        content.likeCount,
        content.passCount,
        configs.ranking.minVotes,
        configs.ranking.minLikes
      ) &&
      content.status === "ACTIVE"
    ) {
      tagStatus = "ACTIVE";
    }

    await prisma.contentTag.update({
      where: { id: ct.id },
      data: {
        likeCount: content.likeCount,
        passCount: content.passCount,
        voteCount: content.voteCount,
        rankingScore,
        status: tagStatus,
      },
    });
  }
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

export async function recalculateTagRanking(tagId: string, period: "ALL_TIME" | "DAILY" | "WEEKLY" | "MONTHLY" = "ALL_TIME") {
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
        configs.ranking.minLikes
      )
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
