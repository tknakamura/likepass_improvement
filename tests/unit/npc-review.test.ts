import { describe, it, expect } from "vitest";
import {
  MAX_NPC_COMMENT_LENGTH,
  defaultNpcJudgeProfiles,
  parseNpcReviewResponse,
} from "@/lib/ai/npc-review-schema";
import { MockNpcReviewProvider } from "@/lib/ai/npc-review";
import { NPC_JUDGE_COUNT, SEED_NPC_JUDGES } from "@/lib/seed/data";
import { canViewContent, contentIdFromObjectKey, isPublicContentStatus } from "@/server/services/content/access";

describe("SEED_NPC_JUDGES", () => {
  it("defines exactly 10 unique judges", () => {
    expect(SEED_NPC_JUDGES).toHaveLength(10);
    expect(NPC_JUDGE_COUNT).toBe(10);
    const ids = new Set(SEED_NPC_JUDGES.map((j) => j.id));
    const slugs = new Set(SEED_NPC_JUDGES.map((j) => j.slug));
    const countries = new Set(SEED_NPC_JUDGES.map((j) => j.countryCode));
    expect(ids.size).toBe(10);
    expect(slugs.size).toBe(10);
    expect(countries.size).toBe(10);
  });
});

describe("parseNpcReviewResponse", () => {
  const judges = defaultNpcJudgeProfiles();

  it("accepts a complete panel", () => {
    const raw = {
      decisions: judges.map((j, i) => ({
        judgeId: j.id,
        value: i % 2 === 0 ? "LIKE" : "PASS",
        commentJa: `${j.countryNameJa}の視点で評価しました`,
        confidence: 0.8,
      })),
    };
    const parsed = parseNpcReviewResponse(raw, judges);
    expect(parsed).not.toBeNull();
    expect(parsed).toHaveLength(10);
    expect(parsed?.[0].judgeId).toBe(judges[0].id);
  });

  it("rejects missing judges", () => {
    const raw = {
      decisions: judges.slice(0, 9).map((j) => ({
        judgeId: j.id,
        value: "LIKE",
        commentJa: "良い写真",
      })),
    };
    expect(parseNpcReviewResponse(raw, judges)).toBeNull();
  });

  it("rejects duplicate judges", () => {
    const raw = {
      decisions: [
        ...judges.map((j) => ({
          judgeId: j.id,
          value: "LIKE" as const,
          commentJa: "良い",
        })),
        {
          judgeId: judges[0].id,
          value: "PASS" as const,
          commentJa: "重複",
        },
      ],
    };
    expect(parseNpcReviewResponse(raw, judges)).toBeNull();
  });

  it("truncates long comments", () => {
    const long = "あ".repeat(MAX_NPC_COMMENT_LENGTH + 20);
    const raw = {
      decisions: judges.map((j) => ({
        judgeId: j.id,
        value: "LIKE",
        commentJa: long,
      })),
    };
    const parsed = parseNpcReviewResponse(raw, judges);
    expect(parsed?.[0].commentJa.length).toBeLessThanOrEqual(MAX_NPC_COMMENT_LENGTH);
  });
});

describe("MockNpcReviewProvider", () => {
  it("returns a deterministic full panel", async () => {
    const judges = defaultNpcJudgeProfiles();
    const provider = new MockNpcReviewProvider();
    const a = await provider.review(Buffer.from("x"), "image/jpeg", judges);
    const b = await provider.review(Buffer.from("y"), "image/jpeg", judges);
    expect(a.decisions).toHaveLength(10);
    expect(a.decisions.map((d) => d.value)).toEqual(b.decisions.map((d) => d.value));
    expect(a.decisions.filter((d) => d.value === "LIKE")).toHaveLength(5);
    expect(a.decisions.filter((d) => d.value === "PASS")).toHaveLength(5);
  });
});

describe("content access", () => {
  it("treats EXPLORING/ACTIVE as public", () => {
    expect(isPublicContentStatus("EXPLORING")).toBe(true);
    expect(isPublicContentStatus("ACTIVE")).toBe(true);
    expect(isPublicContentStatus("NPC_REVIEWING")).toBe(false);
  });

  it("allows owner and admin to view NPC_REVIEWING", () => {
    expect(
      canViewContent({
        status: "NPC_REVIEWING",
        ownerId: "owner",
        viewerId: "owner",
      }),
    ).toBe(true);
    expect(
      canViewContent({
        status: "NPC_REVIEWING",
        ownerId: "owner",
        viewerId: "admin",
        viewerRole: "ADMIN",
      }),
    ).toBe(true);
    expect(
      canViewContent({
        status: "NPC_REVIEWING",
        ownerId: "owner",
        viewerId: "other",
      }),
    ).toBe(false);
    expect(
      canViewContent({
        status: "NPC_REVIEWING",
        ownerId: "owner",
        viewerId: null,
      }),
    ).toBe(false);
  });

  it("extracts contentId from processed keys", () => {
    expect(contentIdFromObjectKey("processed/clxyz123/medium.webp")).toBe("clxyz123");
    expect(contentIdFromObjectKey("uploads/raw.jpg")).toBeNull();
  });
});
