import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { updateVoteAggregates } from "@/server/services/content/aggregates";
import { getUnlockedRankingsForVote } from "@/server/services/ranking/unlock";
import { enqueueJob } from "@/lib/jobs";

const schema = z.object({
  contentId: z.string(),
  value: z.enum(["LIKE", "PASS"]),
  sourceTagId: z.string().min(1),
  sessionId: z.string().optional(),
  responseTimeMs: z.number().optional(),
});

const undoSchema = z.object({
  contentId: z.string(),
  sourceTagId: z.string().min(1),
});

const UNDO_WINDOW_MS = 5000;

async function assertEvaluableTag(contentId: string, sourceTagId: string) {
  const contentTag = await prisma.contentTag.findUnique({
    where: { contentId_tagId: { contentId, tagId: sourceTagId } },
    include: { tag: true, content: true },
  });

  if (!contentTag || contentTag.status === "REMOVED") {
    return null;
  }
  if (!["EXPLORING", "ACTIVE"].includes(contentTag.content.status)) {
    return null;
  }
  return contentTag;
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid vote" }, { status: 400 });
  }

  const contentTag = await assertEvaluableTag(parsed.data.contentId, parsed.data.sourceTagId);
  if (!contentTag) {
    return NextResponse.json({ error: "Content not available" }, { status: 404 });
  }

  const existing = await prisma.vote.findUnique({
    where: {
      userId_contentId_sourceTagId: {
        userId: session.user.id,
        contentId: parsed.data.contentId,
        sourceTagId: parsed.data.sourceTagId,
      },
    },
  });

  if (existing) {
    return NextResponse.json({ error: "Already voted" }, { status: 409 });
  }

  const vote = await prisma.vote.create({
    data: {
      userId: session.user.id,
      contentId: parsed.data.contentId,
      value: parsed.data.value,
      sourceTagId: parsed.data.sourceTagId,
      sessionId: parsed.data.sessionId,
      responseTimeMs: parsed.data.responseTimeMs,
    },
  });

  await updateVoteAggregates(parsed.data.contentId);

  if (parsed.data.sessionId) {
    await prisma.impression.create({
      data: {
        userId: session.user.id,
        contentId: parsed.data.contentId,
        tagId: parsed.data.sourceTagId,
        sessionId: parsed.data.sessionId,
        source: "evaluate",
        result: parsed.data.value,
      },
    });
  }

  const updatedTag = await prisma.contentTag.findUnique({
    where: {
      contentId_tagId: {
        contentId: parsed.data.contentId,
        tagId: parsed.data.sourceTagId,
      },
    },
  });

  await enqueueJob("recalculate_ranking", { tagId: parsed.data.sourceTagId });

  const unlockedRankings = await getUnlockedRankingsForVote(
    session.user.id,
    parsed.data.contentId,
    parsed.data.sourceTagId,
  );

  return NextResponse.json({
    vote: {
      contentId: vote.contentId,
      sourceTagId: vote.sourceTagId,
      value: vote.value,
      undoUntil: Date.now() + UNDO_WINDOW_MS,
    },
    result: {
      likeCount: updatedTag?.likeCount ?? 0,
      passCount: updatedTag?.passCount ?? 0,
      likeRate: updatedTag?.likeRate ?? 0,
      rankingStatus: updatedTag?.status ?? "PENDING",
      tag: {
        id: contentTag.tag.id,
        slug: contentTag.tag.slug,
        displayName: contentTag.tag.displayName,
      },
    },
    unlockedRankings,
    next: { prefetch: true },
  });
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid vote update" }, { status: 400 });
  }

  const existing = await prisma.vote.findUnique({
    where: {
      userId_contentId_sourceTagId: {
        userId: session.user.id,
        contentId: parsed.data.contentId,
        sourceTagId: parsed.data.sourceTagId,
      },
    },
  });

  if (!existing) {
    return NextResponse.json({ error: "Vote not found" }, { status: 404 });
  }

  const withinUndo =
    Date.now() - existing.createdAt.getTime() <= UNDO_WINDOW_MS && existing.changedCount === 0;

  if (!withinUndo && existing.changedCount >= 3) {
    return NextResponse.json({ error: "Change limit reached" }, { status: 403 });
  }

  if (existing.value === parsed.data.value) {
    return NextResponse.json({ vote: existing });
  }

  const vote = await prisma.vote.update({
    where: { id: existing.id },
    data: {
      value: parsed.data.value,
      changedCount: { increment: 1 },
    },
  });

  await updateVoteAggregates(parsed.data.contentId);
  await enqueueJob("recalculate_ranking", { tagId: parsed.data.sourceTagId });

  return NextResponse.json({ vote });
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = undoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid undo request" }, { status: 400 });
  }

  const existing = await prisma.vote.findUnique({
    where: {
      userId_contentId_sourceTagId: {
        userId: session.user.id,
        contentId: parsed.data.contentId,
        sourceTagId: parsed.data.sourceTagId,
      },
    },
  });

  if (!existing) {
    return NextResponse.json({ error: "Vote not found" }, { status: 404 });
  }

  const withinUndo =
    Date.now() - existing.createdAt.getTime() <= UNDO_WINDOW_MS && existing.changedCount === 0;

  if (!withinUndo) {
    return NextResponse.json({ error: "Undo window expired" }, { status: 403 });
  }

  await prisma.vote.delete({ where: { id: existing.id } });
  await updateVoteAggregates(parsed.data.contentId);
  await enqueueJob("recalculate_ranking", { tagId: parsed.data.sourceTagId });

  return NextResponse.json({ success: true });
}
