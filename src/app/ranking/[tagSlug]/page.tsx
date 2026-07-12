"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";

interface RankingItem {
  rank: number;
  isUnlocked: boolean;
  content: { id: string; imageUrl: string } | null;
}

interface ProgressBuckets {
  top10: { unlocked: number; total: number };
  top50: { unlocked: number; total: number };
  top100: { unlocked: number; total: number };
}

interface RankingData {
  tag: { slug: string; displayName: string };
  period: string;
  items: RankingItem[];
  progress: { unlocked: number; total: number };
}

const PERIODS = [
  { key: "ALL_TIME", label: "全期間" },
  { key: "WEEKLY", label: "週間" },
  { key: "DAILY", label: "今日" },
] as const;

const DISPLAY_LIMIT = 100;

export default function TagRankingPage({ params }: { params: Promise<{ tagSlug: string }> }) {
  const [tagSlug, setTagSlug] = useState<string | null>(null);
  const [period, setPeriod] = useState<(typeof PERIODS)[number]["key"]>("ALL_TIME");
  const [data, setData] = useState<RankingData | null>(null);
  const [buckets, setBuckets] = useState<ProgressBuckets | null>(null);

  useEffect(() => {
    params.then((p) => setTagSlug(p.tagSlug));
  }, [params]);

  useEffect(() => {
    if (!tagSlug) return;
    fetch(`/api/rankings/${tagSlug}?period=${period}`)
      .then((r) => r.json())
      .then(setData);
    fetch(`/api/rankings/${tagSlug}/progress`)
      .then((r) => r.json())
      .then(setBuckets)
      .catch(() => setBuckets(null));
  }, [tagSlug, period]);

  if (!data) {
    return <div className="container mx-auto px-4 py-8 text-center text-sm max-w-2xl">読み込み中...</div>;
  }

  const items = data.items.slice(0, DISPLAY_LIMIT);
  const remaining = data.progress.total - data.progress.unlocked;
  const top10Remaining = buckets ? Math.max(0, buckets.top10.total - buckets.top10.unlocked) : null;

  return (
    <div className="container mx-auto px-4 py-4 max-w-2xl">
      <div className="mb-4 sticky top-0 z-20 bg-[var(--background)] py-2 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-xl font-bold">#{data.tag.slug}</h1>
          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href={`/evaluate?tags=${encodeURIComponent(data.tag.slug)}`}>評価する</Link>
            </Button>
            <div className="flex gap-1">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setPeriod(p.key)}
                className={`px-2 py-1 rounded text-xs border ${
                  period === p.key
                    ? "bg-[var(--primary)] text-[var(--primary-foreground)] border-transparent"
                    : "border-[var(--border)]"
                }`}
              >
                {p.label}
              </button>
            ))}
            </div>
          </div>
        </div>
        <p className="text-sm text-[var(--muted-foreground)]">
          開放 {data.progress.unlocked} / {data.progress.total}
          {remaining > 0 && ` · あと${remaining}枚`}
        </p>
        {buckets && (
          <div className="text-xs text-[var(--muted-foreground)] space-y-0.5">
            <p>
              TOP 10: {buckets.top10.unlocked}/{buckets.top10.total}
              {top10Remaining !== null && top10Remaining > 0 && ` · あと${top10Remaining}枚でTOP 10をすべて開放`}
            </p>
            <p>
              TOP 50: {buckets.top50.unlocked}/{buckets.top50.total} · TOP 100: {buckets.top100.unlocked}/
              {buckets.top100.total}
            </p>
          </div>
        )}
        <p className="text-xs text-[var(--muted-foreground)]">
          ランキングを埋めるには、評価画面でランダムに表示される写真を LIKE / PASS し続けてください。
        </p>
      </div>

      <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
        {items.map((item) => (
          <div
            key={item.rank}
            className="relative aspect-square rounded overflow-hidden border border-[var(--border)]"
          >
            <span className="absolute top-0.5 left-0.5 z-10 text-[10px] font-bold bg-black/50 text-white px-1 rounded">
              {item.rank}
            </span>
            {item.isUnlocked && item.content?.imageUrl ? (
              <Image
                src={item.content.imageUrl}
                alt={`${item.rank}位`}
                fill
                className="object-cover"
                unoptimized
                sizes="33vw"
              />
            ) : (
              <div className="absolute inset-0 bg-zinc-300 dark:bg-zinc-700 flex items-center justify-center">
                <span className="text-[9px] text-zinc-600 dark:text-zinc-300 px-1 text-center">評価で開放</span>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 text-center pb-8">
        <Button asChild size="lg" className="w-full max-w-md">
          <Link href={`/evaluate?tags=${encodeURIComponent(data.tag.slug)}`}>
            #{data.tag.slug} を評価する
          </Link>
        </Button>
        <p className="text-xs text-[var(--muted-foreground)] mt-2">
          順位を指定して評価することはできません
        </p>
      </div>
    </div>
  );
}
