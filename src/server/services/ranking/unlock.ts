import { prisma } from "@/lib/db";
import { meetsRankingEligibility } from "@/server/services/ranking/scoring";

export interface UnlockedRanking {
  tagSlug: string;
  displayName: string;
  rank: number;
}

/**
 * After a photo-level vote, unlock rankings for every tag attached to that photo
 * when the content is ACTIVE and ranked in the top 100 for that tag.
 */
export async function getUnlockedRankingsForVote(
  userId: string,
  contentId: string,
): Promise<UnlockedRanking[]> {
  const vote = await prisma.vote.findUnique({
    where: {
      userId_contentId: {
        userId,
        contentId,
      },
    },
  });
  if (!vote) return [];

  const contentTags = await prisma.contentTag.findMany({
    where: {
      contentId,
      status: "ACTIVE",
      content: { status: "ACTIVE" },
    },
    include: {
      tag: true,
      content: true,
    },
  });

  const unlocked: UnlockedRanking[] = [];
  for (const contentTag of contentTags) {
    if (contentTag.currentRank == null || contentTag.currentRank > 100) continue;
    if (!meetsRankingEligibility(contentTag.likeCount, contentTag.passCount)) continue;
    unlocked.push({
      tagSlug: contentTag.tag.slug,
      displayName: contentTag.tag.displayName,
      rank: contentTag.currentRank,
    });
  }

  return unlocked;
}
