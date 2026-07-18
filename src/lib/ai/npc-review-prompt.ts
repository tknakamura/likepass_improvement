import type { NpcJudgeProfile } from "@/lib/ai/npc-review-schema";
import { MAX_NPC_COMMENT_LENGTH, NPC_REVIEW_PROMPT_VERSION } from "@/lib/ai/npc-review-schema";

export function buildNpcReviewSystemPrompt(): string {
  return [
    "あなたは写真評価パネルの司会です。",
    "各国の審査員ペルソナに基づき、写真全体の好み（構図・光・主題・雰囲気）だけで LIKE または PASS を判定してください。",
    "各審査員は他の審査員の票やコメントを参照せず、各自の鑑賞軸だけで独立に判定してください。",
    "文化的ステレオタイプ、国籍差別、外見への偏見、政治的・宗教的判断は禁止です。",
    "人物の容姿を断定したり、センシティブな属性を推測したりしないでください。",
    `各コメントは日本語で${MAX_NPC_COMMENT_LENGTH}文字以内の短い一文にしてください。`,
    "必ず指定された審査員全員について、ちょうど1件ずつ判定してください。",
    "JSONオブジェクトのみを返してください。",
    `promptVersion: ${NPC_REVIEW_PROMPT_VERSION}`,
  ].join("\n");
}

export function buildNpcReviewUserPrompt(judges: NpcJudgeProfile[]): string {
  const panel = judges
    .map(
      (j) =>
        `- id: ${j.id}\n  name: ${j.displayName}\n  country: ${j.countryNameJa} (${j.countryCode})\n  persona: ${j.personaJa}\n  lens: ${j.viewingLensJa}`,
    )
    .join("\n");

  return [
    "以下の審査員パネルで、この写真全体を評価してください。",
    "タグごとの評価ではなく、写真そのものへの LIKE / PASS です。",
    "",
    "審査員:",
    panel,
    "",
    "出力形式:",
    "{",
    '  "decisions": [',
    '    { "judgeId": "<id>", "value": "LIKE" | "PASS", "commentJa": "<短い日本語コメント>", "confidence": 0.0-1.0 }',
    "  ]",
    "}",
    "",
    `decisions は ${judges.length} 件ちょうどで、judgeId は上記 id と一致させてください。`,
  ].join("\n");
}
