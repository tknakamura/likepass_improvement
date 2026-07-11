"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export default function TagRankingPage({ params }: { params: Promise<{ tagSlug: string }> }) {
  const [tagSlug, setTagSlug] = useState<string>("");
  const [data, setData] = useState<RankingData | null>(null);

  useEffect(() => {
    params.then((p) => {
      setTagSlug(p.tagSlug);
      fetch(`/api/rankings/${p.tagSlug}`)
        .then((r) => r.json())
        .then(setData);
    });
  }, [params]);

  if (!data) {
    return <div className="container mx-auto px-4 py-16 text-center">読み込み中...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>#{data.tag.slug} ランキング</CardTitle>
          <p className="text-sm text-[var(--muted-foreground)]">
            TOP {data.progress.total} 開放: {data.progress.unlocked} / {data.progress.total}
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.items.slice(0, 20).map((item) => (
            <div key={item.rank} className="flex items-center gap-4 p-2 rounded-lg border border-[var(--border)]">
              <span className="w-8 font-bold text-right">{item.rank}</span>
              {item.isUnlocked && item.content?.imageUrl ? (
                <div className="relative w-16 h-16 rounded overflow-hidden">
                  <Image src={item.content.imageUrl} alt="" fill className="object-cover" unoptimized />
                </div>
              ) : (
                <div className="w-16 h-16 rounded bg-[var(--muted)] flex items-center justify-center text-xs text-center px-1">
                  評価で開放
                </div>
              )}
              {!item.isUnlocked && (
                <Button asChild size="sm" variant="outline">
                  <Link href={`/evaluate?tag=${tagSlug}`}>評価する</Link>
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
