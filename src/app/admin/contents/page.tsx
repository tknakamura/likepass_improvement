import { prisma } from "@/lib/db";
import { getContentStatusLabel } from "@/lib/content-status";
import Link from "next/link";

export default async function AdminContentsPage() {
  const contents = await prisma.content.findMany({
    where: { status: { not: "DELETED" } },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { user: { select: { username: true } } },
  });

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">投稿一覧</h2>
      {contents.map((c) => (
        <Link
          key={c.id}
          href={`/content/${c.id}`}
          className="block p-3 border border-[var(--border)] rounded-lg text-sm hover:bg-[var(--muted)]"
        >
          <p className="font-medium">
            {c.id.slice(0, 10)} · {getContentStatusLabel(c.status)}
          </p>
          <p className="text-[var(--muted-foreground)]">
            @{c.user.username ?? "unknown"} · LIKE {(c.likeRate * 100).toFixed(0)}% · {c.voteCount}票
          </p>
        </Link>
      ))}
    </div>
  );
}
