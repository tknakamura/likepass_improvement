import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Image from "next/image";
import { getPublicImageUrl } from "@/lib/r2";
import { auth } from "@/lib/auth";
import { getContentStatusHint, getContentStatusLabel } from "@/lib/content-status";
import { canViewContent, isPublicContentStatus } from "@/server/services/content/access";
import { NpcReviewPanel } from "@/components/content/npc-review-panel";

function gatedImageUrl(objectKey: string, publicOk: boolean): string {
  if (objectKey.startsWith("http://") || objectKey.startsWith("https://")) {
    return objectKey;
  }
  // Non-public content must go through the auth-aware image proxy.
  if (!publicOk) {
    return `/api/images/${objectKey.split("/").map(encodeURIComponent).join("/")}`;
  }
  return getPublicImageUrl(objectKey);
}

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
      npcEvaluations: { select: { value: true } },
      votes: { select: { value: true } },
    },
  });

  if (!content || content.status === "DELETED") notFound();

  const allowed = canViewContent({
    status: content.status,
    ownerId: content.userId,
    viewerId: session?.user?.id,
    viewerRole: session?.user?.role,
  });
  if (!allowed) notFound();

  const isOwner = session?.user?.id === content.userId;
  const publicOk = isPublicContentStatus(content.status);
  const imageKey = content.largeObjectKey ?? content.mediumObjectKey ?? content.thumbnailObjectKey;

  const npcLikeCount = content.npcEvaluations.filter((e) => e.value === "LIKE").length;
  const npcPassCount = content.npcEvaluations.filter((e) => e.value === "PASS").length;
  const humanLikeCount = content.votes.filter((v) => v.value === "LIKE").length;
  const humanPassCount = content.votes.filter((v) => v.value === "PASS").length;

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      {imageKey && (
        <div className="relative aspect-square mb-4 rounded-xl overflow-hidden">
          <Image
            src={gatedImageUrl(imageKey, publicOk)}
            alt=""
            fill
            className="object-contain"
            unoptimized
          />
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
      {(isOwner || session?.user) && content.voteCount > 0 && (
        <p className="text-sm mt-2">
          LIKE率 {(content.likeRate * 100).toFixed(1)}% · {content.voteCount} 票
          {isOwner && (
            <span className="text-[var(--muted-foreground)]">
              {" "}
              （NPC {npcLikeCount}/{npcLikeCount + npcPassCount} · 人間{" "}
              {humanLikeCount}/{humanLikeCount + humanPassCount}）
            </span>
          )}
        </p>
      )}

      <NpcReviewPanel contentId={content.id} initialStatus={content.status} isOwner={isOwner} />
    </div>
  );
}
