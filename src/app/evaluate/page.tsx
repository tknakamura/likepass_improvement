"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface Tag {
  id: string;
  slug: string;
  displayName: string;
}

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

const TAG_FILTER_STORAGE_KEY = "likepass-eval-tag-slugs";

export default function EvaluatePage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTagSlugs, setSelectedTagSlugs] = useState<Set<string>>(new Set());
  const [tagsReady, setTagsReady] = useState(false);
  const [content, setContent] = useState<EvalContent | null>(null);
  const [feedback, setFeedback] = useState<VoteFeedback | null>(null);
  const [evaluatedCount, setEvaluatedCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(() => crypto.randomUUID());
  const [shownAt, setShownAt] = useState<number>(Date.now());

  useEffect(() => {
    const stored = localStorage.getItem(TAG_FILTER_STORAGE_KEY);
    const storedSlugs = stored ? (JSON.parse(stored) as string[]) : null;

    Promise.all([fetch("/api/tags").then((r) => r.json()), fetch("/api/me/tag-preferences").then((r) => r.json())])
      .then(([tagData, prefData]) => {
        const availableTags: Tag[] = tagData.tags ?? [];
        setTags(availableTags);

        const validSlugs = new Set(availableTags.map((t) => t.slug));
        const preferredSlugs = (prefData.preferences ?? [])
          .map((p: { slug: string }) => p.slug)
          .filter((slug: string) => validSlugs.has(slug));

        const initial =
          storedSlugs?.filter((slug) => validSlugs.has(slug)) ??
          preferredSlugs;

        setSelectedTagSlugs(new Set(initial));
        setTagsReady(true);
      })
      .catch(() => setTagsReady(true));
  }, []);

  useEffect(() => {
    if (!tagsReady) return;
    localStorage.setItem(TAG_FILTER_STORAGE_KEY, JSON.stringify([...selectedTagSlugs]));
  }, [selectedTagSlugs, tagsReady]);

  const loadNext = useCallback(async () => {
    setLoading(true);
    setFeedback(null);
    const params = new URLSearchParams({ sessionId });
    for (const slug of selectedTagSlugs) {
      params.append("tags", slug);
    }
    const res = await fetch(`/api/evaluation/next?${params}`);
    const data = await res.json();
    setContent(data.content);
    setShownAt(Date.now());
    setLoading(false);
  }, [sessionId, selectedTagSlugs]);

  useEffect(() => {
    if (!tagsReady) return;
    loadNext();
  }, [loadNext, tagsReady]);

  const refreshEvaluatedCount = useCallback(() => {
    fetch("/api/me/stats")
      .then((r) => r.json())
      .then((d) => setEvaluatedCount(d.evaluatedCount ?? 0))
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshEvaluatedCount();
  }, [refreshEvaluatedCount]);

  function toggleTag(slug: string) {
    setSelectedTagSlugs((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  function clearTags() {
    setSelectedTagSlugs(new Set());
  }

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

  const filterLabel =
    selectedTagSlugs.size === 0
      ? "すべてのタグ"
      : [...selectedTagSlugs].map((slug) => `#${slug}`).join(" · ");

  return (
    <div className="container mx-auto px-4 py-8 max-w-lg">
      {evaluatedCount !== null && (
        <p className="mb-4 text-sm text-right text-[var(--muted-foreground)] tabular-nums">
          評価済み <span className="font-medium text-[var(--foreground)]">{evaluatedCount}</span> 件
        </p>
      )}

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="relative aspect-square bg-[var(--muted)] flex items-center justify-center">
            {content?.imageUrl ? (
              <Image src={content.imageUrl} alt="評価対象" fill className="object-contain" unoptimized />
            ) : (
              <p className="text-[var(--muted-foreground)] px-4 text-center">
                {loading
                  ? "読み込み中..."
                  : selectedTagSlugs.size > 0
                    ? "選択したタグで評価できる写真がありません。下のタグを変えるか「すべて」を選んでください。"
                    : "評価できる写真がありません"}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {content?.contextTag && (
        <p className="mt-2 text-sm text-center text-[var(--muted-foreground)]">
          #{content.contextTag.slug} の写真を評価中
        </p>
      )}

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

      <div className="mt-8 pt-6 border-t border-[var(--border)] space-y-3">
        <p className="text-sm font-medium">評価するタグ</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={clearTags}
            className={`px-3 py-1 rounded-full text-sm border ${
              selectedTagSlugs.size === 0
                ? "bg-[var(--primary)] text-[var(--primary-foreground)] border-transparent"
                : "border-[var(--border)]"
            }`}
          >
            すべて
          </button>
          {tags.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onClick={() => toggleTag(tag.slug)}
              className={`px-3 py-1 rounded-full text-sm border ${
                selectedTagSlugs.has(tag.slug)
                  ? "bg-[var(--primary)] text-[var(--primary-foreground)] border-transparent"
                  : "border-[var(--border)]"
              }`}
            >
              #{tag.slug}
            </button>
          ))}
        </div>
        <p className="text-xs text-[var(--muted-foreground)]">
          {selectedTagSlugs.size === 0
            ? "タグ未選択 — すべてのタグから評価します"
            : `${selectedTagSlugs.size}件選択中 — ${filterLabel} の写真を優先して表示`}
        </p>
      </div>
    </div>
  );
}
