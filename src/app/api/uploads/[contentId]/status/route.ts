import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ contentId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { contentId } = await params;
  const content = await prisma.content.findUnique({
    where: { id: contentId },
    include: { contentTags: { include: { tag: true } } },
  });

  if (!content || content.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    contentId: content.id,
    status: content.status,
    tags: content.contentTags.map((ct) => ({
      slug: ct.tag.slug,
      displayName: ct.tag.displayName,
      status: ct.status,
    })),
  });
}
