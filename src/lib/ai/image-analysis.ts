export interface TagSuggestion {
  name: string;
  confidence: number;
  category: "SUBJECT" | "SCENE" | "STYLE" | "ATTRIBUTE" | "LOCATION";
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

export interface ImageAnalysisProvider {
  analyze(imageBuffer: Buffer, mimeType: string): Promise<ImageAnalysisResult>;
}

export class MockImageAnalysisProvider implements ImageAnalysisProvider {
  async analyze(_imageBuffer: Buffer, _mimeType: string): Promise<ImageAnalysisResult> {
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

export class OpenAIImageAnalysisProvider implements ImageAnalysisProvider {
  constructor(private apiKey: string) {}

  async analyze(imageBuffer: Buffer, mimeType: string): Promise<ImageAnalysisResult> {
    if (!this.apiKey) {
      return new MockImageAnalysisProvider().analyze(imageBuffer, mimeType);
    }

    const base64 = imageBuffer.toString("base64");
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: 'Analyze this image. Return JSON only: {"tags":[{"name":"slug","confidence":0.9,"category":"SCENE"}],"quality":{"blur":0.1,"aesthetic":0.8,"textDominance":0.02},"safety":{"status":"SAFE","reasons":[]}}. Max 5 tags, lowercase slugs, no sensitive attributes.',
              },
              {
                type: "image_url",
                image_url: { url: `data:${mimeType};base64,${base64}` },
              },
            ],
          },
        ],
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      return new MockImageAnalysisProvider().analyze(imageBuffer, mimeType);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content ?? "{}";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch?.[0] ?? "{}");
    return {
      tags: (parsed.tags ?? []).slice(0, 5),
      quality: parsed.quality ?? { blur: 0, aesthetic: 0.5, textDominance: 0 },
      safety: parsed.safety ?? { status: "REVIEW_REQUIRED", reasons: ["parse_error"] },
    };
  }
}

export function getImageAnalysisProvider(): ImageAnalysisProvider {
  const provider = process.env.IMAGE_AI_PROVIDER ?? "mock";
  if (provider === "openai" && process.env.IMAGE_AI_API_KEY) {
    return new OpenAIImageAnalysisProvider(process.env.IMAGE_AI_API_KEY);
  }
  return new MockImageAnalysisProvider();
}
