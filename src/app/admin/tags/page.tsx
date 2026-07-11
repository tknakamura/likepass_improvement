import { prisma } from "@/lib/db";
import Link from "next/link";

export default async function AdminTagsPage() {
  const tags = await prisma.tag.findMany({
    orderBy: { usageCount: "desc" },
    take: 50,
  });

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">タグ一覧</h2>
      {tags.map((tag) => (
        <div key={tag.id} className="flex items-center justify-between p-3 border border-[var(--border)] rounded-lg text-sm">
          <div>
            <p className="font-medium">#{tag.slug}</p>
            <p className="text-[var(--muted-foreground)]">
              {tag.displayName} · {tag.status} · {tag.usageCount} 利用
            </p>
          </div>
          <Link href={`/ranking/${tag.slug}`} className="text-[var(--primary)] text-xs">
            ランキング
          </Link>
        </div>
      ))}
    </div>
  );
}
