export interface KnownTagHint {
  slug: string;
  category: string;
  displayName?: string;
}

const CATEGORY_GUIDE = `Tag categories (use exactly one per tag):
- SUBJECT: main visible subject (dog, cat, ramen, car, architecture)
- SCENE: setting or place type (street, beach, cafe, mountain)
- STYLE: visual style (minimal, monochrome, cinematic)
- ATTRIBUTE: lighting, color, mood, or era (night, sunset, red, vintage)
- LOCATION: identifiable region or city only when clearly visible (tokyo, kyoto, japan)`;

const SELECTION_RULES = `Selection rules:
- Return 1 to 5 tags that are visually evident in the photo
- Prefer specific, concrete tags over vague ones (use "street" not "urban life")
- Use lowercase single-word English slugs (a-z0-9 only, no spaces or hyphens)
- Normalize synonyms (nighttime -> night, urban -> city, puppy -> dog)
- Do not infer race, religion, sexual orientation, illness, age, or other sensitive attributes
- Do not tag people as identities; tag visible scene/subject/style instead
- Reject or flag explicit sexual content, graphic violence, hate symbols, or illegal activity`;

export function buildImageAnalysisSystemPrompt(): string {
  return `You are an expert photo analyst for LIKEPASS, a photo evaluation app.
Analyze the image and return strict JSON for tagging, quality scoring, and safety moderation.
${CATEGORY_GUIDE}
${SELECTION_RULES}
Quality metrics are 0.0-1.0 floats: blur (higher = more blur), aesthetic (higher = more appealing), textDominance (higher = more text/screenshots).
Safety status must be SAFE, REVIEW_REQUIRED, or REJECTED.`;
}

export function buildImageAnalysisUserPrompt(knownTags: KnownTagHint[] = []): string {
  const knownSection =
    knownTags.length > 0
      ? `\nPrefer these existing canonical tags when they clearly match the image:\n${knownTags
          .slice(0, 40)
          .map((tag) => `- ${tag.slug} (${tag.category})`)
          .join("\n")}\nYou may still propose a new slug if none fit, but only when visually justified.`
      : "";

  return `Analyze this photograph for LIKEPASS.${knownSection}

Return JSON only with this shape:
{
  "tags": [
    { "name": "tokyo", "confidence": 0.96, "category": "LOCATION" },
    { "name": "night", "confidence": 0.91, "category": "ATTRIBUTE" }
  ],
  "quality": { "blur": 0.05, "aesthetic": 0.81, "textDominance": 0.02 },
  "safety": { "status": "SAFE", "reasons": [] },
  "aiGeneratedLikelihood": 0.1
}`;
}
