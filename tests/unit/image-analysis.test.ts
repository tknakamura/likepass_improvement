import { describe, it, expect } from "vitest";
import {
  clamp01,
  isGenericTagSlug,
  MAX_AI_TAGS,
  normalizeTagSlug,
  parseImageAnalysisResponse,
  parseMetric,
} from "@/lib/ai/image-analysis-schema";

describe("normalizeTagSlug", () => {
  it("lowercases and strips non-alphanumeric characters", () => {
    expect(normalizeTagSlug("#Tokyo")).toBe("tokyo");
    expect(normalizeTagSlug("street-photo")).toBe("streetphoto");
  });

  it("normalizes common synonyms", () => {
    expect(normalizeTagSlug("nighttime")).toBe("night");
    expect(normalizeTagSlug("puppy")).toBe("dog");
    expect(normalizeTagSlug("urban")).toBe("city");
  });
});

describe("isGenericTagSlug", () => {
  it("rejects media-type generic slugs", () => {
    expect(isGenericTagSlug("photo")).toBe(true);
    expect(isGenericTagSlug("image")).toBe(true);
    expect(isGenericTagSlug("picture")).toBe(true);
    expect(isGenericTagSlug("photography")).toBe(true);
    expect(isGenericTagSlug("street")).toBe(false);
  });
});

describe("parseMetric", () => {
  it("clamps values to 0-1", () => {
    expect(parseMetric(1.4, 0.5)).toBe(1);
    expect(parseMetric(-0.2, 0.5)).toBe(0);
    expect(parseMetric("0.82", 0.5)).toBe(0.82);
  });
});

describe("parseImageAnalysisResponse", () => {
  it("parses valid JSON and deduplicates tags", () => {
    const result = parseImageAnalysisResponse({
      tags: [
        { name: "Tokyo", confidence: 0.96, category: "LOCATION" },
        { name: "tokyo", confidence: 0.7, category: "LOCATION" },
        { name: "night", confidence: 0.91, category: "ATTRIBUTE" },
      ],
      quality: { blur: 0.05, aesthetic: 0.81, textDominance: 0.02 },
      safety: { status: "SAFE", reasons: [] },
    });

    expect(result).not.toBeNull();
    expect(result?.tags).toHaveLength(2);
    expect(result?.tags[0]).toEqual({ name: "tokyo", confidence: 0.96, category: "LOCATION" });
    expect(result?.tags[1]).toEqual({ name: "night", confidence: 0.91, category: "ATTRIBUTE" });
    expect(result?.quality.aesthetic).toBe(0.81);
    expect(result?.safety.status).toBe("SAFE");
  });

  it("returns null when no valid tags remain", () => {
    expect(
      parseImageAnalysisResponse({
        tags: [{ name: "#", confidence: 0.9, category: "SCENE" }],
        safety: { status: "SAFE", reasons: [] },
      }),
    ).toBeNull();
  });

  it("returns null when only generic media tags remain", () => {
    expect(
      parseImageAnalysisResponse({
        tags: [
          { name: "photo", confidence: 0.9, category: "SUBJECT" },
          { name: "image", confidence: 0.8, category: "SUBJECT" },
        ],
        safety: { status: "SAFE", reasons: [] },
      }),
    ).toBeNull();
  });

  it("filters out generic tags while keeping content tags", () => {
    const result = parseImageAnalysisResponse({
      tags: [
        { name: "photo", confidence: 0.99, category: "SUBJECT" },
        { name: "street", confidence: 0.9, category: "SCENE" },
        { name: "night", confidence: 0.88, category: "ATTRIBUTE" },
      ],
      safety: { status: "SAFE", reasons: [] },
    });

    expect(result?.tags).toHaveLength(2);
    expect(result?.tags.map((t) => t.name)).toEqual(["street", "night"]);
  });

  it(`limits tags to ${MAX_AI_TAGS}`, () => {
    const result = parseImageAnalysisResponse({
      tags: [
        { name: "street", confidence: 0.9, category: "SCENE" },
        { name: "night", confidence: 0.89, category: "ATTRIBUTE" },
        { name: "tokyo", confidence: 0.88, category: "LOCATION" },
        { name: "neon", confidence: 0.87, category: "STYLE" },
        { name: "city", confidence: 0.86, category: "SUBJECT" },
        { name: "dog", confidence: 0.85, category: "SUBJECT" },
      ],
      safety: { status: "SAFE", reasons: [] },
    });

    expect(result?.tags).toHaveLength(MAX_AI_TAGS);
  });
});

describe("clamp01", () => {
  it("handles non-finite values", () => {
    expect(clamp01(Number.NaN)).toBe(0);
    expect(clamp01(Number.POSITIVE_INFINITY)).toBe(0);
  });
});
