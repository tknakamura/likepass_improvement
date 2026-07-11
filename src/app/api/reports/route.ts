import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const schema = z.object({
  contentId: z.string(),
  reason: z.enum([
    "SEXUAL",
    "VIOLENCE",
    "HATE",
    "HARASSMENT",
    "PRIVACY",
    "COPYRIGHT",
    "SPAM",
    "IMPERSONATION",
    "MINOR_SAFETY",
    "OTHER",
  ]),
  description: z.string().max(1000).optional(),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid report" }, { status: 400 });
  }

  const content = await prisma.content.findUnique({ where: { id: parsed.data.contentId } });
  if (!content) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const report = await prisma.report.create({
    data: {
      reporterUserId: session.user.id,
      contentId: parsed.data.contentId,
      reason: parsed.data.reason,
      description: parsed.data.description,
    },
  });

  await prisma.content.update({
    where: { id: parsed.data.contentId },
    data: { reportCount: { increment: 1 } },
  });

  const updated = await prisma.content.findUnique({ where: { id: parsed.data.contentId } });
  if (updated && updated.reportCount >= 3) {
    await prisma.content.update({
      where: { id: parsed.data.contentId },
      data: { status: "REVIEW_REQUIRED" },
    });
  }

  return NextResponse.json({ reportId: report.id });
}
