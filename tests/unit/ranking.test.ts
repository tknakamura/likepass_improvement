import { describe, it, expect } from "vitest";
import {
  wilsonLowerBound,
  wilsonUpperBound,
  computeRankingScore,
  shouldBecomeDormant,
  meetsRankingEligibility,
  computeLikeRate,
} from "@/server/services/ranking/scoring";

describe("wilsonLowerBound", () => {
  it("returns 0 for zero votes", () => {
    expect(wilsonLowerBound(0, 0)).toBe(0);
  });

  it("penalizes low sample size", () => {
    const perfect = wilsonLowerBound(5, 0);
    const moreVotes = wilsonLowerBound(50, 5);
    expect(perfect).toBeLessThan(1);
    expect(moreVotes).toBeGreaterThan(perfect);
  });
});

describe("computeRankingScore", () => {
  it("ranks high-confidence content higher", () => {
    const high = computeRankingScore({ likeCount: 80, passCount: 20 });
    const low = computeRankingScore({ likeCount: 8, passCount: 2 });
    expect(high).toBeGreaterThan(low);
  });
});

describe("shouldBecomeDormant", () => {
  it("triggers early stop", () => {
    expect(shouldBecomeDormant(2, 18)).toBe(true);
  });

  it("does not trigger with few votes and decent rate", () => {
    expect(shouldBecomeDormant(10, 5)).toBe(false);
  });
});

describe("meetsRankingEligibility", () => {
  it("requires minimum votes and likes", () => {
    expect(meetsRankingEligibility(3, 3)).toBe(false);
    expect(meetsRankingEligibility(4, 16)).toBe(false);
    expect(meetsRankingEligibility(5, 15)).toBe(true);
  });
});

describe("computeLikeRate", () => {
  it("computes correctly", () => {
    expect(computeLikeRate(3, 1)).toBe(0.75);
    expect(computeLikeRate(0, 0)).toBe(0);
  });
});

describe("wilsonUpperBound", () => {
  it("returns 1 for zero votes", () => {
    expect(wilsonUpperBound(0, 0)).toBe(1);
  });
});
