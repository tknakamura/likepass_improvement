import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getAppConfigs } from "@/lib/app-config";
import { getPublicImageUrl } from "@/lib/r2";
import { computeRankingScore, meetsRankingEligibility } from "@/server/services/ranking/scoring";

const PERIODS = ["ALL_TIME", "DAILY", "WEEKLY", "MONTHLY"] as const;
type Period = (typeof PERIODS)[number];

function getPeriodStart(period: Period): Date | null {
  if (period === "ALL_TIME") return null;
  const hours: Record<string, number> = { DAILY: 24, WEEKLY: 168, MONTHLY: 720 };
  return new Date(Date.now() - (hours[period] ?? 24) * 60 * 60 * 1000);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tagSlug: string }> }
) {
  const session = await auth();
  const { tagSlug } = await params;
  const { searchParams } = new URL(request.url);
  const periodParam = searchParams.get("period") ?? "ALL_TIME";
  const period = PERIODS.includes(periodParam as Period) ? (periodParam as Period) : "ALL_TIME";
  const periodStart = getPeriodStart(period);
  const configs = await getAppConfigs();

  const tag = await prisma.tag.findUnique({ where: { slug: tagSlug } });
  if (!tag) {
    return NextResponse.json({ error: "Tag not found" }, { status: 404 });
  }

  const votedIds = session?.user?.id
    ? new Set(
        (
          await prisma.vote.findMany({
            where: { userId: session.user.id },
            select: { contentId: true },
          })
        ).map((v) => v.contentId)
      )
    : new Set<string>();

  const contentTags = await prisma.contentTag.findMany({
    where: {
      tagId: tag.id,
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
      ct,
      score: computeRankingScore({
        likeCount: ct.content.likeCount,
        passCount: ct.content.passCount,
        publishedAt: ct.content.publishedAt,
        period,
        targetVotes: configs.ranking.targetVotes,
      }),
    }))
    .sort((a, b) => b.score - a.score);

  const items = eligible.map(({ ct }, index) => {
    const rank = index + 1;
    const isUnlocked = session?.user ? votedIds.has(ct.contentId) : false;

    if (!isUnlocked) {
      return { rank, isUnlocked: false, content: null };
    }

    const imageKey = ct.content.mediumObjectKey ?? ct.content.thumbnailObjectKey;
    return {
      rank,
      isUnlocked: true,
      content: {
        id: ct.contentId,
        imageUrl: imageKey ? getPublicImageUrl(imageKey) : null,
      },
    };
  });

  const topN = 100;
  const displayItems = items.slice(0, topN);
  const unlockedInTop = displayItems.filter((i) => i.isUnlocked).length;

  return NextResponse.json({
    tag: { slug: tag.slug, displayName: tag.displayName },
    period,
    items: displayItems,
    progress: {
      unlocked: unlockedInTop,
      total: displayItems.length,
    },
  });
}
