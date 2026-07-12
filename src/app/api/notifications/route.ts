import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [recentVotes, pendingReports] = await Promise.all([
    prisma.vote.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        content: {
          include: { contentTags: { include: { tag: true }, where: { status: "ACTIVE" } } },
        },
      },
    }),
    prisma.report.count({ where: { reporterUserId: session.user.id, status: "PENDING" } }),
  ]);

  const notifications = recentVotes.map((vote) => {
    const tag = vote.content.contentTags[0]?.tag;
    return {
      id: vote.id,
      type: "VOTE" as const,
      message: `${vote.value === "LIKE" ? "LIKE" : "PASS"} しました`,
      tagSlug: tag?.slug ?? null,
      createdAt: vote.createdAt,
    };
  });

  return NextResponse.json({
    notifications,
    meta: { pendingReportsSubmitted: pendingReports },
  });
}
