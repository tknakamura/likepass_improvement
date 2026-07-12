import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import { MeSubpageHeader } from "@/components/me/me-subpage-header";

export default async function MeVotesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const votes = await prisma.vote.findMany({
    where: { userId: session.user.id },
    include: { content: { include: { contentTags: { include: { tag: true } } } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl">
      <MeSubpageHeader title="評価履歴" />
      <p className="text-sm text-[var(--muted-foreground)] mb-4">
        LIKE した画像は
        <Link href="/me/likes" className="text-[var(--primary)] underline mx-1">
          LIKEした画像
        </Link>
        から一覧できます
      </p>
      <div className="space-y-2">
        {votes.length === 0 ? (
          <p className="text-sm text-center text-[var(--muted-foreground)] py-12">まだ評価がありません</p>
        ) : (
          votes.map((vote) => (
            <div key={vote.id} className="flex justify-between p-3 border border-[var(--border)] rounded-lg text-sm">
              <span>
                {vote.content.contentTags.map((ct) => `#${ct.tag.slug}`).join(" ") || vote.contentId.slice(0, 8)}
              </span>
              <span className={vote.value === "LIKE" ? "text-[var(--primary)] font-medium" : "text-[var(--muted-foreground)]"}>
                {vote.value}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
