import { describe, it, expect } from "vitest";
import { selectNextContent, isExcludedFromQueue, buildVotedSet } from "@/server/services/evaluation/queue";
import type { QueueCandidate } from "@/server/services/evaluation/queue";

function makeCandidate(overrides: Partial<QueueCandidate> & { id: string; userId: string }): QueueCandidate {
  return {
    status: "ACTIVE",
    voteCount: 30,
    wilsonLower: 0.6,
    contentTags: [{ tag: { slug: "street", id: "t1" }, tagId: "t1", status: "ACTIVE" } as QueueCandidate["contentTags"][0]],
    ...overrides,
  } as QueueCandidate;
}

describe("isExcludedFromQueue", () => {
  it("excludes own posts", () => {
    const c = makeCandidate({ id: "c1", userId: "u1" });
    expect(isExcludedFromQueue(c, { userId: "u1", preferences: [], votedContentIds: new Set(), sessionHistory: [] })).toBe(true);
  });

  it("excludes voted content", () => {
    const c = makeCandidate({ id: "c1", userId: "u2" });
    expect(
      isExcludedFromQueue(c, {
        userId: "u1",
        preferences: [],
        votedContentIds: new Set(["c1"]),
        sessionHistory: [],
      })
    ).toBe(true);
  });

  it("excludes dormant", () => {
    const c = makeCandidate({ id: "c1", userId: "u2", status: "DORMANT" });
    expect(isExcludedFromQueue(c, { userId: "u1", preferences: [], votedContentIds: new Set(), sessionHistory: [] })).toBe(true);
  });
});

describe("selectNextContent", () => {
  it("returns null when no eligible", () => {
    const c = makeCandidate({ id: "c1", userId: "u1" });
    expect(
      selectNextContent([c], { userId: "u1", preferences: [], votedContentIds: new Set(), sessionHistory: [] })
    ).toBeNull();
  });

  it("selects eligible content", () => {
    const c = makeCandidate({ id: "c1", userId: "u2" });
    const result = selectNextContent([c], {
      userId: "u1",
      preferences: [],
      votedContentIds: new Set(),
      sessionHistory: [],
    });
    expect(result?.id).toBe("c1");
  });
});

describe("buildVotedSet", () => {
  it("builds set from votes", () => {
    expect(buildVotedSet([{ contentId: "a" }, { contentId: "b" }])).toEqual(new Set(["a", "b"]));
  });
});
