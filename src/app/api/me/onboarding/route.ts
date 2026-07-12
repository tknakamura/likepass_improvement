import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const schema = z.object({
  tagIds: z.array(z.string()).min(3).max(10),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Select 3-10 tags" }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.userTagPreference.deleteMany({ where: { userId: session.user.id } }),
    prisma.userTagPreference.createMany({
      data: parsed.data.tagIds.map((tagId) => ({
        userId: session.user.id,
        tagId,
        source: "onboarding",
      })),
    }),
    prisma.user.update({
      where: { id: session.user.id },
      data: {
        onboardingCompletedAt: new Date(),
        status: "ACTIVE",
      },
    }),
  ]);

  return NextResponse.json({ success: true });
}
