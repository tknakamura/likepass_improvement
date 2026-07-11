import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function RankingIndexPage() {
  const tags = await prisma.tag.findMany({
    where: { status: "ACTIVE" },
    orderBy: { usageCount: "desc" },
    take: 30,
    include: {
      _count: {
        select: {
          contentTags: {
            where: {
              status: { in: ["ACTIVE", "PENDING"] },
              content: {
                status: { in: ["EXPLORING", "ACTIVE"] },
                deletedAt: null,
              },
            },
          },
        },
      },
    },
  });

  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl">
      <h1 className="text-xl font-bold mb-4 px-1">タグランキング</h1>
      <div className="grid gap-2">
        {tags.map((tag) => (
          <Link key={tag.id} href={`/ranking/${tag.slug}`}>
            <Card className="hover:bg-[var(--muted)] transition-colors">
              <CardHeader className="py-3 px-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <CardTitle className="text-base">#{tag.slug}</CardTitle>
                    <p className="text-sm text-[var(--muted-foreground)]">{tag.displayName}</p>
                  </div>
                  <p className="text-sm font-medium text-[var(--muted-foreground)] shrink-0 tabular-nums">
                    {tag._count.contentTags} 投稿
                  </p>
                </div>
              </CardHeader>
            </Card>
          </Link>
        ))}
        {tags.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-[var(--muted-foreground)]">
              まだランキングがありません。最初の投稿をお待ちしています。
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
