import { prisma } from "@/lib/db";
import { meetsRankingEligibility } from "@/server/services/ranking/scoring";

export interface UnlockedRanking {
  tagSlug: string;
  displayName: string;
  rank: number;
}

export async function getUnlockedRankingsForVote(
  userId: string,
  contentId: string
): Promise<UnlockedRanking[]> {
  const contentTags = await prisma.contentTag.findMany({
    where: {
      contentId,
      status: "ACTIVE",
      content: { status: "ACTIVE" },
      currentRank: { not: null, lte: 100 },
    },
    include: {
      tag: true,
      content: true,
    },
  });

  const unlocked: UnlockedRanking[] = [];

  for (const ct of contentTags) {
    if (!meetsRankingEligibility(ct.content.likeCount, ct.content.passCount)) continue;
    if (!ct.currentRank) continue;

    unlocked.push({
      tagSlug: ct.tag.slug,
      displayName: ct.tag.displayName,
      rank: ct.currentRank,
    });
  }

  return unlocked.sort((a, b) => a.rank - b.rank);
}
