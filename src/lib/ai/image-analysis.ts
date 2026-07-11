import sharp from "sharp";
import {
  type ImageAnalysisResult,
  createReviewRequiredResult,
  parseImageAnalysisResponse,
} from "@/lib/ai/image-analysis-schema";
import {
  buildImageAnalysisSystemPrompt,
  buildImageAnalysisUserPrompt,
  type KnownTagHint,
} from "@/lib/ai/image-analysis-prompt";

export type {
  TagSuggestion,
  ImageQualityMetrics,
  SafetyResult,
  ImageAnalysisResult,
  TagCategory,
} from "@/lib/ai/image-analysis-schema";

export interface ImageAnalysisContext {
  knownTags?: KnownTagHint[];
}

export interface ImageAnalysisProvider {
  analyze(
    imageBuffer: Buffer,
    mimeType: string,
    context?: ImageAnalysisContext,
  ): Promise<ImageAnalysisResult>;
}

const DEFAULT_OPENAI_MODEL = "gpt-4o";
const VISION_MAX_EDGE = 1024;

export class MockImageAnalysisProvider implements ImageAnalysisProvider {
  async analyze(
    _imageBuffer: Buffer,
    _mimeType: string,
    _context?: ImageAnalysisContext,
  ): Promise<ImageAnalysisResult> {
    return {
      tags: [
        { name: "street", confidence: 0.92, category: "SCENE" },
        { name: "night", confidence: 0.88, category: "ATTRIBUTE" },
        { name: "tokyo", confidence: 0.85, category: "LOCATION" },
        { name: "neon", confidence: 0.8, category: "STYLE" },
        { name: "city", confidence: 0.78, category: "SUBJECT" },
      ],
      quality: { blur: 0.05, aesthetic: 0.81, textDominance: 0.02 },
      safety: { status: "SAFE", reasons: [] },
      aiGeneratedLikelihood: 0.1,
    };
  }
}

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

export class OpenAIImageAnalysisProvider implements ImageAnalysisProvider {
  constructor(
    private apiKey: string,
    private model: string = DEFAULT_OPENAI_MODEL,
  ) {}

  async analyze(
    imageBuffer: Buffer,
    mimeType: string,
    context?: ImageAnalysisContext,
  ): Promise<ImageAnalysisResult> {
    if (!this.apiKey) {
      return new MockImageAnalysisProvider().analyze(imageBuffer, mimeType, context);
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
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: buildImageAnalysisSystemPrompt() },
            {
              role: "user",
              content: [
                { type: "text", text: buildImageAnalysisUserPrompt(context?.knownTags) },
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
          max_tokens: 700,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error("[image-analysis] OpenAI API error", response.status, errorBody.slice(0, 500));
        return createReviewRequiredResult("openai_api_error");
      }

      const data = await response.json();
      const text = data.choices?.[0]?.message?.content ?? "";
      const parsed = parseImageAnalysisResponse(extractJsonObject(text));
      if (!parsed) {
        console.error("[image-analysis] Failed to parse OpenAI response", text.slice(0, 500));
        return createReviewRequiredResult("parse_error");
      }

      return parsed;
    } catch (error) {
      console.error("[image-analysis] OpenAI request failed", error);
      return createReviewRequiredResult("openai_request_failed");
    }
  }
}

export function getImageAnalysisProvider(): ImageAnalysisProvider {
  const provider = process.env.IMAGE_AI_PROVIDER ?? "mock";
  if (provider === "openai" && process.env.IMAGE_AI_API_KEY) {
    const model = process.env.IMAGE_AI_MODEL?.trim() || DEFAULT_OPENAI_MODEL;
    return new OpenAIImageAnalysisProvider(process.env.IMAGE_AI_API_KEY, model);
  }
  return new MockImageAnalysisProvider();
}
