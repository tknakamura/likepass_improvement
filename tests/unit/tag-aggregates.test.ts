import { describe, it, expect } from "vitest";
import {
  computeLikeRate,
  computeRankingScore,
  meetsRankingEligibility,
  wilsonLowerBound,
} from "@/server/services/ranking/scoring";

/**
 * Documents the intended tag-scoped aggregation rules without a DB:
 * - Content totals = sum of all human + NPC votes (including legacy untagged)
 * - ContentTag metrics = only votes for that tagId / sourceTagId
 * - Same photo can LIKE on #child and PASS on #interior with divergent rates/ranks
 */
describe("tag-scoped LIKE aggregation rules", () => {
  it("separates tag like rates while summing photo LIKE count", () => {
    const child = { likes: 18, passes: 2 }; // human+NPC for #child
    const interior = { likes: 3, passes: 17 }; // human+NPC for #interior
    const legacyUntagged = { likes: 2, passes: 1 }; // sourceTagId/tagId NULL

    const contentLikeCount = child.likes + interior.likes + legacyUntagged.likes;
    const contentPassCount = child.passes + interior.passes + legacyUntagged.passes;

    expect(contentLikeCount).toBe(23);
    expect(computeLikeRate(contentLikeCount, contentPassCount)).toBeCloseTo(23 / 43);

    const childRate = computeLikeRate(child.likes, child.passes);
    const interiorRate = computeLikeRate(interior.likes, interior.passes);
    expect(childRate).toBeCloseTo(0.9);
    expect(interiorRate).toBeCloseTo(0.15);
    expect(childRate).toBeGreaterThan(interiorRate);

    const childScore = computeRankingScore({
      likeCount: child.likes,
      passCount: child.passes,
    });
    const interiorScore = computeRankingScore({
      likeCount: interior.likes,
      passCount: interior.passes,
    });
    expect(childScore).toBeGreaterThan(interiorScore);

    expect(wilsonLowerBound(child.likes, child.passes)).toBeGreaterThan(
      wilsonLowerBound(interior.likes, interior.passes),
    );
  });

  it("does not attribute legacy untagged votes to any tag ranking", () => {
    const tagVotes = { likes: 4, passes: 10 }; // below min likes / min votes
    const legacy = { likes: 20, passes: 0 };

    // Tag ranking uses only tag-scoped votes
    expect(meetsRankingEligibility(tagVotes.likes, tagVotes.passes)).toBe(false);

    // Photo totals include legacy and can become eligible independently
    const totalLikes = tagVotes.likes + legacy.likes;
    const totalPasses = tagVotes.passes + legacy.passes;
    expect(totalLikes).toBe(24);
    expect(meetsRankingEligibility(totalLikes, totalPasses)).toBe(true);
  });
});
