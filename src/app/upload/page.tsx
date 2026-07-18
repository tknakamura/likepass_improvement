"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { NpcJudgesIntro } from "@/components/npc/npc-judges-intro";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { normalizeImageMimeType } from "@/lib/uploads/mime";

const ERROR_MESSAGES: Record<string, string> = {
  "presign failed": "アップロード準備に失敗しました。ログインし直してください。",
  "upload failed": "画像の保存に失敗しました。",
  "complete failed": "処理の開始に失敗しました。",
  "unsupported type": "JPEG / PNG / WebP のみ対応しています。",
};

export default function UploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    const mimeType = normalizeImageMimeType(file);
    if (!mimeType) {
      setStatus(ERROR_MESSAGES["unsupported type"]);
      return;
    }

    setLoading(true);
    setStatus("アップロード準備中...");

    try {
      const presign = await fetch("/api/uploads/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mimeType,
          fileSize: file.size,
          fileName: file.name,
        }),
      });
      if (!presign.ok) {
        throw new Error("presign failed");
      }
      const presignData = await presign.json();

      if (presignData.serverUpload || presignData.mockMode) {
        setStatus("画像をアップロード中...");
        const form = new FormData();
        form.append("contentId", presignData.contentId);
        form.append("file", file);
        const direct = await fetch("/api/uploads/direct", { method: "POST", body: form });
        if (!direct.ok) {
          throw new Error("upload failed");
        }
      } else if (presignData.uploadUrl) {
        setStatus("画像をアップロード中...");
        const uploadRes = await fetch(presignData.uploadUrl, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": mimeType },
        });
        if (!uploadRes.ok) {
          throw new Error("upload failed");
        }
      } else {
        throw new Error("upload failed");
      }

      setStatus("処理を開始しています...");
      const completeRes = await fetch("/api/uploads/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentId: presignData.contentId }),
      });
      if (!completeRes.ok) {
        throw new Error("complete failed");
      }

      setStatus("完了！世界10カ国の審査員があなたの写真を見に行きます。");
      router.push(`/content/${presignData.contentId}`);
    } catch (err) {
      const key = err instanceof Error ? err.message : "";
      setStatus(ERROR_MESSAGES[key] ?? "アップロードに失敗しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container mx-auto max-w-xl px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle>写真を投稿</CardTitle>
          <CardDescription>
            JPEG / PNG / WebP、最大15MB、1投稿1画像。投稿後すぐに世界の審査員が見てくれます。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpload} className="space-y-4">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              required
            />
            <Button type="submit" className="w-full" disabled={loading || !file}>
              {loading ? "投稿中..." : "投稿する"}
            </Button>
            {status && <p className="text-sm text-[var(--muted-foreground)]">{status}</p>}
          </form>
        </CardContent>
      </Card>
      <NpcJudgesIntro />
    </div>
  );
}
