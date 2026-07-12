"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface AdminData {
  stats: { pendingReports: number; users: number; contents: number };
  reports: { id: string; reason: string; contentId: string; reporter: string; createdAt: string }[];
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<AdminData | null>(null);

  useEffect(() => {
    fetch("/api/admin/reports").then((r) => r.json()).then(setData);
  }, []);

  if (!data) return <p>読み込み中...</p>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4 text-center">
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-bold">{data.stats.users}</p>
            <p className="text-sm">ユーザー</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-bold">{data.stats.contents}</p>
            <p className="text-sm">投稿</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-bold">{data.stats.pendingReports}</p>
            <p className="text-sm">未処理通報</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>直近の未処理通報</CardTitle>
        </CardHeader>
        <CardContent>
          {data.reports.slice(0, 5).map((r) => (
            <p key={r.id} className="text-sm py-1 border-b border-[var(--border)] last:border-0">
              {r.reason} — {r.contentId.slice(0, 8)}（{r.reporter}）
            </p>
          ))}
          {data.reports.length === 0 && <p className="text-sm text-[var(--muted-foreground)]">未処理の通報はありません</p>}
        </CardContent>
      </Card>
    </div>
  );
}
