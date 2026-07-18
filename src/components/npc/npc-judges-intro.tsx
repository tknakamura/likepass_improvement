import { NpcJudgeAvatar } from "@/components/npc/npc-judge-avatar";
import { SEED_NPC_JUDGES } from "@/lib/seed/data";

const STEPS = [
  {
    label: "投稿",
    description: "写真を1枚アップロード",
  },
  {
    label: "世界の目線",
    description: "10カ国の審査員がLIKE / PASSと一言コメント",
  },
  {
    label: "みんなへ公開",
    description: "そのまま評価キューへ。ランキングの初速になります",
  },
] as const;

export function NpcJudgesIntro() {
  const judges = [...SEED_NPC_JUDGES].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <section className="mt-8 space-y-5 rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--primary)]">
          世界の審査員パネル
        </p>
        <h2 className="text-lg font-semibold leading-snug">
          投稿すると、世界10カ国の審査員がまっさきに見てくれます
        </h2>
        <p className="text-sm leading-relaxed text-[var(--muted-foreground)]">
          批評家ではなく、世界の目線で最初に感想をくれる10人です。NPCの票はあなたの写真の初速になり、ランキングのスタートを後押しします。
        </p>
        <div className="flex flex-wrap gap-2 pt-1" aria-hidden>
          {judges.map((judge) => (
            <NpcJudgeAvatar
              key={judge.id}
              countryCode={judge.countryCode}
              initials={judge.initials}
              className="h-9 w-9 text-xs"
            />
          ))}
        </div>
      </div>

      <ol className="grid gap-3 sm:grid-cols-3">
        {STEPS.map((step, index) => (
          <li
            key={step.label}
            className="rounded-lg bg-[var(--muted)]/50 px-3 py-3"
          >
            <p className="text-xs font-semibold text-[var(--primary)]">
              {index + 1}. {step.label}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-[var(--muted-foreground)]">
              {step.description}
            </p>
          </li>
        ))}
      </ol>

      <p className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs leading-relaxed text-emerald-800 dark:text-emerald-200">
        PASSがついても公開されます。感じ方の違いを知るヒントです。すべての票があなたの写真を前に進めてくれます。
      </p>

      <details className="group rounded-lg border border-[var(--border)] open:bg-[var(--muted)]/20">
        <summary className="cursor-pointer list-none px-3 py-3 text-sm font-medium marker:content-none [&::-webkit-details-marker]:hidden">
          <span className="flex items-center justify-between gap-2">
            審査員を見る（10人）
            <span className="text-xs text-[var(--muted-foreground)] group-open:hidden">
              開く
            </span>
            <span className="hidden text-xs text-[var(--muted-foreground)] group-open:inline">
              閉じる
            </span>
          </span>
        </summary>
        <ul className="grid gap-2 px-3 pb-3 sm:grid-cols-2">
          {judges.map((judge) => (
            <li
              key={judge.id}
              className="flex gap-3 rounded-lg bg-[var(--background)] p-3"
            >
              <NpcJudgeAvatar
                countryCode={judge.countryCode}
                initials={judge.initials}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="text-sm font-medium">{judge.displayName}</span>
                  <span className="text-xs text-[var(--muted-foreground)]">
                    {judge.countryNameJa}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-[var(--muted-foreground)]">
                  見るポイント: {judge.viewingLensJa}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
