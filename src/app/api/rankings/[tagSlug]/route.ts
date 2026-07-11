import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getPublicImageUrl } from "@/lib/r2";
import { meetsRankingEligibility } from "@/server/services/ranking/scoring";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tagSlug: string }> }
) {
  const session = await auth();
  const { tagSlug } = await params;

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
      content: { status: "ACTIVE" },
    },
    include: { content: true },
    orderBy: [{ currentRank: "asc" }, { rankingScore: "desc" }],
    take: 100,
  });

  const eligible = contentTags.filter((ct) =>
    meetsRankingEligibility(ct.content.likeCount, ct.content.passCount)
  );

  const items = eligible.map((ct, index) => {
    const rank = ct.currentRank ?? index + 1;
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

  const topN = 10;
  const unlockedInTop = items.slice(0, topN).filter((i) => i.isUnlocked).length;

  return NextResponse.json({
    tag: { slug: tag.slug, displayName: tag.displayName },
    period: "ALL_TIME",
    items,
    progress: {
      unlocked: unlockedInTop,
      total: Math.min(topN, items.length),
    },
  });
}
