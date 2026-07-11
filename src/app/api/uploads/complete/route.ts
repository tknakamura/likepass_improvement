import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { objectExists } from "@/lib/r2";
import { enqueueJob } from "@/lib/jobs";

const schema = z.object({
  contentId: z.string(),
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

  const content = await prisma.content.findUnique({ where: { id: parsed.data.contentId } });
  if (!content || content.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (content.originalObjectKey) {
    const exists = await objectExists(content.originalObjectKey);
    if (!exists && process.env.R2_BUCKET_NAME) {
      return NextResponse.json({ error: "Upload not found" }, { status: 400 });
    }
  }

  await prisma.content.update({
    where: { id: content.id },
    data: { status: "PROCESSING" },
  });

  await enqueueJob("process_image", { contentId: content.id });

  return NextResponse.json({ contentId: content.id, status: "PROCESSING" });
}
