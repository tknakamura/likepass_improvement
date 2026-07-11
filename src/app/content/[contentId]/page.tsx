import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Image from "next/image";
import { getPublicImageUrl } from "@/lib/r2";
import { auth } from "@/lib/auth";
import { getContentStatusHint, getContentStatusLabel } from "@/lib/content-status";

export default async function ContentDetailPage({
  params,
}: {
  params: Promise<{ contentId: string }>;
}) {
  const { contentId } = await params;
  const session = await auth();

  const content = await prisma.content.findUnique({
    where: { id: contentId },
    include: {
      user: { select: { username: true, name: true, image: true } },
      contentTags: { include: { tag: true } },
    },
  });

  if (!content || content.status === "DELETED") notFound();

  const isOwner = session?.user?.id === content.userId;
  const imageKey = content.largeObjectKey ?? content.mediumObjectKey ?? content.thumbnailObjectKey;

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      {imageKey && (
        <div className="relative aspect-square mb-4 rounded-xl overflow-hidden">
          <Image src={getPublicImageUrl(imageKey)} alt="" fill className="object-contain" unoptimized />
        </div>
      )}
      <div className="flex flex-wrap gap-2 mb-4">
        {content.contentTags.map((ct) => (
          <span key={ct.id} className="px-2 py-1 text-sm rounded-full bg-[var(--muted)]">
            #{ct.tag.slug}
          </span>
        ))}
      </div>
      <p className="text-sm text-[var(--muted-foreground)]">
        投稿者: @{content.user.username ?? "anonymous"}
      </p>
      {isOwner && (
        <p className="text-sm mt-2">
          ステータス: {getContentStatusLabel(content.status)}
          {getContentStatusHint(content.status) && ` — ${getContentStatusHint(content.status)}`}
        </p>
      )}
      {(isOwner || session?.user) && (
        <p className="text-sm mt-2">
          LIKE率 {(content.likeRate * 100).toFixed(1)}% · {content.voteCount} 票
        </p>
      )}
    </div>
  );
}
