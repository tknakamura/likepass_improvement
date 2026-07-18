import type { ContentStatus } from "@prisma/client";

export const CONTENT_STATUS_LABELS: Record<ContentStatus, string> = {
  UPLOADING: "アップロード中",
  PROCESSING: "処理中",
  NPC_REVIEWING: "NPC審査中",
  REVIEW_REQUIRED: "審査待ち",
  EXPLORING: "探索中",
  ACTIVE: "配信中",
  DORMANT: "配信停止",
  REJECTED: "非承認",
  DELETED: "削除済み",
};

export function getContentStatusLabel(status: ContentStatus): string {
  return CONTENT_STATUS_LABELS[status] ?? status;
}

export function getContentStatusHint(status: ContentStatus): string | null {
  if (status === "DORMANT") return "現在、ランキング対象外";
  if (status === "EXPLORING") return "評価を集めています";
  if (status === "NPC_REVIEWING") return "世界の審査員が評価中です";
  if (status === "PROCESSING" || status === "UPLOADING") return "公開まで少々お待ちください";
  if (status === "REVIEW_REQUIRED") return "公開準備中（再処理待ち）";
  return null;
}

/** Statuses that must not appear in the public evaluation queue. */
export const NON_PUBLIC_CONTENT_STATUSES: ContentStatus[] = [
  "UPLOADING",
  "PROCESSING",
  "NPC_REVIEWING",
  "REVIEW_REQUIRED",
  "REJECTED",
  "DELETED",
  "DORMANT",
];
