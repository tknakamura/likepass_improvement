"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface AdminData {
  stats: { pendingReports: number; users: number; contents: number };
  reports: { id: string; reason: string; contentId: string; reporter: string; createdAt: string }[];
}

export default function AdminPage() {
  const [data, setData] = useState<AdminData | null>(null);

  useEffect(() => {
    fetch("/api/admin/reports").then((r) => r.json()).then(setData);
  }, []);

  async function handleReport(reportId: string, action: string) {
    await fetch("/api/admin/reports", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reportId, action }),
    });
    const refreshed = await fetch("/api/admin/reports").then((r) => r.json());
    setData(refreshed);
  }

  if (!data) return <div className="container mx-auto px-4 py-16">読み込み中...</div>;

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">管理画面</h1>
      <div className="grid grid-cols-3 gap-4 text-center">
        <Card><CardContent className="pt-6"><p className="text-2xl font-bold">{data.stats.users}</p><p className="text-sm">ユーザー</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-2xl font-bold">{data.stats.contents}</p><p className="text-sm">投稿</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-2xl font-bold">{data.stats.pendingReports}</p><p className="text-sm">未処理通報</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>通報一覧</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {data.reports.map((r) => (
            <div key={r.id} className="flex items-center justify-between p-3 border border-[var(--border)] rounded-lg text-sm">
              <div>
                <p>{r.reason} — {r.contentId.slice(0, 8)}</p>
                <p className="text-[var(--muted-foreground)]">by {r.reporter}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => handleReport(r.id, "dismiss")}>却下</Button>
                <Button size="sm" variant="destructive" onClick={() => handleReport(r.id, "hide_content")}>非公開</Button>
              </div>
            </div>
          ))}
          {data.reports.length === 0 && <p className="text-[var(--muted-foreground)]">未処理の通報はありません</p>}
        </CardContent>
      </Card>
    </div>
  );
}
