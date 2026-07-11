import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { updateVoteAggregates } from "@/server/services/content/aggregates";

const schema = z.object({
  value: z.enum(["LIKE", "PASS"]),
});

const UNDO_WINDOW_MS = 5000;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ contentId: string }> }
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
    where: { userId_contentId: { userId: session.user.id, contentId } },
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

  await updateVoteAggregates(contentId, existing.value, parsed.data.value);

  const vote = await prisma.vote.update({
    where: { id: existing.id },
    data: { value: parsed.data.value, changedCount: { increment: 1 } },
  });

  return NextResponse.json({ vote });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ contentId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { contentId } = await params;
  const existing = await prisma.vote.findUnique({
    where: { userId_contentId: { userId: session.user.id, contentId } },
  });

  if (!existing) {
    return NextResponse.json({ error: "Vote not found" }, { status: 404 });
  }

  const withinUndo =
    Date.now() - existing.createdAt.getTime() <= UNDO_WINDOW_MS && existing.changedCount === 0;

  if (!withinUndo) {
    return NextResponse.json({ error: "Undo window expired" }, { status: 403 });
  }

  await updateVoteAggregates(contentId, existing.value, undefined);
  await prisma.vote.delete({ where: { id: existing.id } });

  return NextResponse.json({ success: true });
}
