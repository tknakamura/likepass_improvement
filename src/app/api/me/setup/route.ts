import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const setupSchema = z.object({
  username: z.string().regex(/^[a-zA-Z0-9_]{3,20}$/),
  termsAccepted: z.literal(true),
  privacyAccepted: z.literal(true),
  ageConfirmed: z.literal(true),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = setupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({
    where: { username: parsed.data.username },
  });
  if (existing && existing.id !== session.user.id) {
    return NextResponse.json({ error: "Username already taken" }, { status: 409 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      username: parsed.data.username,
      termsAcceptedAt: new Date(),
      privacyAcceptedAt: new Date(),
      status: "PENDING_ONBOARDING",
    },
  });

  return NextResponse.json({ success: true });
}
