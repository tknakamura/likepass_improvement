import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  const votes = await prisma.vote.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: {
      content: {
        include: { contentTags: { include: { tag: true }, where: { status: "ACTIVE" }, take: 1 } },
      },
    },
  });

  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl">
      <h1 className="text-xl font-bold mb-4">通知</h1>
      <p className="text-sm text-[var(--muted-foreground)] mb-6">最近の評価アクティビティ</p>

      <div className="space-y-2">
        {votes.length === 0 ? (
          <p className="text-sm text-center text-[var(--muted-foreground)] py-12">通知はまだありません</p>
        ) : (
          votes.map((vote) => {
            const tagSlug = vote.content.contentTags[0]?.tag.slug;
            return (
              <div key={vote.id} className="p-3 border border-[var(--border)] rounded-lg text-sm">
                <p>
                  {vote.value === "LIKE" ? "LIKE" : "PASS"} しました
                  {tagSlug ? ` (#${tagSlug})` : ""}
                </p>
                {tagSlug && (
                  <Link href={`/ranking/${tagSlug}`} className="text-[var(--primary)] text-xs mt-1 inline-block">
                    ランキングを見る
                  </Link>
                )}
                <p className="text-xs text-[var(--muted-foreground)] mt-1">
                  {vote.createdAt.toLocaleString("ja-JP")}
                </p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
