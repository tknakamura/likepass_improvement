import { describe, it, expect, vi, beforeEach } from "vitest";
import { NPC_JUDGE_COUNT, SEED_NPC_JUDGES } from "@/lib/seed/data";
import { MockNpcReviewProvider } from "@/lib/ai/npc-review";

const contentUpdate = vi.fn();
const npcUpsert = vi.fn();
const npcCount = vi.fn();
const contentTagUpdateMany = vi.fn();
const contentTagFindMany = vi.fn();
const contentFindUnique = vi.fn();
const npcJudgeFindMany = vi.fn();
const transaction = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    content: {
      findUnique: (...args: unknown[]) => contentFindUnique(...args),
      update: (...args: unknown[]) => contentUpdate(...args),
    },
    npcJudge: {
      findMany: (...args: unknown[]) => npcJudgeFindMany(...args),
    },
    npcEvaluation: {
      count: (...args: unknown[]) => npcCount(...args),
      upsert: (...args: unknown[]) => npcUpsert(...args),
    },
    contentTag: {
      updateMany: (...args: unknown[]) => contentTagUpdateMany(...args),
      findMany: (...args: unknown[]) => contentTagFindMany(...args),
    },
    $transaction: (fn: (tx: unknown) => Promise<unknown>) => transaction(fn),
  },
}));

vi.mock("@/lib/r2", () => ({
  getObjectBuffer: vi.fn(async () => Buffer.from("fake-image")),
}));

vi.mock("@/lib/local-images", () => ({
  readLocalImage: vi.fn(async () => null),
}));

vi.mock("@/lib/ai/npc-review", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ai/npc-review")>("@/lib/ai/npc-review");
  return {
    ...actual,
    getNpcReviewProvider: () => new actual.MockNpcReviewProvider(),
  };
});

vi.mock("@/server/services/content/aggregates", () => ({
  recomputeVoteAggregates: vi.fn(async () => ({
    likeCount: 5,
    passCount: 5,
    voteCount: 10,
  })),
  recalculateTagRanking: vi.fn(async () => undefined),
}));

describe("runNpcReview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    npcJudgeFindMany.mockResolvedValue(SEED_NPC_JUDGES.map((j) => ({ ...j, active: true })));
    contentTagFindMany.mockResolvedValue([{ tagId: "tag1" }]);
    contentTagUpdateMany.mockResolvedValue({ count: 1 });
    npcUpsert.mockResolvedValue({});
    contentUpdate.mockResolvedValue({});
    transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        npcEvaluation: {
          upsert: npcUpsert,
          count: async () => NPC_JUDGE_COUNT,
        },
        content: { update: contentUpdate },
        contentTag: { updateMany: contentTagUpdateMany },
      };
      return fn(tx);
    });
  });

  it("persists 10 decisions and publishes to EXPLORING", async () => {
    contentFindUnique
      .mockResolvedValueOnce({
        id: "c1",
        status: "NPC_REVIEWING",
        aiSafetyStatus: "SAFE",
        publishedAt: null,
        mediumObjectKey: "processed/c1/medium.webp",
        largeObjectKey: null,
        originalObjectKey: null,
        mimeType: "image/jpeg",
      })
      .mockResolvedValueOnce({
        id: "c1",
        mediumObjectKey: "processed/c1/medium.webp",
        largeObjectKey: null,
        originalObjectKey: null,
        mimeType: "image/jpeg",
      });
    npcCount.mockResolvedValueOnce(0);

    const { runNpcReview } = await import("@/server/services/npc/review");
    await runNpcReview("c1");

    expect(npcUpsert).toHaveBeenCalledTimes(NPC_JUDGE_COUNT);
    expect(contentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "c1" },
        data: expect.objectContaining({ status: "EXPLORING" }),
      }),
    );
  });

  it("is a no-op when already published with a full panel", async () => {
    contentFindUnique.mockResolvedValueOnce({
      id: "c1",
      status: "EXPLORING",
      aiSafetyStatus: "SAFE",
      publishedAt: new Date(),
    });
    npcCount.mockResolvedValueOnce(NPC_JUDGE_COUNT);

    const { runNpcReview } = await import("@/server/services/npc/review");
    await runNpcReview("c1");

    expect(npcUpsert).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });

  it("does not publish when status is not NPC_REVIEWING", async () => {
    contentFindUnique.mockResolvedValueOnce({
      id: "c1",
      status: "PROCESSING",
      aiSafetyStatus: "SAFE",
      publishedAt: null,
    });
    npcCount.mockResolvedValueOnce(0);

    const { runNpcReview } = await import("@/server/services/npc/review");
    await runNpcReview("c1");

    expect(transaction).not.toHaveBeenCalled();
  });
});

describe("MockNpcReviewProvider uniqueness", () => {
  it("covers every seeded judge id exactly once", async () => {
    const provider = new MockNpcReviewProvider();
    const result = await provider.review(Buffer.from("x"), "image/jpeg", SEED_NPC_JUDGES);
    const ids = result.decisions.map((d) => d.judgeId).sort();
    expect(ids).toEqual([...SEED_NPC_JUDGES.map((j) => j.id)].sort());
  });
});
