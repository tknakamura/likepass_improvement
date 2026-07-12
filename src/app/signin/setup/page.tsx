"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";

export default function SetupPage() {
  const router = useRouter();
  const { update } = useSession();
  const [username, setUsername] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/me/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          termsAccepted,
          privacyAccepted,
          ageConfirmed,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "設定に失敗しました");
        return;
      }

      await update();
      router.push("/onboarding");
      router.refresh();
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container mx-auto px-4 py-16 max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>プロフィール設定</CardTitle>
          <CardDescription>初回登録のため、ユーザー名と規約への同意が必要です。</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">ユーザー名</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="likepass_user"
                pattern="[a-zA-Z0-9_]{3,20}"
                required
              />
              <p className="text-xs text-[var(--muted-foreground)]">3〜20文字、英数字とアンダースコア</p>
            </div>

            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="mt-1"
                required
              />
              <span>
                <a href="/terms" className="underline" target="_blank">利用規約</a>
                に同意します
              </span>
            </label>

            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={privacyAccepted}
                onChange={(e) => setPrivacyAccepted(e.target.checked)}
                className="mt-1"
                required
              />
              <span>
                <a href="/privacy" className="underline" target="_blank">プライバシーポリシー</a>
                に同意します
              </span>
            </label>

            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={ageConfirmed}
                onChange={(e) => setAgeConfirmed(e.target.checked)}
                className="mt-1"
                required
              />
              <span>18歳以上であることを確認します</span>
            </label>

            {error && <p className="text-sm text-[var(--destructive)]">{error}</p>}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "保存中..." : "続ける"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
