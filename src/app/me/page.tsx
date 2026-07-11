import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function MePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const [posts, votes] = await Promise.all([
    prisma.content.count({ where: { userId: session.user.id, status: { not: "DELETED" } } }),
    prisma.vote.count({ where: { userId: session.user.id } }),
  ]);

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>@{session.user.username ?? "user"}</CardTitle>
          <p className="text-sm text-[var(--muted-foreground)]">{session.user.email}</p>
        </CardHeader>
        <CardContent className="flex gap-6 text-sm">
          <div>
            <p className="font-bold text-lg">{posts}</p>
            <p className="text-[var(--muted-foreground)]">投稿</p>
          </div>
          <div>
            <p className="font-bold text-lg">{votes}</p>
            <p className="text-[var(--muted-foreground)]">評価</p>
          </div>
        </CardContent>
      </Card>

      <nav className="flex flex-wrap gap-3">
        <Link href="/me/posts" className="underline text-sm">自分の投稿</Link>
        <Link href="/me/votes" className="underline text-sm">評価履歴</Link>
        <Link href="/me/settings" className="underline text-sm">設定</Link>
      </nav>
    </div>
  );
}
