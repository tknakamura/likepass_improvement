import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NPC_JUDGE_COUNT } from "@/lib/seed/data";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ contentId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { contentId } = await params;
  const content = await prisma.content.findUnique({
    where: { id: contentId },
    include: {
      contentTags: { include: { tag: true } },
      npcEvaluations: {
        include: {
          judge: true,
        },
        orderBy: { judge: { sortOrder: "asc" } },
      },
      votes: {
        select: { value: true },
      },
    },
  });

  if (!content || content.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const npcDone = content.npcEvaluations.length;
  const npcLikeCount = content.npcEvaluations.filter((e) => e.value === "LIKE").length;
  const npcPassCount = content.npcEvaluations.filter((e) => e.value === "PASS").length;
  const humanLikeCount = content.votes.filter((v) => v.value === "LIKE").length;
  const humanPassCount = content.votes.filter((v) => v.value === "PASS").length;

  return NextResponse.json({
    contentId: content.id,
    status: content.status,
    tags: content.contentTags.map((ct) => ({
      slug: ct.tag.slug,
      displayName: ct.tag.displayName,
      status: ct.status,
    })),
    npcReview: {
      total: NPC_JUDGE_COUNT,
      completed: npcDone,
      likeCount: npcLikeCount,
      passCount: npcPassCount,
      decisions:
        content.status === "NPC_REVIEWING" && npcDone < NPC_JUDGE_COUNT
          ? []
          : content.npcEvaluations.map((e) => ({
              judgeId: e.judgeId,
              value: e.value,
              commentJa: e.commentJa,
              confidence: e.confidence,
              judge: {
                displayName: e.judge.displayName,
                countryCode: e.judge.countryCode,
                countryNameJa: e.judge.countryNameJa,
                initials: e.judge.initials,
              },
            })),
    },
    votes: {
      likeCount: content.likeCount,
      passCount: content.passCount,
      voteCount: content.voteCount,
      likeRate: content.likeRate,
      humanLikeCount,
      humanPassCount,
      npcLikeCount,
      npcPassCount,
    },
  });
}
