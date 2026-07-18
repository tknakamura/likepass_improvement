import { describe, it, expect } from "vitest";
import {
  computeLikeRate,
  wilsonLowerBound,
  meetsRankingEligibility,
  shouldBecomeDormant,
} from "@/server/services/ranking/scoring";
import { DEFAULT_CONFIG } from "@/lib/seed/data";

describe("NPC + human vote aggregation math", () => {
  it("combines NPC seed votes into ranking eligibility counts", () => {
    const npcLikes = 5;
    const npcPasses = 5;
    const humanLikes = 3;
    const humanPasses = 1;

    const likeCount = npcLikes + humanLikes;
    const passCount = npcPasses + humanPasses;
    const voteCount = likeCount + passCount;
    const likeRate = computeLikeRate(likeCount, passCount);
    const wilson = wilsonLowerBound(likeCount, passCount);

    expect(voteCount).toBe(14);
    expect(likeRate).toBeCloseTo(8 / 14);
    expect(wilson).toBeGreaterThan(0);
    expect(
      meetsRankingEligibility(
        likeCount,
        passCount,
        DEFAULT_CONFIG.ranking.minVotes,
        DEFAULT_CONFIG.ranking.minLikes,
      ),
    ).toBe(false);
  });

  it("allows NPC-only panel of 10 to seed aggregates without dormancy", () => {
    const likeCount = 5;
    const passCount = 5;
    expect(shouldBecomeDormant(likeCount, passCount, DEFAULT_CONFIG.dormant)).toBe(false);
    expect(computeLikeRate(likeCount, passCount)).toBe(0.5);
  });

  it("reaches ACTIVE eligibility after humans add to NPC seed", () => {
    // 5 NPC likes + 15 human likes, 5 NPC pass + 0 human pass = 20 likes / 25 votes
    const likeCount = 20;
    const passCount = 5;
    expect(
      meetsRankingEligibility(
        likeCount,
        passCount,
        DEFAULT_CONFIG.ranking.minVotes,
        DEFAULT_CONFIG.ranking.minLikes,
      ),
    ).toBe(true);
  });
});
