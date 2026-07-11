import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const schema = z.object({
  deletePosts: z.boolean(),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    if (parsed.data.deletePosts) {
      await tx.content.updateMany({
        where: { userId: session.user.id },
        data: { status: "DELETED", deletedAt: new Date() },
      });
    }

    await tx.user.update({
      where: { id: session.user.id },
      data: {
        status: "DELETED",
        deletedAt: new Date(),
        email: null,
        name: "Deleted User",
        username: `deleted_${session.user.id.slice(0, 8)}`,
        image: null,
      },
    });

    await tx.session.deleteMany({ where: { userId: session.user.id } });
  });

  return NextResponse.json({ success: true });
}
