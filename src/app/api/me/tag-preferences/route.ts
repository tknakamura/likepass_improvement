import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const preferences = await prisma.userTagPreference.findMany({
    where: { userId: session.user.id },
    include: { tag: true },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    preferences: preferences.map((p) => ({
      tagId: p.tagId,
      slug: p.tag.slug,
      displayName: p.tag.displayName,
    })),
  });
}
