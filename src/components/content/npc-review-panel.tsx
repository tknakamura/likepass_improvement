"use client";

import { useCallback, useEffect, useState } from "react";
import { NpcJudgeAvatar } from "@/components/npc/npc-judge-avatar";
import { NPC_JUDGE_COUNT } from "@/lib/seed/data";

type NpcDecision = {
  judgeId: string;
  value: "LIKE" | "PASS";
  commentJa: string;
  confidence: number | null;
  judge: {
    displayName: string;
    countryCode: string;
    countryNameJa: string;
    initials: string;
  };
};

type StatusPayload = {
  status: string;
  npcReview: {
    total: number;
    completed: number;
    likeCount: number;
    passCount: number;
    decisions: NpcDecision[];
  };
  votes: {
    likeCount: number;
    passCount: number;
    voteCount: number;
    likeRate: number;
    humanLikeCount: number;
    humanPassCount: number;
    npcLikeCount: number;
    npcPassCount: number;
  };
};

export function NpcReviewPanel({
  contentId,
  initialStatus,
  isOwner,
}: {
  contentId: string;
  initialStatus: string;
  isOwner: boolean;
}) {
  const [data, setData] = useState<StatusPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isOwner) return;
    const res = await fetch(`/api/uploads/${contentId}/status`);
    if (!res.ok) {
      setError("審査状況を取得できませんでした");
      return;
    }
    const json = (await res.json()) as StatusPayload;
    setData(json);
    setError(null);
  }, [contentId, isOwner]);

  useEffect(() => {
    if (!isOwner) return;
    void load();
  }, [isOwner, load]);

  useEffect(() => {
    if (!isOwner) return;
    const status = data?.status ?? initialStatus;
    if (status !== "NPC_REVIEWING" && status !== "PROCESSING" && status !== "UPLOADING") {
      return;
    }
    const id = window.setInterval(() => {
      void load();
    }, 2500);
    return () => window.clearInterval(id);
  }, [data?.status, initialStatus, isOwner, load]);

  if (!isOwner) return null;

  const status = data?.status ?? initialStatus;
  const completed = data?.npcReview.completed ?? 0;
  const total = data?.npcReview.total ?? NPC_JUDGE_COUNT;
  const decisions = data?.npcReview.decisions ?? [];
  const votes = data?.votes;

  return (
    <section className="mt-6 space-y-3 rounded-xl border border-[var(--border)] p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">世界の審査員パネル</h2>
        {(status === "NPC_REVIEWING" || status === "PROCESSING" || status === "UPLOADING") && (
          <span className="text-xs text-[var(--muted-foreground)]">
            {status === "NPC_REVIEWING" ? `${completed}/${total} 完了` : "準備中..."}
          </span>
        )}
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      {(status === "NPC_REVIEWING" || status === "PROCESSING" || status === "UPLOADING") && (
        <div className="space-y-2">
          <div className="h-2 overflow-hidden rounded-full bg-[var(--muted)]">
            <div
              className="h-full bg-[var(--primary)] transition-all"
              style={{
                width: `${status === "NPC_REVIEWING" ? Math.round((completed / total) * 100) : 10}%`,
              }}
            />
          </div>
          <p className="text-xs text-[var(--muted-foreground)]">
            {status === "NPC_REVIEWING"
              ? "主要10カ国の審査員がLIKE / PASSを判定しています..."
              : "画像処理のあと、NPC審査が始まります"}
          </p>
        </div>
      )}

      {votes && votes.voteCount > 0 && (
        <p className="text-xs text-[var(--muted-foreground)]">
          合計 LIKE率 {(votes.likeRate * 100).toFixed(1)}% · {votes.voteCount} 票
          （NPC {votes.npcLikeCount}LIKE / {votes.npcPassCount}PASS · 人間{" "}
          {votes.humanLikeCount}LIKE / {votes.humanPassCount}PASS）
        </p>
      )}

      {decisions.length > 0 && (
        <ul className="space-y-2">
          {decisions.map((d) => (
            <li
              key={d.judgeId}
              className="flex gap-3 rounded-lg bg-[var(--muted)]/40 p-3"
            >
              <NpcJudgeAvatar
                countryCode={d.judge.countryCode}
                initials={d.judge.initials}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{d.judge.displayName}</span>
                  <span className="text-xs text-[var(--muted-foreground)]">
                    {d.judge.countryNameJa}
                  </span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                      d.value === "LIKE"
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                        : "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300"
                    }`}
                  >
                    {d.value}
                  </span>
                </div>
                <p className="mt-1 text-sm text-[var(--foreground)]/90">{d.commentJa}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
