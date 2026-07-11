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
  const sessionId = searchParams.get("sessionId") ?? undefined;
  const uniqueTagSlugs = [
    ...new Set(
      searchParams
        .getAll("tags")
        .flatMap((value) => value.split(","))
        .map((slug) => slug.trim())
        .filter(Boolean)
    ),
  ];

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
    tagSlugs: uniqueTagSlugs.length > 0 ? uniqueTagSlugs : undefined,
  });

  if (!selected) {
    return NextResponse.json({ content: null });
  }

  const slugFilter = uniqueTagSlugs.length > 0 ? new Set(uniqueTagSlugs) : null;
  const contextTag = slugFilter
    ? selected.contentTags.find((ct) => slugFilter.has(ct.tag.slug))?.tag
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
