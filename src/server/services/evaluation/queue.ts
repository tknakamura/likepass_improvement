import type { Content, ContentTag, Tag, UserTagPreference, Vote } from "@prisma/client";

export type QueuePair = ContentTag & {
  tag: Tag;
  content: Content & {
    contentTags: (ContentTag & { tag: Tag })[];
  };
};

export interface QueueContext {
  userId: string;
  preferences: UserTagPreference[];
  /** Already-voted photo IDs (one vote per content). */
  votedContentIds: Set<string>;
  /** Recently shown photo IDs in this session. */
  sessionHistory: string[];
  tagSlugs?: string[];
}

const POOL_WEIGHTS = {
  highQuality: 0.5,
  exploring: 0.3,
  underVoted: 0.15,
  experiment: 0.05,
};

function classifyPool(pair: QueuePair): keyof typeof POOL_WEIGHTS {
  if (pair.content.status === "EXPLORING" || pair.status === "PENDING") return "exploring";
  if (pair.content.voteCount < 20) return "underVoted";
  if (pair.content.wilsonLower >= 0.5) return "highQuality";
  return "experiment";
}

export function isExcludedFromQueue(pair: QueuePair, context: QueueContext): boolean {
  if (pair.content.userId === context.userId) return true;
  if (context.votedContentIds.has(pair.contentId)) return true;
  if (
    [
      "DORMANT",
      "REJECTED",
      "DELETED",
      "UPLOADING",
      "PROCESSING",
      "NPC_REVIEWING",
      "REVIEW_REQUIRED",
    ].includes(pair.content.status)
  ) {
    return true;
  }
  if (["REMOVED", "DORMANT"].includes(pair.status)) return true;

  if (context.tagSlugs && context.tagSlugs.length > 0) {
    const slugSet = new Set(context.tagSlugs);
    if (!slugSet.has(pair.tag.slug)) return true;
  }

  return false;
}

export function selectNextPair(candidates: QueuePair[], context: QueueContext): QueuePair | null {
  const eligible = candidates.filter((c) => !isExcludedFromQueue(c, context));
  if (eligible.length === 0) return null;

  // Deduplicate by content so the same photo is not offered twice via different tags.
  const byContent = new Map<string, QueuePair>();
  for (const pair of eligible) {
    const existing = byContent.get(pair.contentId);
    if (!existing) {
      byContent.set(pair.contentId, pair);
      continue;
    }
    // Prefer a preferred tag when available.
    const preferredTagIds = new Set(context.preferences.map((p) => p.tagId));
    if (!preferredTagIds.has(existing.tagId) && preferredTagIds.has(pair.tagId)) {
      byContent.set(pair.contentId, pair);
    }
  }
  const unique = [...byContent.values()];

  const pools: Record<keyof typeof POOL_WEIGHTS, QueuePair[]> = {
    highQuality: [],
    exploring: [],
    underVoted: [],
    experiment: [],
  };

  for (const c of unique) {
    pools[classifyPool(c)].push(c);
  }

  const lastContentId = context.sessionHistory[context.sessionHistory.length - 1];
  const lastAuthor = lastContentId
    ? unique.find((c) => c.contentId === lastContentId)?.content.userId
    : null;

  const preferredTagIds = new Set(context.preferences.map((p) => p.tagId));

  function score(candidate: QueuePair): number {
    let s = Math.random();
    if (preferredTagIds.has(candidate.tagId)) s += 2;
    if (lastAuthor && candidate.content.userId === lastAuthor) s -= 10;
    if (context.sessionHistory.includes(candidate.contentId)) s -= 10;
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

  const pool = pools[poolKey].length > 0 ? pools[poolKey] : unique;
  pool.sort((a, b) => score(b) - score(a));
  return pool[0] ?? null;
}

export function buildVotedSet(votes: Pick<Vote, "contentId">[]): Set<string> {
  return new Set(votes.map((v) => v.contentId));
}

/** @deprecated Prefer selectNextPair + buildVotedSet */
export function selectNextContent(
  candidates: Array<Content & { contentTags: (ContentTag & { tag: Tag })[] }>,
  context: {
    userId: string;
    preferences: UserTagPreference[];
    votedContentIds: Set<string>;
    sessionHistory: string[];
    tagSlugs?: string[];
  },
): (Content & { contentTags: (ContentTag & { tag: Tag })[] }) | null {
  const pairs: QueuePair[] = [];
  for (const content of candidates) {
    for (const ct of content.contentTags) {
      pairs.push({ ...ct, content });
    }
  }

  const selected = selectNextPair(pairs, {
    userId: context.userId,
    preferences: context.preferences,
    votedContentIds: context.votedContentIds,
    sessionHistory: context.sessionHistory,
    tagSlugs: context.tagSlugs,
  });
  return selected?.content ?? null;
}

/** @deprecated Prefer isExcludedFromQueue on QueuePair */
export function isExcludedFromQueueLegacy(
  content: Content & { contentTags: (ContentTag & { tag: Tag })[] },
  context: {
    userId: string;
    preferences: UserTagPreference[];
    votedContentIds: Set<string>;
    sessionHistory: string[];
    tagSlugs?: string[];
  },
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
      (ct) => slugSet.has(ct.tag.slug) && ct.status !== "REMOVED",
    );
    if (!hasActiveTag) return true;
  }
  return false;
}
