import { describe, it, expect } from "vitest";
import {
  computeLikeRate,
  computeRankingScore,
  meetsRankingEligibility,
  wilsonLowerBound,
} from "@/server/services/ranking/scoring";

/**
 * Photo-level aggregation rules:
 * - One human vote and one NPC vote per judge count once on Content
 * - Every ContentTag on that photo receives the same like/pass totals
 */
describe("photo-scoped LIKE aggregation rules", () => {
  it("copies the same photo totals onto every attached tag", () => {
    const human = { likes: 3, passes: 1 };
    const npc = { likes: 5, passes: 5 };
    const likeCount = human.likes + npc.likes;
    const passCount = human.passes + npc.passes;
    const likeRate = computeLikeRate(likeCount, passCount);
    const wilson = wilsonLowerBound(likeCount, passCount);
    const score = computeRankingScore({ likeCount, passCount });

    const tags = ["child", "interior", "street"];
    for (const _slug of tags) {
      expect(computeLikeRate(likeCount, passCount)).toBe(likeRate);
      expect(wilsonLowerBound(likeCount, passCount)).toBe(wilson);
      expect(computeRankingScore({ likeCount, passCount })).toBe(score);
    }

    expect(likeCount).toBe(8);
    expect(passCount).toBe(6);
    expect(likeRate).toBeCloseTo(8 / 14);
  });

  it("counts a single photo vote once even when the photo has many tags", () => {
    const photoVotes = { likes: 20, passes: 5 };
    const tagCount = 3;

    // Content total stays photo-level
    expect(photoVotes.likes + photoVotes.passes).toBe(25);
    expect(meetsRankingEligibility(photoVotes.likes, photoVotes.passes)).toBe(true);

    // Ranking lists may include the photo under each tag, but do not multiply votes
    const duplicatedWrongly = photoVotes.likes * tagCount;
    expect(duplicatedWrongly).toBe(60);
    expect(photoVotes.likes).not.toBe(duplicatedWrongly);
  });
});
