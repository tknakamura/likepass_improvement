import { z } from "zod";
import { NPC_JUDGE_COUNT, SEED_NPC_JUDGES } from "@/lib/seed/data";

export const NPC_REVIEW_PROMPT_VERSION = "npc-review-v2-tag-scoped";
export const MAX_NPC_COMMENT_LENGTH = 80;

export type NpcVoteValue = "LIKE" | "PASS";

export interface NpcJudgeProfile {
  id: string;
  slug: string;
  displayName: string;
  countryCode: string;
  countryNameJa: string;
  personaJa: string;
  viewingLensJa: string;
  initials: string;
  sortOrder: number;
}

export interface NpcTagContext {
  id: string;
  slug: string;
  displayName: string;
}

export interface NpcJudgeDecision {
  judgeId: string;
  tagId?: string;
  value: NpcVoteValue;
  commentJa: string;
  confidence: number;
}

export interface NpcReviewResult {
  decisions: NpcJudgeDecision[];
  modelName: string;
  promptVersion: string;
}

export class NpcReviewError extends Error {
  constructor(
    public readonly code:
      | "openai_api_error"
      | "openai_refusal"
      | "empty_response"
      | "parse_error"
      | "incomplete_panel"
      | "openai_request_failed",
    message?: string,
  ) {
    super(message ?? code);
    this.name = "NpcReviewError";
  }
}

const decisionSchema = z.object({
  judgeId: z.string().min(1),
  value: z.enum(["LIKE", "PASS"]),
  commentJa: z.string().min(1).max(200),
  confidence: z.union([z.number(), z.string()]).optional(),
});

const responseSchema = z.object({
  decisions: z.array(decisionSchema).min(1),
});

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  return Math.min(1, Math.max(0, value));
}

function parseConfidence(raw: unknown): number {
  if (typeof raw === "number") return clamp01(raw);
  if (typeof raw === "string") {
    const n = Number(raw);
    if (Number.isFinite(n)) return clamp01(n);
  }
  return 0.7;
}

function normalizeComment(comment: string): string {
  const trimmed = comment.replace(/\s+/g, " ").trim();
  if (trimmed.length <= MAX_NPC_COMMENT_LENGTH) return trimmed;
  return `${trimmed.slice(0, MAX_NPC_COMMENT_LENGTH - 1)}…`;
}

/**
 * Accepts a model response only when every expected judge appears exactly once
 * with a valid LIKE/PASS and a non-empty Japanese comment.
 */
export function parseNpcReviewResponse(
  raw: unknown,
  expectedJudges: NpcJudgeProfile[],
): NpcJudgeDecision[] | null {
  const parsed = responseSchema.safeParse(raw);
  if (!parsed.success) return null;

  const expectedIds = new Set(expectedJudges.map((j) => j.id));
  if (expectedIds.size !== expectedJudges.length) return null;

  const byJudge = new Map<string, NpcJudgeDecision>();
  for (const item of parsed.data.decisions) {
    if (!expectedIds.has(item.judgeId)) continue;
    if (byJudge.has(item.judgeId)) return null;
    const commentJa = normalizeComment(item.commentJa);
    if (!commentJa) return null;
    byJudge.set(item.judgeId, {
      judgeId: item.judgeId,
      value: item.value,
      commentJa,
      confidence: parseConfidence(item.confidence),
    });
  }

  if (byJudge.size !== expectedJudges.length) return null;

  return expectedJudges.map((judge) => byJudge.get(judge.id)!);
}

export function assertCompleteNpcPanel(decisions: NpcJudgeDecision[], expectedCount = NPC_JUDGE_COUNT) {
  if (decisions.length !== expectedCount) {
    throw new NpcReviewError("incomplete_panel", `Expected ${expectedCount} decisions, got ${decisions.length}`);
  }
  const ids = new Set(decisions.map((d) => d.judgeId));
  if (ids.size !== expectedCount) {
    throw new NpcReviewError("incomplete_panel", "Duplicate or missing judge IDs");
  }
}

export function defaultNpcJudgeProfiles(): NpcJudgeProfile[] {
  return SEED_NPC_JUDGES.map((j) => ({ ...j }));
}
