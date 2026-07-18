import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getPublicImageUrl } from "@/lib/r2";
import { getContentStatusHint, getContentStatusLabel } from "@/lib/content-status";
import { isPublicContentStatus } from "@/server/services/content/access";
import { MeSubpageHeader } from "@/components/me/me-subpage-header";
import type { ContentStatus } from "@prisma/client";

function postImageUrl(objectKey: string, status: ContentStatus): string {
  if (objectKey.startsWith("http://") || objectKey.startsWith("https://")) {
    return objectKey;
  }
  if (!isPublicContentStatus(status)) {
    return `/api/images/${objectKey.split("/").map(encodeURIComponent).join("/")}`;
  }
  return getPublicImageUrl(objectKey);
}

function statusBadgeClass(status: ContentStatus): string {
  if (status === "ACTIVE" || status === "EXPLORING") {
    return "bg-[var(--primary)]/10 text-[var(--primary)]";
  }
  if (status === "NPC_REVIEWING") {
    return "bg-amber-500/15 text-amber-800 dark:text-amber-200";
  }
  if (status === "DORMANT" || status === "REJECTED") {
    return "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200";
  }
  return "bg-[var(--muted)] text-[var(--muted-foreground)]";
}

export default async function MePostsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const posts = await prisma.content.findMany({
    where: { userId: session.user.id, status: { not: "DELETED" } },
    orderBy: { createdAt: "desc" },
    include: { contentTags: { include: { tag: true } } },
  });

  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl">
      <MeSubpageHeader title="自分の投稿" />

      {posts.length === 0 ? (
        <p className="text-sm text-center text-[var(--muted-foreground)] py-12">
          まだ投稿がありません
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
          {posts.map((post) => {
            const imageKey = post.thumbnailObjectKey ?? post.mediumObjectKey;
            const statusHint = getContentStatusHint(post.status);
            const tagLabel = post.contentTags.map((ct) => `#${ct.tag.slug}`).join(" ");

            return (
              <Link
                key={post.id}
                href={`/content/${post.id}`}
                className="group flex flex-col overflow-hidden rounded-lg border border-[var(--border)]"
              >
                <div className="relative aspect-square bg-[var(--muted)]">
                  {imageKey ? (
                    <Image
                      src={postImageUrl(imageKey, post.status)}
                      alt=""
                      fill
                      className="object-cover"
                      unoptimized
                      sizes="33vw"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-xs text-[var(--muted-foreground)]">
                      処理中
                    </div>
                  )}
                  <span
                    className={`absolute top-1 left-1 z-10 rounded px-1.5 py-0.5 text-[10px] font-medium ${statusBadgeClass(post.status)}`}
                  >
                    {getContentStatusLabel(post.status)}
                  </span>
                </div>
                <div className="p-2 space-y-0.5">
                  {post.voteCount > 0 ? (
                    <p className="text-xs font-medium tabular-nums">
                      LIKE {(post.likeRate * 100).toFixed(0)}% · {post.voteCount}票
                    </p>
                  ) : (
                    <p className="text-xs text-[var(--muted-foreground)]">評価なし</p>
                  )}
                  {tagLabel && (
                    <p className="text-[10px] text-[var(--muted-foreground)] truncate">{tagLabel}</p>
                  )}
                  {statusHint && (
                    <p className="text-[10px] text-[var(--muted-foreground)] line-clamp-2">{statusHint}</p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
