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
  /** Optional display-context tag; not part of vote identity. */
  contextTagId: z.string().optional(),
  sessionId: z.string().optional(),
  responseTimeMs: z.number().optional(),
});

const undoSchema = z.object({
  contentId: z.string(),
});

const UNDO_WINDOW_MS = 5000;

async function assertEvaluableContent(contentId: string) {
  const content = await prisma.content.findUnique({
    where: { id: contentId },
    include: {
      contentTags: {
        where: { status: { not: "REMOVED" } },
        select: { tagId: true },
      },
    },
  });

  if (!content || !["EXPLORING", "ACTIVE"].includes(content.status)) {
    return null;
  }
  return content;
}

async function enqueueTagRankings(contentId: string) {
  const tags = await prisma.contentTag.findMany({
    where: { contentId, status: { not: "REMOVED" } },
    select: { tagId: true },
  });
  for (const { tagId } of tags) {
    await enqueueJob("recalculate_ranking", { tagId });
  }
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

  const content = await assertEvaluableContent(parsed.data.contentId);
  if (!content) {
    return NextResponse.json({ error: "Content not available" }, { status: 404 });
  }

  const existing = await prisma.vote.findUnique({
    where: {
      userId_contentId: {
        userId: session.user.id,
        contentId: parsed.data.contentId,
      },
    },
  });

  if (existing) {
    return NextResponse.json({ error: "Already voted" }, { status: 409 });
  }

  let vote;
  try {
    vote = await prisma.vote.create({
      data: {
        userId: session.user.id,
        contentId: parsed.data.contentId,
        value: parsed.data.value,
        sessionId: parsed.data.sessionId,
        responseTimeMs: parsed.data.responseTimeMs,
      },
    });
  } catch {
    return NextResponse.json({ error: "Already voted" }, { status: 409 });
  }

  await updateVoteAggregates(parsed.data.contentId);

  const contextTagId =
    parsed.data.contextTagId &&
    content.contentTags.some((ct) => ct.tagId === parsed.data.contextTagId)
      ? parsed.data.contextTagId
      : undefined;

  if (parsed.data.sessionId) {
    await prisma.impression.create({
      data: {
        userId: session.user.id,
        contentId: parsed.data.contentId,
        tagId: contextTagId,
        sessionId: parsed.data.sessionId,
        source: "evaluate",
        result: parsed.data.value,
      },
    });
  }

  const updated = await prisma.content.findUnique({ where: { id: parsed.data.contentId } });
  await enqueueTagRankings(parsed.data.contentId);

  const unlockedRankings = await getUnlockedRankingsForVote(
    session.user.id,
    parsed.data.contentId,
  );

  return NextResponse.json({
    vote: {
      contentId: vote.contentId,
      value: vote.value,
      undoUntil: Date.now() + UNDO_WINDOW_MS,
    },
    result: {
      likeCount: updated?.likeCount ?? 0,
      passCount: updated?.passCount ?? 0,
      likeRate: updated?.likeRate ?? 0,
      rankingStatus: updated?.status ?? "EXPLORING",
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
      userId_contentId: {
        userId: session.user.id,
        contentId: parsed.data.contentId,
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
  await enqueueTagRankings(parsed.data.contentId);

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
      userId_contentId: {
        userId: session.user.id,
        contentId: parsed.data.contentId,
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
  await enqueueTagRankings(parsed.data.contentId);

  return NextResponse.json({ success: true });
}
