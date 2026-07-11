import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return null;
  }
  return session;
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [reports, users, contents] = await Promise.all([
    prisma.report.findMany({
      where: { status: "PENDING" },
      include: { content: true, reporter: { select: { username: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.user.count(),
    prisma.content.count({ where: { status: { not: "DELETED" } } }),
  ]);

  return NextResponse.json({
    stats: { pendingReports: reports.length, users, contents },
    reports: reports.map((r) => ({
      id: r.id,
      reason: r.reason,
      contentId: r.contentId,
      reporter: r.reporter.username ?? r.reporter.email,
      createdAt: r.createdAt,
    })),
  });
}

export async function PATCH(request: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const { reportId, action } = body as { reportId: string; action: string };

  const report = await prisma.report.findUnique({ where: { id: reportId } });
  if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (action === "dismiss") {
    await prisma.report.update({
      where: { id: reportId },
      data: { status: "DISMISSED", reviewedBy: session.user.id, reviewedAt: new Date() },
    });
  } else if (action === "hide_content") {
    await prisma.$transaction([
      prisma.content.update({
        where: { id: report.contentId },
        data: { status: "REJECTED" },
      }),
      prisma.report.update({
        where: { id: reportId },
        data: { status: "ACTION_TAKEN", reviewedBy: session.user.id, reviewedAt: new Date() },
      }),
      prisma.moderationAction.create({
        data: {
          targetType: "CONTENT",
          targetId: report.contentId,
          action: "REJECT",
          actorUserId: session.user.id,
          reason: report.reason,
        },
      }),
      prisma.auditLog.create({
        data: {
          actorUserId: session.user.id,
          action: "REPORT_ACTION",
          entityType: "Report",
          entityId: reportId,
          after: { action: "hide_content" },
        },
      }),
    ]);
  }

  return NextResponse.json({ success: true });
}
