import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ClipboardList, Heart, Images, Settings, Upload } from "lucide-react";

export default async function MePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const [posts, votes, likes] = await Promise.all([
    prisma.content.count({ where: { userId: session.user.id, status: { not: "DELETED" } } }),
    prisma.vote.count({ where: { userId: session.user.id } }),
    prisma.vote.count({ where: { userId: session.user.id, value: "LIKE" } }),
  ]);

  const username = session.user.username ?? "user";
  const initials = username.slice(0, 2).toUpperCase();

  const menuItems = [
    {
      href: "/me/posts",
      label: "自分の投稿",
      description: `${posts} 件`,
      icon: Images,
    },
    {
      href: "/me/likes",
      label: "LIKEした画像",
      description: `${likes} 件`,
      icon: Heart,
    },
    {
      href: "/me/votes",
      label: "評価履歴",
      description: `${votes} 件`,
      icon: ClipboardList,
    },
    {
      href: "/me/settings",
      label: "設定",
      description: "アカウント",
      icon: Settings,
    },
  ] as const;

  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl space-y-6">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            {session.user.image ? (
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full border border-[var(--border)]">
                <Image
                  src={session.user.image}
                  alt=""
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
            ) : (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[var(--muted)] text-lg font-semibold text-[var(--muted-foreground)]">
                {initials}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-lg font-bold truncate">@{username}</p>
              {session.user.email && (
                <p className="text-sm text-[var(--muted-foreground)] truncate">{session.user.email}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="pt-5 pb-5 text-center">
            <p className="text-2xl font-bold tabular-nums">{posts}</p>
            <p className="text-sm text-[var(--muted-foreground)] mt-1">投稿</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-5 text-center">
            <p className="text-2xl font-bold tabular-nums">{votes}</p>
            <p className="text-sm text-[var(--muted-foreground)] mt-1">評価</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button asChild size="lg" className="w-full">
          <Link href="/evaluate">
            <Heart className="h-4 w-4" />
            評価を続ける
          </Link>
        </Button>
        <Button asChild variant="outline" size="lg" className="w-full">
          <Link href="/upload">
            <Upload className="h-4 w-4" />
            投稿する
          </Link>
        </Button>
      </div>

      <nav className="grid gap-3">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}>
              <Card className="hover:bg-[var(--muted)] transition-colors">
                <CardContent className="py-4 flex items-center gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--muted)]">
                    <Icon className="h-5 w-5 text-[var(--foreground)]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{item.label}</p>
                    <p className="text-sm text-[var(--muted-foreground)]">{item.description}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
