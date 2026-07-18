import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  buildVotedSet,
  selectNextPair,
  type QueuePair,
} from "@/server/services/evaluation/queue";
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
        .filter(Boolean),
    ),
  ];

  const [votes, preferences, pairCandidates] = await Promise.all([
    prisma.vote.findMany({
      where: { userId: session.user.id },
      select: { contentId: true },
    }),
    prisma.userTagPreference.findMany({ where: { userId: session.user.id } }),
    prisma.contentTag.findMany({
      where: {
        status: { in: ["PENDING", "ACTIVE"] },
        ...(uniqueTagSlugs.length > 0 ? { tag: { slug: { in: uniqueTagSlugs } } } : {}),
        content: {
          status: { in: ["EXPLORING", "ACTIVE"] },
          aiSafetyStatus: "SAFE",
        },
      },
      include: {
        tag: true,
        content: {
          include: {
            contentTags: {
              include: { tag: true },
              where: { status: { in: ["PENDING", "ACTIVE"] } },
            },
          },
        },
      },
      take: 300,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const impressions = sessionId
    ? await prisma.impression.findMany({
        where: { userId: session.user.id, sessionId },
        orderBy: { shownAt: "asc" },
        take: 40,
      })
    : [];

  const candidates = pairCandidates as QueuePair[];
  const selected = selectNextPair(candidates, {
    userId: session.user.id,
    preferences,
    votedContentIds: buildVotedSet(votes),
    sessionHistory: impressions.map((i) => i.contentId),
    tagSlugs: uniqueTagSlugs.length > 0 ? uniqueTagSlugs : undefined,
  });

  if (!selected) {
    return NextResponse.json({ content: null });
  }

  const imageKey =
    selected.content.mediumObjectKey ??
    selected.content.largeObjectKey ??
    selected.content.thumbnailObjectKey;

  return NextResponse.json({
    content: {
      id: selected.contentId,
      imageUrl: imageKey ? getPublicImageUrl(imageKey) : null,
      contextTag: {
        id: selected.tag.id,
        slug: selected.tag.slug,
        displayName: selected.tag.displayName,
      },
    },
  });
}
