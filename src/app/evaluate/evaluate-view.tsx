"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { Flag, RotateCcw } from "lucide-react";
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
  contextTag: { id: string; slug: string; displayName: string };
}

interface UnlockedRanking {
  tagSlug: string;
  displayName: string;
  rank: number;
}

interface VoteFeedback {
  likeRate: number;
  voteCount: number;
  tagSlug?: string;
  unlockedRankings: UnlockedRanking[];
}

interface LastVote {
  contentId: string;
  sourceTagId: string;
  value: "LIKE" | "PASS";
  undoUntil: number;
}

const TAG_FILTER_STORAGE_KEY = "likepass-eval-tag-slugs";
const SWIPE_THRESHOLD = 72;

export default function EvaluateView() {
  const searchParams = useSearchParams();
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTagSlugs, setSelectedTagSlugs] = useState<Set<string>>(new Set());
  const [tagsReady, setTagsReady] = useState(false);
  const [content, setContent] = useState<EvalContent | null>(null);
  const [feedback, setFeedback] = useState<VoteFeedback | null>(null);
  const [lastVote, setLastVote] = useState<LastVote | null>(null);
  const [undoSecondsLeft, setUndoSecondsLeft] = useState(0);
  const [evaluatedCount, setEvaluatedCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [swipeX, setSwipeX] = useState(0);
  const [sessionId] = useState(() => crypto.randomUUID());
  const [shownAt, setShownAt] = useState<number>(Date.now());
  const touchStartX = useRef(0);
  const votingRef = useRef(false);

  useEffect(() => {
    const stored = localStorage.getItem(TAG_FILTER_STORAGE_KEY);
    const storedSlugs = stored ? (JSON.parse(stored) as string[]) : null;

    const urlSlugs = [
      ...new Set(
        searchParams
          .getAll("tags")
          .flatMap((value) => value.split(","))
          .map((slug) => slug.trim())
          .filter(Boolean)
      ),
    ];

    Promise.all([fetch("/api/tags").then((r) => r.json()), fetch("/api/me/tag-preferences").then((r) => r.json())])
      .then(([tagData, prefData]) => {
        const availableTags: Tag[] = tagData.tags ?? [];
        setTags(availableTags);

        const validSlugs = new Set(availableTags.map((t) => t.slug));
        const preferredSlugs = (prefData.preferences ?? [])
          .map((p: { slug: string }) => p.slug)
          .filter((slug: string) => validSlugs.has(slug));

        const fromUrl = urlSlugs.filter((slug) => validSlugs.has(slug));
        const initial =
          fromUrl.length > 0
            ? fromUrl
            : (storedSlugs?.filter((slug) => validSlugs.has(slug)) ?? preferredSlugs);

        setSelectedTagSlugs(new Set(initial));
        setTagsReady(true);
      })
      .catch(() => setTagsReady(true));
  }, [searchParams]);

  useEffect(() => {
    if (!tagsReady) return;
    localStorage.setItem(TAG_FILTER_STORAGE_KEY, JSON.stringify([...selectedTagSlugs]));
  }, [selectedTagSlugs, tagsReady]);

  const loadNext = useCallback(async () => {
    setLoading(true);
    setFeedback(null);
    setLastVote(null);
    setSwipeX(0);
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

  useEffect(() => {
    if (!lastVote) {
      setUndoSecondsLeft(0);
      return;
    }

    const tick = () => {
      const left = Math.max(0, Math.ceil((lastVote.undoUntil - Date.now()) / 1000));
      setUndoSecondsLeft(left);
      if (left === 0) setLastVote(null);
    };

    tick();
    const id = window.setInterval(tick, 200);
    return () => window.clearInterval(id);
  }, [lastVote]);

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

  const vote = useCallback(
    async (value: "LIKE" | "PASS") => {
      if (!content?.contextTag || votingRef.current) return;
      votingRef.current = true;
      setLoading(true);
      const votedContentId = content.id;
      const sourceTagId = content.contextTag.id;
      const tagSlug = content.contextTag.slug;

      const res = await fetch("/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentId: content.id,
          value,
          sourceTagId,
          sessionId,
          responseTimeMs: Date.now() - shownAt,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setFeedback({
          likeRate: data.result.likeRate,
          voteCount: (data.result.likeCount ?? 0) + (data.result.passCount ?? 0),
          tagSlug: data.result.tag?.slug ?? tagSlug,
          unlockedRankings: data.unlockedRankings ?? [],
        });
        setLastVote({
          contentId: votedContentId,
          sourceTagId,
          value,
          undoUntil: data.vote?.undoUntil ?? Date.now() + 5000,
        });
        refreshEvaluatedCount();
        const delay = data.unlockedRankings?.length > 0 ? 1800 : 1000;
        setTimeout(() => {
          votingRef.current = false;
          loadNext();
        }, delay);
      } else {
        votingRef.current = false;
        setLoading(false);
      }
    },
    [content, sessionId, shownAt, refreshEvaluatedCount, loadNext],
  );

  async function undoVote() {
    if (!lastVote) return;
    setLoading(true);
    const res = await fetch("/api/votes", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contentId: lastVote.contentId,
        sourceTagId: lastVote.sourceTagId,
      }),
    });
    if (res.ok) {
      setLastVote(null);
      setFeedback(null);
      refreshEvaluatedCount();
      await loadNext();
    } else {
      setLoading(false);
    }
  }

  async function reportContent() {
    if (!content) return;
    const confirmed = window.confirm("この写真を通報しますか？");
    if (!confirmed) return;

    await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentId: content.id, reason: "OTHER", description: "evaluate_page" }),
    });
    alert("通報を受け付けました。ありがとうございます。");
  }

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }

  function onTouchMove(e: React.TouchEvent) {
    if (!content?.imageUrl || loading) return;
    setSwipeX(e.touches[0].clientX - touchStartX.current);
  }

  function onTouchEnd() {
    if (swipeX >= SWIPE_THRESHOLD) vote("LIKE");
    else if (swipeX <= -SWIPE_THRESHOLD) vote("PASS");
    setSwipeX(0);
  }

  const filterLabel =
    selectedTagSlugs.size === 0
      ? "すべてのタグ"
      : [...selectedTagSlugs].map((slug) => `#${slug}`).join(" · ");

  const swipeHint =
    swipeX > 20 ? "LIKE" : swipeX < -20 ? "PASS" : null;

  return (
    <div className="container mx-auto px-4 py-8 max-w-lg">
      <div className="mb-4 flex items-center justify-between text-sm">
        {evaluatedCount !== null ? (
          <p className="text-[var(--muted-foreground)] tabular-nums">
            評価済み <span className="font-medium text-[var(--foreground)]">{evaluatedCount}</span> 件
          </p>
        ) : (
          <span />
        )}
        {content && (
          <button
            type="button"
            onClick={reportContent}
            className="inline-flex items-center gap-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            aria-label="通報"
          >
            <Flag className="h-4 w-4" />
            通報
          </button>
        )}
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div
            className="relative aspect-square bg-[var(--muted)] flex items-center justify-center touch-pan-y"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            style={{
              transform: swipeX ? `translateX(${Math.max(-120, Math.min(120, swipeX))}px)` : undefined,
              transition: swipeX === 0 ? "transform 0.2s ease" : undefined,
            }}
          >
            {swipeHint && (
              <span
                className={`absolute top-3 z-20 rounded px-2 py-1 text-xs font-bold ${
                  swipeHint === "LIKE"
                    ? "right-3 bg-[var(--primary)] text-[var(--primary-foreground)]"
                    : "left-3 bg-zinc-700 text-white"
                }`}
              >
                {swipeHint}
              </span>
            )}
            {content?.imageUrl ? (
              <Image src={content.imageUrl} alt="評価対象" fill className="object-contain pointer-events-none" unoptimized />
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

      <p className="mt-2 text-xs text-center text-[var(--muted-foreground)]">
        左右にスワイプ、またはボタンで評価できます
      </p>

      {content?.contextTag && (
        <p className="mt-1 text-sm text-center text-[var(--muted-foreground)]">
          #{content.contextTag.slug} として評価中
        </p>
      )}

      {feedback && (
        <div className="mt-3 space-y-2 text-center">
          <p className="text-sm text-[var(--muted-foreground)]">
            {feedback.tagSlug ? `#${feedback.tagSlug} ` : ""}
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

      {lastVote && undoSecondsLeft > 0 && (
        <div className="mt-3 flex justify-center">
          <Button variant="outline" size="sm" onClick={undoVote} disabled={loading}>
            <RotateCcw className="h-4 w-4" />
            取り消し（{undoSecondsLeft}秒）
          </Button>
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
