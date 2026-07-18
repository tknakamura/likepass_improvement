import { cn } from "@/lib/utils";

const FLAG_EMOJI: Record<string, string> = {
  US: "🇺🇸",
  CN: "🇨🇳",
  IN: "🇮🇳",
  JP: "🇯🇵",
  DE: "🇩🇪",
  GB: "🇬🇧",
  FR: "🇫🇷",
  BR: "🇧🇷",
  ID: "🇮🇩",
  MX: "🇲🇽",
};

export function NpcJudgeAvatar({
  countryCode,
  initials,
  className,
}: {
  countryCode: string;
  initials: string;
  className?: string;
}) {
  const flag = FLAG_EMOJI[countryCode] ?? "🏳️";

  return (
    <div
      className={cn(
        "relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--muted)] text-sm font-semibold",
        className,
      )}
      aria-hidden
    >
      <span>{initials.slice(0, 2)}</span>
      <span className="absolute -bottom-0.5 -right-0.5 text-base leading-none drop-shadow-sm">
        {flag}
      </span>
    </div>
  );
}

export function countryFlagEmoji(countryCode: string): string {
  return FLAG_EMOJI[countryCode] ?? "🏳️";
}
