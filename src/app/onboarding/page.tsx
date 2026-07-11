"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface Tag {
  id: string;
  slug: string;
  displayName: string;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [tags, setTags] = useState<Tag[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/tags")
      .then((r) => r.json())
      .then((data) => setTags(data.tags ?? []));
  }, []);

  function toggleTag(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 10) next.add(id);
      return next;
    });
  }

  async function completeOnboarding() {
    setLoading(true);
    await fetch("/api/me/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tagIds: Array.from(selected) }),
    });
    router.push("/evaluate");
    router.refresh();
  }

  const steps = [
    {
      title: "LIKEPASSへようこそ",
      body: "LIKEは「このランキングに残したい」、PASSは「今回は見送る」です。PASSは攻撃ではなく品質向上への投票です。",
    },
    {
      title: "興味のあるタグを選択",
      body: "3〜10個のタグを選んでください。評価キューに反映されます。",
    },
  ];

  return (
    <div className="container mx-auto px-4 py-16 max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle>{steps[step].title}</CardTitle>
          <CardDescription>{steps[step].body}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === 0 && (
            <Button className="w-full" onClick={() => setStep(1)}>
              次へ
            </Button>
          )}
          {step === 1 && (
            <>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                    className={`px-3 py-1 rounded-full text-sm border ${
                      selected.has(tag.id)
                        ? "bg-[var(--primary)] text-[var(--primary-foreground)] border-transparent"
                        : "border-[var(--border)]"
                    }`}
                  >
                    #{tag.slug}
                  </button>
                ))}
              </div>
              <p className="text-sm text-[var(--muted-foreground)]">{selected.size}/10 選択中（最低3個）</p>
              <Button
                className="w-full"
                disabled={selected.size < 3 || loading}
                onClick={completeOnboarding}
              >
                {loading ? "完了中..." : "評価を始める"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
