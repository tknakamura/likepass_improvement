import { describe, it, expect } from "vitest";
import { DEFAULT_DORMANT_CONFIG } from "@/server/services/ranking/scoring";

describe("DEFAULT_DORMANT_CONFIG", () => {
  it("has expected MVP thresholds", () => {
    expect(DEFAULT_DORMANT_CONFIG.earlyStopMinVotes).toBe(20);
    expect(DEFAULT_DORMANT_CONFIG.standardStopMinVotes).toBe(50);
  });
});
