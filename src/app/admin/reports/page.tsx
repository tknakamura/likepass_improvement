"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

interface ReportRow {
  id: string;
  reason: string;
  contentId: string;
  reporter: string;
  createdAt: string;
}

export default function AdminReportsPage() {
  const [reports, setReports] = useState<ReportRow[]>([]);

  useEffect(() => {
    fetch("/api/admin/reports")
      .then((r) => r.json())
      .then((d) => setReports(d.reports ?? []));
  }, []);

  async function handleReport(reportId: string, action: string) {
    await fetch("/api/admin/reports", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reportId, action }),
    });
    const refreshed = await fetch("/api/admin/reports").then((r) => r.json());
    setReports(refreshed.reports ?? []);
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">通報一覧</h2>
      {reports.map((r) => (
        <div key={r.id} className="flex items-center justify-between p-3 border border-[var(--border)] rounded-lg text-sm">
          <div>
            <p>{r.reason} — {r.contentId.slice(0, 8)}</p>
            <p className="text-[var(--muted-foreground)]">by {r.reporter}</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => handleReport(r.id, "dismiss")}>
              却下
            </Button>
            <Button size="sm" variant="destructive" onClick={() => handleReport(r.id, "hide_content")}>
              非公開
            </Button>
          </div>
        </div>
      ))}
      {reports.length === 0 && <p className="text-sm text-[var(--muted-foreground)]">未処理の通報はありません</p>}
    </div>
  );
}
