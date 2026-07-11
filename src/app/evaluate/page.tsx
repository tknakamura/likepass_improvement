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

interface UnlockedRanking {
  tagSlug: string;
  displayName: string;
  rank: number;
}

interface VoteFeedback {
  likeRate: number;
  voteCount: number;
  unlockedRankings: UnlockedRanking[];
}

export default function EvaluatePage() {
  const [content, setContent] = useState<EvalContent | null>(null);
  const [feedback, setFeedback] = useState<VoteFeedback | null>(null);
  const [evaluatedCount, setEvaluatedCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(() => crypto.randomUUID());
  const [shownAt, setShownAt] = useState<number>(Date.now());

  const loadNext = useCallback(async () => {
    setLoading(true);
    setFeedback(null);
    const params = new URLSearchParams({ sessionId });
    const res = await fetch(`/api/evaluation/next?${params}`);
    const data = await res.json();
    setContent(data.content);
    setShownAt(Date.now());
    setLoading(false);
  }, [sessionId]);

  useEffect(() => {
    loadNext();
  }, [loadNext]);

  const refreshEvaluatedCount = useCallback(() => {
    fetch("/api/me/stats")
      .then((r) => r.json())
      .then((d) => setEvaluatedCount(d.evaluatedCount ?? 0))
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshEvaluatedCount();
  }, [refreshEvaluatedCount]);

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
      setFeedback({
        likeRate: data.result.likeRate,
        voteCount: (data.result.likeCount ?? 0) + (data.result.passCount ?? 0),
        unlockedRankings: data.unlockedRankings ?? [],
      });
      refreshEvaluatedCount();
      const delay = data.unlockedRankings?.length > 0 ? 1800 : 1000;
      setTimeout(() => loadNext(), delay);
    } else {
      setLoading(false);
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-lg">
      <div className="flex items-center justify-between mb-4 text-sm">
        {content?.contextTag ? (
          <p className="text-[var(--muted-foreground)]">#{content.contextTag.slug} の写真を評価中</p>
        ) : (
          <span />
        )}
        {evaluatedCount !== null && (
          <p className="text-[var(--muted-foreground)] tabular-nums">
            評価済み <span className="font-medium text-[var(--foreground)]">{evaluatedCount}</span> 件
          </p>
        )}
      </div>

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

      {feedback && (
        <div className="mt-3 space-y-2 text-center">
          <p className="text-sm text-[var(--muted-foreground)]">
            LIKE率 {(feedback.likeRate * 100).toFixed(1)}% · {feedback.voteCount} 票
          </p>
          {feedback.unlockedRankings.length > 0 && (
            <div className="rounded-lg bg-[var(--primary)]/10 border border-[var(--primary)]/30 px-3 py-2 space-y-1">
              {feedback.unlockedRankings.map((u) => (
                <p key={`${u.tagSlug}-${u.rank}`} className="text-sm font-medium text-[var(--primary)]">
                  #{u.tagSlug} {u.rank}位が開放！
                </p>
              ))}
            </div>
          )}
        </div>
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
