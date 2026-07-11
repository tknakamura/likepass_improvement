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

interface RankingData {
  tag: { slug: string; displayName: string };
  items: RankingItem[];
  progress: { unlocked: number; total: number };
}

const DISPLAY_LIMIT = 50;

export default function TagRankingPage({ params }: { params: Promise<{ tagSlug: string }> }) {
  const [data, setData] = useState<RankingData | null>(null);

  useEffect(() => {
    params.then((p) => {
      fetch(`/api/rankings/${p.tagSlug}`)
        .then((r) => r.json())
        .then(setData);
    });
  }, [params]);

  if (!data) {
    return <div className="container mx-auto px-2 py-8 text-center text-sm">読み込み中...</div>;
  }

  const items = data.items.slice(0, DISPLAY_LIMIT);
  const remaining = data.progress.total - data.progress.unlocked;

  return (
    <div className="container mx-auto px-2 py-4 max-w-6xl">
      <div className="mb-4 px-2">
        <h1 className="text-xl font-bold">#{data.tag.slug}</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          開放 {data.progress.unlocked} / {data.progress.total}
          {remaining > 0 && ` · あと${remaining}枚`}
        </p>
        <p className="text-xs text-[var(--muted-foreground)] mt-1">
          ランキングを埋めるには、評価画面でランダムに表示される写真を LIKE / PASS し続けてください。
        </p>
      </div>

      <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
        {items.map((item) => (
          <div
            key={item.rank}
            className="relative aspect-square rounded-md overflow-hidden border border-[var(--border)] bg-[var(--card)]"
          >
            <span className="absolute top-0.5 left-0.5 z-10 text-[10px] font-bold bg-black/60 text-white px-1 rounded">
              {item.rank}
            </span>
            {item.isUnlocked && item.content?.imageUrl ? (
              <Image
                src={item.content.imageUrl}
                alt={`${item.rank}位`}
                fill
                className="object-cover"
                unoptimized
                sizes="20vw"
              />
            ) : (
              <div className="absolute inset-0 bg-[var(--muted)] flex items-center justify-center p-1">
                <span className="text-[9px] sm:text-[10px] text-center text-[var(--muted-foreground)] leading-tight">
                  評価で開放
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {data.progress.unlocked < data.progress.total && (
        <div className="mt-6 px-2 text-center">
          <Button asChild size="lg" className="w-full max-w-md">
            <Link href="/evaluate">ランダム評価を続ける</Link>
          </Button>
          <p className="text-xs text-[var(--muted-foreground)] mt-2">
            順位を指定して評価することはできません
          </p>
        </div>
      )}
    </div>
  );
}
