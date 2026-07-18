import { prisma } from "@/lib/db";
import { meetsRankingEligibility } from "@/server/services/ranking/scoring";

export interface UnlockedRanking {
  tagSlug: string;
  displayName: string;
  rank: number;
}

export async function getUnlockedRankingsForVote(
  userId: string,
  contentId: string,
  sourceTagId: string,
): Promise<UnlockedRanking[]> {
  const vote = await prisma.vote.findUnique({
    where: {
      userId_contentId_sourceTagId: {
        userId,
        contentId,
        sourceTagId,
      },
    },
  });
  if (!vote) return [];

  const contentTag = await prisma.contentTag.findUnique({
    where: {
      contentId_tagId: {
        contentId,
        tagId: sourceTagId,
      },
    },
    include: {
      tag: true,
      content: true,
    },
  });

  if (!contentTag) return [];
  if (contentTag.status !== "ACTIVE" || contentTag.content.status !== "ACTIVE") return [];
  if (contentTag.currentRank == null || contentTag.currentRank > 100) return [];
  if (!meetsRankingEligibility(contentTag.likeCount, contentTag.passCount)) return [];

  return [
    {
      tagSlug: contentTag.tag.slug,
      displayName: contentTag.tag.displayName,
      rank: contentTag.currentRank,
    },
  ];
}
