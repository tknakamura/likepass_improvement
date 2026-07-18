import sharp from "sharp";
import {
  assertCompleteNpcPanel,
  defaultNpcJudgeProfiles,
  NPC_REVIEW_PROMPT_VERSION,
  NpcReviewError,
  parseNpcReviewResponse,
  type NpcJudgeProfile,
  type NpcReviewResult,
} from "@/lib/ai/npc-review-schema";
import { buildNpcReviewSystemPrompt, buildNpcReviewUserPrompt } from "@/lib/ai/npc-review-prompt";

export type { NpcJudgeProfile, NpcReviewResult, NpcJudgeDecision, NpcVoteValue } from "@/lib/ai/npc-review-schema";
export { NpcReviewError, NPC_REVIEW_PROMPT_VERSION, parseNpcReviewResponse } from "@/lib/ai/npc-review-schema";

export interface NpcReviewProvider {
  review(
    imageBuffer: Buffer,
    mimeType: string,
    judges: NpcJudgeProfile[],
  ): Promise<NpcReviewResult>;
}

const DEFAULT_OPENAI_MODEL = "gpt-4o";
const VISION_MAX_EDGE = 1024;

async function prepareVisionImage(imageBuffer: Buffer): Promise<{ buffer: Buffer; mimeType: string }> {
  const metadata = await sharp(imageBuffer).metadata();
  const width = metadata.width ?? VISION_MAX_EDGE;
  const height = metadata.height ?? VISION_MAX_EDGE;
  const needsResize = width > VISION_MAX_EDGE || height > VISION_MAX_EDGE;

  if (!needsResize && metadata.format === "jpeg") {
    return { buffer: imageBuffer, mimeType: "image/jpeg" };
  }

  const resized = await sharp(imageBuffer)
    .rotate()
    .resize(VISION_MAX_EDGE, VISION_MAX_EDGE, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();

  return { buffer: resized, mimeType: "image/jpeg" };
}

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
      try {
        return JSON.parse(fenced[1].trim());
      } catch {
        // fall through
      }
    }

    const objectMatch = trimmed.match(/\{[\s\S]*\}/);
    if (!objectMatch) return null;

    try {
      return JSON.parse(objectMatch[0]);
    } catch {
      return null;
    }
  }
}

/** Deterministic mock: alternate LIKE/PASS by sort order for stable tests. */
export class MockNpcReviewProvider implements NpcReviewProvider {
  async review(
    _imageBuffer: Buffer,
    _mimeType: string,
    judges: NpcJudgeProfile[],
  ): Promise<NpcReviewResult> {
    const sorted = [...judges].sort((a, b) => a.sortOrder - b.sortOrder);
    const decisions = sorted.map((judge, index) => {
      const like = index % 2 === 0;
      const value = like ? ("LIKE" as const) : ("PASS" as const);
      return {
        judgeId: judge.id,
        value,
        commentJa: like
          ? `${judge.countryNameJa}視点で、${judge.viewingLensJa.split("、")[0]}が良い。`
          : `${judge.countryNameJa}視点では、もう少し印象が欲しい。`,
        confidence: like ? 0.82 : 0.74,
      };
    });
    assertCompleteNpcPanel(decisions, judges.length);
    return {
      decisions,
      modelName: "mock-npc-review",
      promptVersion: NPC_REVIEW_PROMPT_VERSION,
    };
  }
}

export class OpenAINpcReviewProvider implements NpcReviewProvider {
  constructor(
    private apiKey: string,
    private model: string = DEFAULT_OPENAI_MODEL,
  ) {}

  async review(
    imageBuffer: Buffer,
    mimeType: string,
    judges: NpcJudgeProfile[],
  ): Promise<NpcReviewResult> {
    if (!this.apiKey) {
      return new MockNpcReviewProvider().review(imageBuffer, mimeType, judges);
    }

    try {
      const visionImage = await prepareVisionImage(imageBuffer);
      const base64 = visionImage.buffer.toString("base64");
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          temperature: 0.35,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: buildNpcReviewSystemPrompt() },
            {
              role: "user",
              content: [
                { type: "text", text: buildNpcReviewUserPrompt(judges) },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${visionImage.mimeType};base64,${base64}`,
                    detail: "high",
                  },
                },
              ],
            },
          ],
          max_tokens: 1600,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error("[npc-review] OpenAI API error", response.status, errorBody.slice(0, 500));
        throw new NpcReviewError("openai_api_error", `OpenAI API returned ${response.status}`);
      }

      const data = await response.json();
      const message = data.choices?.[0]?.message;
      const text = message?.content ?? "";

      if (message?.refusal) {
        console.warn("[npc-review] OpenAI refusal:", message.refusal);
        throw new NpcReviewError("openai_refusal", String(message.refusal));
      }

      if (!text.trim()) {
        throw new NpcReviewError("empty_response");
      }

      const raw = extractJsonObject(text);
      const decisions = parseNpcReviewResponse(raw, judges);
      if (!decisions) {
        console.warn("[npc-review] Unparseable or incomplete response:", text.slice(0, 400));
        throw new NpcReviewError("parse_error");
      }

      assertCompleteNpcPanel(decisions, judges.length);

      return {
        decisions,
        modelName: this.model,
        promptVersion: NPC_REVIEW_PROMPT_VERSION,
      };
    } catch (error) {
      if (error instanceof NpcReviewError) throw error;
      console.error("[npc-review] OpenAI request failed", error);
      throw new NpcReviewError(
        "openai_request_failed",
        error instanceof Error ? error.message : "Unknown OpenAI request error",
      );
    }
  }
}

export function getNpcReviewProvider(): NpcReviewProvider {
  const provider = process.env.IMAGE_AI_PROVIDER ?? "mock";
  if (provider === "openai" && process.env.IMAGE_AI_API_KEY) {
    const model = process.env.IMAGE_AI_MODEL?.trim() || DEFAULT_OPENAI_MODEL;
    return new OpenAINpcReviewProvider(process.env.IMAGE_AI_API_KEY, model);
  }
  return new MockNpcReviewProvider();
}

export { defaultNpcJudgeProfiles };
