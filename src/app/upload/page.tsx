"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function UploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setStatus("アップロード準備中...");

    try {
      const presign = await fetch("/api/uploads/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mimeType: file.type, fileSize: file.size }),
      });
      if (!presign.ok) {
        throw new Error("presign failed");
      }
      const presignData = await presign.json();

      if (presignData.uploadUrl) {
        setStatus("画像をアップロード中...");
        const uploadRes = await fetch(presignData.uploadUrl, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type },
        });
        if (!uploadRes.ok) {
          throw new Error("r2 upload failed");
        }
      } else if (presignData.mockMode) {
        setStatus("画像を保存中...");
        const form = new FormData();
        form.append("contentId", presignData.contentId);
        form.append("file", file);
        const direct = await fetch("/api/uploads/direct", { method: "POST", body: form });
        if (!direct.ok) {
          throw new Error("direct upload failed");
        }
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

      setStatus("完了！AIがタグを付与中です。");
      router.push(`/content/${presignData.contentId}`);
    } catch {
      setStatus("アップロードに失敗しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container mx-auto px-4 py-16 max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>写真を投稿</CardTitle>
          <CardDescription>JPEG / PNG / WebP、最大15MB、1投稿1画像</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpload} className="space-y-4">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
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
    </div>
  );
}
