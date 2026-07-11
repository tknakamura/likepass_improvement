"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface EvalContent {
  id: string;
  imageUrl: string | null;
  contextTag: { id: string; slug: string; displayName: string } | null;
}

export default function EvaluatePage() {
  const [content, setContent] = useState<EvalContent | null>(null);
  const [result, setResult] = useState<{ likeRate: number; voteCount: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(() => crypto.randomUUID());
  const [shownAt, setShownAt] = useState<number>(Date.now());

  const loadNext = useCallback(async (tagSlug?: string) => {
    setLoading(true);
    setResult(null);
    const params = new URLSearchParams({ sessionId });
    if (tagSlug) params.set("tagSlug", tagSlug);
    const res = await fetch(`/api/evaluation/next?${params}`);
    const data = await res.json();
    setContent(data.content);
    setShownAt(Date.now());
    setLoading(false);
  }, [sessionId]);

  useEffect(() => {
    loadNext();
  }, [loadNext]);

  async function vote(value: "LIKE" | "PASS") {
    if (!content) return;
    setLoading(true);
    const res = await fetch("/api/votes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contentId: content.id,
        value,
        sourceTagId: content.contextTag?.id,
        sessionId,
        responseTimeMs: Date.now() - shownAt,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setResult({
        likeRate: data.result.likeRate,
        voteCount: (data.result.likeCount ?? 0) + (data.result.passCount ?? 0),
      });
      setTimeout(() => loadNext(), 1000);
    } else {
      setLoading(false);
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-lg">
      {content?.contextTag && (
        <p className="text-center text-sm text-[var(--muted-foreground)] mb-4">
          #{content.contextTag.slug} の写真を評価中
        </p>
      )}

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="relative aspect-square bg-[var(--muted)] flex items-center justify-center">
            {content?.imageUrl ? (
              <Image src={content.imageUrl} alt="評価対象" fill className="object-contain" unoptimized />
            ) : (
              <p className="text-[var(--muted-foreground)]">{loading ? "読み込み中..." : "評価できる写真がありません"}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {result && (
        <p className="text-center text-sm mt-2 text-[var(--muted-foreground)]">
          LIKE率 {(result.likeRate * 100).toFixed(1)}% · {result.voteCount} 票
        </p>
      )}

      <div className="flex gap-4 mt-6 justify-center">
        <Button variant="outline" size="lg" disabled={!content || loading} onClick={() => vote("PASS")}>
          PASS
        </Button>
        <Button size="lg" disabled={!content || loading} onClick={() => vote("LIKE")}>
          LIKE
        </Button>
      </div>
    </div>
  );
}
