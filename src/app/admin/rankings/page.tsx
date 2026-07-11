import { prisma } from "@/lib/db";
import Link from "next/link";

export default async function AdminRankingsPage() {
  const tags = await prisma.tag.findMany({
    where: { status: "ACTIVE" },
    orderBy: { usageCount: "desc" },
    take: 20,
    include: {
      _count: { select: { contentTags: { where: { status: "ACTIVE" } } } },
    },
  });

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">ランキング管理</h2>
      <p className="text-sm text-[var(--muted-foreground)]">
        タグ別ランキングは15分ごとにワーカーで再計算されます
      </p>
      {tags.map((tag) => (
        <Link
          key={tag.id}
          href={`/ranking/${tag.slug}`}
          className="block p-3 border border-[var(--border)] rounded-lg text-sm hover:bg-[var(--muted)]"
        >
          <p className="font-medium">#{tag.slug}</p>
          <p className="text-[var(--muted-foreground)]">ACTIVE 投稿 {tag._count.contentTags} 件</p>
        </Link>
      ))}
    </div>
  );
}
