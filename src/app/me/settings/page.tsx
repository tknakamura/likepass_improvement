"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
    <div className="container mx-auto px-4 py-8 max-w-md space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>設定</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h2 className="font-medium mb-2">退会</h2>
            <p className="text-sm text-[var(--muted-foreground)] mb-3">
              アカウントを削除します。評価データは匿名化して保持される場合があります。
            </p>
            <div className="flex gap-2">
              <Button variant="destructive" size="sm" onClick={() => deleteAccount(true)}>
                投稿も削除して退会
              </Button>
              <Button variant="outline" size="sm" onClick={() => deleteAccount(false)}>
                投稿を残して退会
              </Button>
            </div>
            {message && <p className="text-sm text-[var(--destructive)] mt-2">{message}</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
