"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MeSubpageHeader } from "@/components/me/me-subpage-header";

export default function SettingsPage() {
  const [message, setMessage] = useState("");

  async function deleteAccount(deletePosts: boolean) {
    const res = await fetch("/api/me/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deletePosts }),
    });
    if (res.ok) {
      window.location.href = "/";
    } else {
      setMessage("退会処理に失敗しました");
    }
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl space-y-4">
      <MeSubpageHeader title="設定" />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">退会</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-[var(--muted-foreground)]">
            アカウントを削除します。評価データは匿名化して保持される場合があります。
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="destructive" size="sm" onClick={() => deleteAccount(true)}>
              投稿も削除して退会
            </Button>
            <Button variant="outline" size="sm" onClick={() => deleteAccount(false)}>
              投稿を残して退会
            </Button>
          </div>
          {message && <p className="text-sm text-[var(--destructive)]">{message}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
