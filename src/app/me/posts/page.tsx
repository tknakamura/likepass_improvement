import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getPublicImageUrl } from "@/lib/r2";

export default async function MePostsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const posts = await prisma.content.findMany({
    where: { userId: session.user.id, status: { not: "DELETED" } },
    orderBy: { createdAt: "desc" },
    include: { contentTags: { include: { tag: true } } },
  });

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-xl font-bold mb-4">自分の投稿</h1>
      <div className="space-y-4">
        {posts.map((post) => {
          const imageKey = post.thumbnailObjectKey ?? post.mediumObjectKey;
          return (
            <Link key={post.id} href={`/content/${post.id}`} className="flex gap-4 p-3 border border-[var(--border)] rounded-lg">
              {imageKey && (
                <div className="relative w-16 h-16 rounded overflow-hidden shrink-0">
                  <Image src={getPublicImageUrl(imageKey)} alt="" fill className="object-cover" unoptimized />
                </div>
              )}
              <div>
                <p className="font-medium">{post.status}</p>
                <p className="text-sm text-[var(--muted-foreground)]">
                  {post.contentTags.map((ct) => `#${ct.tag.slug}`).join(" ")}
                </p>
                {post.status === "DORMANT" && (
                  <p className="text-xs text-[var(--muted-foreground)]">現在、ランキング対象外</p>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
