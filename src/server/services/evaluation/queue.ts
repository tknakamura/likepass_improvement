import type { Content, ContentTag, Tag, UserTagPreference, Vote } from "@prisma/client";

export interface QueueCandidate extends Content {
  contentTags: (ContentTag & { tag: Tag })[];
}

export interface QueueContext {
  userId: string;
  preferences: UserTagPreference[];
  votedContentIds: Set<string>;
  sessionHistory: string[];
  tagSlugs?: string[];
}

const POOL_WEIGHTS = {
  highQuality: 0.5,
  exploring: 0.3,
  underVoted: 0.15,
  experiment: 0.05,
};

function classifyPool(content: QueueCandidate): keyof typeof POOL_WEIGHTS {
  if (content.status === "EXPLORING") return "exploring";
  if (content.voteCount < 20) return "underVoted";
  if (content.wilsonLower >= 0.5) return "highQuality";
  return "experiment";
}

export function isExcludedFromQueue(
  content: QueueCandidate,
  context: QueueContext
): boolean {
  if (content.userId === context.userId) return true;
  if (context.votedContentIds.has(content.id)) return true;
  if (
    [
      "DORMANT",
      "REJECTED",
      "DELETED",
      "UPLOADING",
      "PROCESSING",
      "NPC_REVIEWING",
      "REVIEW_REQUIRED",
    ].includes(content.status)
  ) {
    return true;
  }

  if (context.tagSlugs && context.tagSlugs.length > 0) {
    const slugSet = new Set(context.tagSlugs);
    const hasActiveTag = content.contentTags.some(
      (ct) => slugSet.has(ct.tag.slug) && ct.status === "ACTIVE"
    );
    if (!hasActiveTag) return true;
  }

  return false;
}

export function selectNextContent(
  candidates: QueueCandidate[],
  context: QueueContext
): QueueCandidate | null {
  const eligible = candidates.filter((c) => !isExcludedFromQueue(c, context));
  if (eligible.length === 0) return null;

  const pools: Record<keyof typeof POOL_WEIGHTS, QueueCandidate[]> = {
    highQuality: [],
    exploring: [],
    underVoted: [],
    experiment: [],
  };

  for (const c of eligible) {
    pools[classifyPool(c)].push(c);
  }

  const lastAuthor = context.sessionHistory.length
    ? candidates.find((c) => c.id === context.sessionHistory[context.sessionHistory.length - 1])?.userId
    : null;

  const preferredTagIds = new Set(context.preferences.map((p) => p.tagId));

  function score(candidate: QueueCandidate): number {
    let s = Math.random();
    if (preferredTagIds.size > 0) {
      const match = candidate.contentTags.some((ct) => preferredTagIds.has(ct.tagId));
      if (match) s += 2;
    }
    if (lastAuthor && candidate.userId === lastAuthor) s -= 10;
    if (context.sessionHistory.includes(candidate.id)) s -= 10;
    return s;
  }

  const roll = Math.random();
  let poolKey: keyof typeof POOL_WEIGHTS = "highQuality";
  let cumulative = 0;
  for (const [key, weight] of Object.entries(POOL_WEIGHTS) as [keyof typeof POOL_WEIGHTS, number][]) {
    cumulative += weight;
    if (roll <= cumulative && pools[key].length > 0) {
      poolKey = key;
      break;
    }
  }

  const pool = pools[poolKey].length > 0 ? pools[poolKey] : eligible;
  pool.sort((a, b) => score(b) - score(a));
  return pool[0] ?? null;
}

export function buildVotedSet(votes: Pick<Vote, "contentId">[]): Set<string> {
  return new Set(votes.map((v) => v.contentId));
}
