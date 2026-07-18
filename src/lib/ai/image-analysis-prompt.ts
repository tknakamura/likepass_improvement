export interface KnownTagHint {
  slug: string;
  category: string;
  displayName?: string;
}

const CATEGORY_GUIDE = `Tag categories (use exactly one per tag):
- SUBJECT: main visible subject (person, child, baby, family, portrait, dog, cat, food, car)
- SCENE: setting or place type (street, beach, cafe, mountain, interior)
- STYLE: visual style (minimal, monochrome, cinematic)
- ATTRIBUTE: lighting, color, mood, or era (night, sunset, red, vintage)
- LOCATION: identifiable region or city only when clearly visible (tokyo, kyoto, japan)`;

const SELECTION_RULES = `Selection rules:
- Return 1 to 3 tags that describe what is visually evident in the photograph
- You MUST return at least 1 content tag; never return an empty tags array
- Always tag the primary visible subject first. When a person is the main subject, use a generic subject tag such as portrait, people, child, baby, or family
- Secondary scene/style/attribute tags are optional and must not replace the primary subject
- Tag the photo's content (subject, scene, style, attribute, location) — not the medium itself
- NEVER use generic media-type tags such as: photo, image, picture, photography, pic, snapshot, shot
- Prefer specific, concrete tags over vague ones (use "street" not "urban life")
- Use lowercase single-word English slugs (a-z0-9 only, no spaces or hyphens)
- Normalize synonyms (nighttime -> night, urban -> city, puppy -> dog, toddler -> child)
- Do not identify specific individuals or infer race, religion, sexual orientation, illness, or exact age
- Generic subject tags for people (portrait, people, child, baby, family) ARE allowed
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
      ? `\nYou may reuse these existing tags when they clearly match, but always prioritize the actual primary subject; propose a new slug when none fit:\n${knownTags
          .slice(0, 40)
          .map((tag) => `- ${tag.slug} (${tag.category})`)
          .join("\n")}`
      : "";

  return `Analyze this photograph for LIKEPASS. Return up to 3 content tags, with the primary subject first.${knownSection}

Return JSON only with this shape:
{
  "tags": [
    { "name": "child", "confidence": 0.96, "category": "SUBJECT" },
    { "name": "interior", "confidence": 0.8, "category": "SCENE" }
  ],
  "quality": { "blur": 0.05, "aesthetic": 0.81, "textDominance": 0.02 },
  "safety": { "status": "SAFE", "reasons": [] },
  "aiGeneratedLikelihood": 0.1
}`;
}
