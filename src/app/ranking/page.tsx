import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function RankingIndexPage() {
  const tags = await prisma.tag.findMany({
    where: { status: "ACTIVE" },
    orderBy: { usageCount: "desc" },
    take: 30,
  });

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">タグランキング</h1>
      <div className="grid gap-3">
        {tags.map((tag) => (
          <Link key={tag.id} href={`/ranking/${tag.slug}`}>
            <Card className="hover:bg-[var(--muted)] transition-colors">
              <CardHeader className="py-4">
                <CardTitle className="text-lg">#{tag.slug}</CardTitle>
                <p className="text-sm text-[var(--muted-foreground)]">{tag.displayName}</p>
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
