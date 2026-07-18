import { describe, it, expect } from "vitest";
import {
  selectNextPair,
  isExcludedFromQueue,
  buildVotedSet,
  type QueuePair,
} from "@/server/services/evaluation/queue";
import type { Content, ContentTag, Tag } from "@prisma/client";

function makePair(
  overrides: {
    contentId: string;
    tagId: string;
    userId: string;
    contentStatus?: Content["status"];
    tagStatus?: ContentTag["status"];
    tagSlug?: string;
    voteCount?: number;
    wilsonLower?: number;
  },
): QueuePair {
  const tag = {
    id: overrides.tagId,
    slug: overrides.tagSlug ?? "street",
    displayName: overrides.tagSlug ?? "street",
  } as Tag;

  const contentTag = {
    id: `ct-${overrides.contentId}-${overrides.tagId}`,
    contentId: overrides.contentId,
    tagId: overrides.tagId,
    status: overrides.tagStatus ?? "ACTIVE",
    voteCount: overrides.voteCount ?? 30,
    wilsonLower: overrides.wilsonLower ?? 0.6,
    tag,
  } as ContentTag & { tag: Tag };

  const content = {
    id: overrides.contentId,
    userId: overrides.userId,
    status: overrides.contentStatus ?? "ACTIVE",
    voteCount: overrides.voteCount ?? 30,
    wilsonLower: overrides.wilsonLower ?? 0.6,
    contentTags: [contentTag],
  } as Content & { contentTags: (ContentTag & { tag: Tag })[] };

  return { ...contentTag, content };
}

describe("isExcludedFromQueue", () => {
  it("excludes own posts", () => {
    const pair = makePair({ contentId: "c1", tagId: "t1", userId: "u1" });
    expect(
      isExcludedFromQueue(pair, {
        userId: "u1",
        preferences: [],
        votedContentIds: new Set(),
        sessionHistory: [],
      }),
    ).toBe(true);
  });

  it("excludes already-voted photos across all tags", () => {
    const pair = makePair({ contentId: "c1", tagId: "t1", userId: "u2" });
    expect(
      isExcludedFromQueue(pair, {
        userId: "u1",
        preferences: [],
        votedContentIds: new Set(["c1"]),
        sessionHistory: [],
      }),
    ).toBe(true);

    const otherTag = makePair({ contentId: "c1", tagId: "t2", userId: "u2", tagSlug: "child" });
    expect(
      isExcludedFromQueue(otherTag, {
        userId: "u1",
        preferences: [],
        votedContentIds: new Set(["c1"]),
        sessionHistory: [],
      }),
    ).toBe(true);
  });

  it("excludes dormant content and tags", () => {
    const dormantContent = makePair({
      contentId: "c1",
      tagId: "t1",
      userId: "u2",
      contentStatus: "DORMANT",
    });
    expect(
      isExcludedFromQueue(dormantContent, {
        userId: "u1",
        preferences: [],
        votedContentIds: new Set(),
        sessionHistory: [],
      }),
    ).toBe(true);

    const dormantTag = makePair({
      contentId: "c1",
      tagId: "t1",
      userId: "u2",
      tagStatus: "DORMANT",
    });
    expect(
      isExcludedFromQueue(dormantTag, {
        userId: "u1",
        preferences: [],
        votedContentIds: new Set(),
        sessionHistory: [],
      }),
    ).toBe(true);
  });

  it("excludes NPC_REVIEWING content", () => {
    const pair = makePair({
      contentId: "c1",
      tagId: "t1",
      userId: "u2",
      contentStatus: "NPC_REVIEWING",
    });
    expect(
      isExcludedFromQueue(pair, {
        userId: "u1",
        preferences: [],
        votedContentIds: new Set(),
        sessionHistory: [],
      }),
    ).toBe(true);
  });

  it("excludes pairs without selected tags", () => {
    const pair = makePair({ contentId: "c1", tagId: "t1", userId: "u2", tagSlug: "street" });
    expect(
      isExcludedFromQueue(pair, {
        userId: "u1",
        preferences: [],
        votedContentIds: new Set(),
        sessionHistory: [],
        tagSlugs: ["ramen"],
      }),
    ).toBe(true);
  });

  it("includes pairs matching selected tag", () => {
    const pair = makePair({ contentId: "c1", tagId: "t2", userId: "u2", tagSlug: "ramen" });
    expect(
      isExcludedFromQueue(pair, {
        userId: "u1",
        preferences: [],
        votedContentIds: new Set(),
        sessionHistory: [],
        tagSlugs: ["ramen", "night"],
      }),
    ).toBe(false);
  });
});

describe("selectNextPair", () => {
  it("returns null when no eligible", () => {
    const pair = makePair({ contentId: "c1", tagId: "t1", userId: "u1" });
    expect(
      selectNextPair([pair], {
        userId: "u1",
        preferences: [],
        votedContentIds: new Set(),
        sessionHistory: [],
      }),
    ).toBeNull();
  });

  it("selects eligible pair", () => {
    const pair = makePair({ contentId: "c1", tagId: "t1", userId: "u2" });
    const result = selectNextPair([pair], {
      userId: "u1",
      preferences: [],
      votedContentIds: new Set(),
      sessionHistory: [],
    });
    expect(result?.contentId).toBe("c1");
  });

  it("does not re-offer a photo via another tag after voting", () => {
    const child = makePair({ contentId: "c1", tagId: "t-child", userId: "u2", tagSlug: "child" });
    const interior = makePair({
      contentId: "c1",
      tagId: "t-interior",
      userId: "u2",
      tagSlug: "interior",
    });
    const result = selectNextPair([child, interior], {
      userId: "u1",
      preferences: [],
      votedContentIds: new Set(["c1"]),
      sessionHistory: [],
    });
    expect(result).toBeNull();
  });

  it("deduplicates the same photo offered under multiple tags", () => {
    const child = makePair({ contentId: "c1", tagId: "t-child", userId: "u2", tagSlug: "child" });
    const interior = makePair({
      contentId: "c1",
      tagId: "t-interior",
      userId: "u2",
      tagSlug: "interior",
    });
    const other = makePair({ contentId: "c2", tagId: "t-street", userId: "u3", tagSlug: "street" });
    const result = selectNextPair([child, interior, other], {
      userId: "u1",
      preferences: [],
      votedContentIds: new Set(),
      sessionHistory: [],
    });
    expect(result).not.toBeNull();
    expect(["c1", "c2"]).toContain(result!.contentId);
  });
});

describe("buildVotedSet", () => {
  it("builds content IDs from votes", () => {
    expect(
      buildVotedSet([{ contentId: "a" }, { contentId: "b" }, { contentId: "a" }]),
    ).toEqual(new Set(["a", "b"]));
  });
});
