import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
  createPresignedUploadUrl,
} from "@/lib/r2";

const schema = z.object({
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  fileSize: z.number().max(MAX_FILE_SIZE),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid upload request" }, { status: 400 });
  }

  if (!ALLOWED_MIME_TYPES.includes(parsed.data.mimeType)) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
  }

  const ext = parsed.data.mimeType.split("/")[1] === "jpeg" ? "jpg" : parsed.data.mimeType.split("/")[1];
  const content = await prisma.content.create({
    data: {
      userId: session.user.id,
      status: "UPLOADING",
      mimeType: parsed.data.mimeType,
      fileSize: parsed.data.fileSize,
    },
  });

  const objectKey = `originals/${session.user.id}/${content.id}/${uuidv4()}.${ext}`;
  await prisma.content.update({
    where: { id: content.id },
    data: { originalObjectKey: objectKey },
  });

  const uploadUrl = await createPresignedUploadUrl(objectKey, parsed.data.mimeType);
  if (!uploadUrl) {
    return NextResponse.json({
      contentId: content.id,
      uploadUrl: null,
      mockMode: true,
      message: "R2 not configured - use complete API directly in dev",
    });
  }

  return NextResponse.json({ contentId: content.id, uploadUrl, objectKey });
}
