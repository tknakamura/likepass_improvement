import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ContentStatus, ContentTagStatus } from "@prisma/client";

const publishedStatuses: ContentStatus[] = ["EXPLORING", "ACTIVE"];
const activeTagStatuses: ContentTagStatus[] = ["ACTIVE", "PENDING"];

const publishedContentWhere = {
  status: { in: publishedStatuses },
  deletedAt: null,
};

const activeContentTagWhere = {
  status: { in: activeTagStatuses },
  content: publishedContentWhere,
};

export default async function RankingIndexPage() {
  const session = await auth();

  const tags = await prisma.tag.findMany({
    where: { status: "ACTIVE" },
    orderBy: { usageCount: "desc" },
    take: 30,
    include: {
      _count: {
        select: {
          contentTags: {
            where: activeContentTagWhere,
          },
        },
      },
    },
  });

  let totalEvaluated = 0;
  const evaluatedByTagId = new Map<string, number>();

  if (session?.user?.id) {
    const [voteCount, evaluatedCounts] = await Promise.all([
      prisma.vote.count({ where: { userId: session.user.id } }),
      prisma.contentTag.groupBy({
        by: ["tagId"],
        where: {
          status: { in: activeTagStatuses },
          content: {
            ...publishedContentWhere,
            votes: { some: { userId: session.user.id } },
          },
        },
        _count: { contentId: true },
      }),
    ]);

    totalEvaluated = voteCount;
    for (const row of evaluatedCounts) {
      evaluatedByTagId.set(row.tagId, row._count.contentId);
    }
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl">
      <div className="mb-4 flex items-end justify-between gap-4">
        <h1 className="text-xl font-bold">タグランキング</h1>
        {session?.user && (
          <p className="text-sm text-[var(--muted-foreground)] tabular-nums shrink-0">
            評価済み <span className="font-medium text-[var(--foreground)]">{totalEvaluated}</span> 件
          </p>
        )}
      </div>

      <div className="grid gap-2">
        {tags.map((tag) => {
          const evaluated = evaluatedByTagId.get(tag.id) ?? 0;
          const posts = tag._count.contentTags;

          return (
            <Link key={tag.id} href={`/ranking/${tag.slug}`}>
              <Card className="hover:bg-[var(--muted)] transition-colors">
                <CardHeader className="py-3 px-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <CardTitle className="text-base">#{tag.slug}</CardTitle>
                      <p className="text-sm text-[var(--muted-foreground)]">{tag.displayName}</p>
                    </div>
                    <div className="text-right text-sm shrink-0 tabular-nums space-y-0.5">
                      <p className="font-medium text-[var(--muted-foreground)]">{posts} 投稿</p>
                      {session?.user && (
                        <p className="text-[var(--primary)]">{evaluated} 評価済</p>
                      )}
                    </div>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          );
        })}
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
