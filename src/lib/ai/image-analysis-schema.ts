import { z } from "zod";

export const TAG_CATEGORIES = ["SUBJECT", "SCENE", "STYLE", "ATTRIBUTE", "LOCATION"] as const;
export type TagCategory = (typeof TAG_CATEGORIES)[number];

export const MAX_AI_TAGS = 3;

/** Media-type / generic slugs that never describe photo content. */
export const GENERIC_TAG_SLUGS = new Set([
  "photo",
  "image",
  "picture",
  "photography",
  "pic",
  "pics",
  "snapshot",
  "shot",
  "photograph",
  "foto",
  "img",
]);

export interface TagSuggestion {
  name: string;
  confidence: number;
  category: TagCategory;
}

export interface ImageQualityMetrics {
  blur: number;
  aesthetic: number;
  textDominance: number;
}

export interface SafetyResult {
  status: "SAFE" | "REVIEW_REQUIRED" | "REJECTED";
  reasons: string[];
}

export interface ImageAnalysisResult {
  tags: TagSuggestion[];
  quality: ImageQualityMetrics;
  safety: SafetyResult;
  aiGeneratedLikelihood?: number;
}

const TAG_SYNONYMS: Record<string, string> = {
  nighttime: "night",
  evening: "night",
  urban: "city",
  cities: "city",
  town: "city",
  streets: "street",
  roadway: "street",
  monochrome: "monochrome",
  blackandwhite: "monochrome",
  bw: "monochrome",
  minimalist: "minimal",
  puppy: "dog",
  kitten: "cat",
  seaside: "beach",
  ocean: "beach",
  coast: "beach",
  // People / portrait subjects
  kid: "child",
  kids: "child",
  toddler: "child",
  children: "child",
  infant: "baby",
  newborn: "baby",
  persons: "people",
  human: "people",
  humans: "people",
  person: "people",
  selfie: "portrait",
  portraits: "portrait",
};

const rawTagSchema = z.object({
  name: z.union([z.string(), z.number()]).transform(String),
  confidence: z.union([z.number(), z.string()]).optional(),
  category: z.string().optional(),
});

const rawAnalysisSchema = z.object({
  tags: z.array(rawTagSchema).optional(),
  quality: z
    .object({
      blur: z.union([z.number(), z.string()]).optional(),
      aesthetic: z.union([z.number(), z.string()]).optional(),
      textDominance: z.union([z.number(), z.string()]).optional(),
    })
    .optional(),
  safety: z
    .object({
      status: z.string().optional(),
      reasons: z.array(z.string()).optional(),
    })
    .optional(),
  aiGeneratedLikelihood: z.union([z.number(), z.string()]).optional(),
});

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function parseMetric(value: unknown, fallback: number): number {
  const num = typeof value === "string" ? Number.parseFloat(value) : Number(value);
  return clamp01(Number.isFinite(num) ? num : fallback);
}

export function normalizeTagSlug(name: string): string {
  const compact = name
    .trim()
    .toLowerCase()
    .replace(/[#\s_]+/g, "")
    .replace(/[^a-z0-9]/g, "");

  if (!compact) return "";
  return TAG_SYNONYMS[compact] ?? compact;
}

export function isGenericTagSlug(slug: string): boolean {
  return GENERIC_TAG_SLUGS.has(slug);
}

function normalizeCategory(value: string | undefined): TagCategory {
  const upper = (value ?? "SUBJECT").trim().toUpperCase();
  if ((TAG_CATEGORIES as readonly string[]).includes(upper)) {
    return upper as TagCategory;
  }

  const aliases: Record<string, TagCategory> = {
    SUBJECT: "SUBJECT",
    MAIN: "SUBJECT",
    OBJECT: "SUBJECT",
    SCENE: "SCENE",
    PLACE: "SCENE",
    SETTING: "SCENE",
    STYLE: "STYLE",
    MOOD: "STYLE",
    ATTRIBUTE: "ATTRIBUTE",
    QUALITY: "ATTRIBUTE",
    LOCATION: "LOCATION",
    REGION: "LOCATION",
    GEO: "LOCATION",
  };

  return aliases[upper] ?? "SUBJECT";
}

function normalizeSafetyStatus(value: string | undefined): SafetyResult["status"] {
  const upper = (value ?? "SAFE").trim().toUpperCase();
  if (upper === "SAFE" || upper === "REVIEW_REQUIRED" || upper === "REJECTED") {
    return upper;
  }
  return "SAFE";
}

function dedupeTags(tags: TagSuggestion[]): TagSuggestion[] {
  const bySlug = new Map<string, TagSuggestion>();
  for (const tag of tags) {
    const slug = normalizeTagSlug(tag.name);
    if (!slug || isGenericTagSlug(slug)) continue;
    const normalized = { ...tag, name: slug };
    const existing = bySlug.get(slug);
    if (!existing || normalized.confidence > existing.confidence) {
      bySlug.set(slug, normalized);
    }
  }
  return [...bySlug.values()].sort((a, b) => b.confidence - a.confidence);
}

export function parseImageAnalysisResponse(raw: unknown): ImageAnalysisResult | null {
  const parsed = rawAnalysisSchema.safeParse(raw);
  if (!parsed.success) return null;

  const tags = dedupeTags(
    (parsed.data.tags ?? [])
      .map((tag) => {
        const slug = normalizeTagSlug(tag.name);
        if (!slug || slug.length < 2 || isGenericTagSlug(slug)) return null;
        return {
          name: slug,
          confidence: clamp01(parseMetric(tag.confidence, 0.7)),
          category: normalizeCategory(tag.category),
        };
      })
      .filter((tag): tag is TagSuggestion => tag !== null),
  ).slice(0, MAX_AI_TAGS);

  if (tags.length === 0) {
    console.warn("[image-analysis] OpenAI returned zero usable content tags");
    return null;
  }

  const quality = parsed.data.quality ?? {};
  const safety = parsed.data.safety ?? {};

  return {
    tags,
    quality: {
      blur: parseMetric(quality.blur, 0.1),
      aesthetic: parseMetric(quality.aesthetic, 0.5),
      textDominance: parseMetric(quality.textDominance, 0.02),
    },
    safety: {
      status: normalizeSafetyStatus(safety.status),
      reasons: safety.reasons ?? [],
    },
    aiGeneratedLikelihood: parseMetric(parsed.data.aiGeneratedLikelihood, 0.1),
  };
}

export class ImageAnalysisError extends Error {
  constructor(
    public readonly reason: string,
    message?: string,
  ) {
    super(message ?? `Image analysis failed: ${reason}`);
    this.name = "ImageAnalysisError";
  }
}
