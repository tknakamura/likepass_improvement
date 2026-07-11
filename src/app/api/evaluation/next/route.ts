import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildVotedSet, selectNextContent } from "@/server/services/evaluation/queue";
import { getPublicImageUrl } from "@/lib/r2";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const tagSlug = searchParams.get("tagSlug") ?? undefined;
  const sessionId = searchParams.get("sessionId") ?? undefined;

  const [votes, preferences, candidates] = await Promise.all([
    prisma.vote.findMany({ where: { userId: session.user.id }, select: { contentId: true } }),
    prisma.userTagPreference.findMany({ where: { userId: session.user.id } }),
    prisma.content.findMany({
      where: {
        status: { in: ["EXPLORING", "ACTIVE"] },
        aiSafetyStatus: "SAFE",
      },
      include: {
        contentTags: { include: { tag: true }, where: { status: { in: ["PENDING", "ACTIVE"] } } },
      },
      take: 200,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const impressions = sessionId
    ? await prisma.impression.findMany({
        where: { userId: session.user.id, sessionId },
        orderBy: { shownAt: "asc" },
        take: 20,
      })
    : [];

  const selected = selectNextContent(candidates, {
    userId: session.user.id,
    preferences,
    votedContentIds: buildVotedSet(votes),
    sessionHistory: impressions.map((i) => i.contentId),
    tagSlug,
  });

  if (!selected) {
    return NextResponse.json({ content: null });
  }

  const contextTag = tagSlug
    ? selected.contentTags.find((ct) => ct.tag.slug === tagSlug)?.tag
    : selected.contentTags[0]?.tag;

  const imageKey = selected.mediumObjectKey ?? selected.largeObjectKey ?? selected.thumbnailObjectKey;

  return NextResponse.json({
    content: {
      id: selected.id,
      imageUrl: imageKey ? getPublicImageUrl(imageKey) : null,
      contextTag: contextTag
        ? { id: contextTag.id, slug: contextTag.slug, displayName: contextTag.displayName }
        : null,
    },
  });
}
