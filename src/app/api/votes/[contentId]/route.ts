import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { updateVoteAggregates } from "@/server/services/content/aggregates";
import { enqueueJob } from "@/lib/jobs";

const schema = z.object({
  value: z.enum(["LIKE", "PASS"]),
  sourceTagId: z.string().min(1),
});

const UNDO_WINDOW_MS = 5000;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ contentId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { contentId } = await params;
  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid vote update" }, { status: 400 });
  }

  const existing = await prisma.vote.findUnique({
    where: {
      userId_contentId_sourceTagId: {
        userId: session.user.id,
        contentId,
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
    data: { value: parsed.data.value, changedCount: { increment: 1 } },
  });

  await updateVoteAggregates(contentId);
  await enqueueJob("recalculate_ranking", { tagId: parsed.data.sourceTagId });

  return NextResponse.json({ vote });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ contentId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { contentId } = await params;
  let sourceTagId: string | undefined;
  try {
    const body = await request.json();
    sourceTagId = typeof body?.sourceTagId === "string" ? body.sourceTagId : undefined;
  } catch {
    sourceTagId = undefined;
  }

  if (!sourceTagId) {
    return NextResponse.json({ error: "sourceTagId is required" }, { status: 400 });
  }

  const existing = await prisma.vote.findUnique({
    where: {
      userId_contentId_sourceTagId: {
        userId: session.user.id,
        contentId,
        sourceTagId,
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
  await updateVoteAggregates(contentId);
  await enqueueJob("recalculate_ranking", { tagId: sourceTagId });

  return NextResponse.json({ success: true });
}
