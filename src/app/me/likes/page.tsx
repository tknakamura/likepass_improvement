import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getPublicImageUrl } from "@/lib/r2";
import { MeSubpageHeader } from "@/components/me/me-subpage-header";

export default async function MeLikesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const likes = await prisma.vote.findMany({
    where: {
      userId: session.user.id,
      value: "LIKE",
      content: { status: { not: "DELETED" } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      content: {
        include: { contentTags: { include: { tag: true } } },
      },
    },
  });

  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl">
      <MeSubpageHeader title="LIKEした画像" />

      {likes.length === 0 ? (
        <div className="py-12 text-center space-y-3">
          <p className="text-sm text-[var(--muted-foreground)]">まだ LIKE した画像がありません</p>
          <Link href="/evaluate" className="text-sm text-[var(--primary)] underline">
            評価を始める
          </Link>
        </div>
      ) : (
        <>
          <p className="text-sm text-[var(--muted-foreground)] mb-4 tabular-nums">{likes.length} 件</p>
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
            {likes.map((vote) => {
              const content = vote.content;
              const imageKey = content.thumbnailObjectKey ?? content.mediumObjectKey;
              const tagLabel = content.contentTags.map((ct) => `#${ct.tag.slug}`).join(" ");

              return (
                <Link
                  key={vote.id}
                  href={`/content/${content.id}`}
                  className="flex flex-col overflow-hidden rounded-lg border border-[var(--border)]"
                >
                  <div className="relative aspect-square bg-[var(--muted)]">
                    {imageKey ? (
                      <Image
                        src={getPublicImageUrl(imageKey)}
                        alt=""
                        fill
                        className="object-cover"
                        unoptimized
                        sizes="33vw"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-xs text-[var(--muted-foreground)]">
                        画像なし
                      </div>
                    )}
                    <span className="absolute top-1 left-1 z-10 rounded bg-[var(--primary)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--primary-foreground)]">
                      LIKE
                    </span>
                  </div>
                  <div className="p-2 space-y-0.5">
                    {tagLabel && (
                      <p className="text-[10px] text-[var(--muted-foreground)] truncate">{tagLabel}</p>
                    )}
                    <p className="text-[10px] text-[var(--muted-foreground)]">
                      {vote.createdAt.toLocaleDateString("ja-JP")}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
