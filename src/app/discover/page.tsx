import Link from "next/link";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function DiscoverPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  const tags = await prisma.tag.findMany({
    where: { status: "ACTIVE" },
    orderBy: { usageCount: "desc" },
    take: 24,
  });

  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl space-y-4">
      <div>
        <h1 className="text-xl font-bold">発見</h1>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">
          人気のタグからランキングを探索しましょう
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {tags.map((tag) => (
          <Link key={tag.id} href={`/ranking/${tag.slug}`}>
            <Card className="hover:bg-[var(--muted)] transition-colors h-full">
              <CardHeader className="py-4 px-4">
                <CardTitle className="text-base">#{tag.slug}</CardTitle>
                <p className="text-xs text-[var(--muted-foreground)]">{tag.displayName}</p>
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-0">
                <p className="text-xs text-[var(--muted-foreground)]">{tag.usageCount} 投稿</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {tags.length === 0 && (
        <p className="text-center text-sm text-[var(--muted-foreground)] py-12">タグがまだありません</p>
      )}
    </div>
  );
}
