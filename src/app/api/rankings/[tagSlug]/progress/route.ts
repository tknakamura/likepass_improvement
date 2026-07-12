import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tagSlug: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tagSlug } = await params;
  const tag = await prisma.tag.findUnique({ where: { slug: tagSlug } });
  if (!tag) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [votedIds, totalEligible] = await Promise.all([
    prisma.vote.findMany({
      where: { userId: session.user.id },
      select: { contentId: true },
    }),
    prisma.contentTag.count({
      where: { tagId: tag.id, status: "ACTIVE", content: { status: "ACTIVE" } },
    }),
  ]);

  const votedSet = new Set(votedIds.map((v) => v.contentId));
  const topContentTags = await prisma.contentTag.findMany({
    where: { tagId: tag.id, status: "ACTIVE" },
    orderBy: { currentRank: "asc" },
    take: 100,
    select: { contentId: true },
  });

  const unlocked = topContentTags.filter((ct) => votedSet.has(ct.contentId)).length;

  return NextResponse.json({
    tagSlug,
    top10: {
      unlocked: Math.min(unlocked, 10),
      total: Math.min(10, topContentTags.length),
    },
    top50: {
      unlocked: Math.min(unlocked, 50),
      total: Math.min(50, totalEligible),
    },
    top100: {
      unlocked: Math.min(unlocked, 100),
      total: Math.min(100, totalEligible),
    },
  });
}
