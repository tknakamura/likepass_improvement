import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isR2Configured, saveLocalImage } from "@/lib/local-images";
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE, putObject } from "@/lib/r2";
import { mimeTypeFromFileName, normalizeImageMimeType } from "@/lib/uploads/mime";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await request.formData();
  const contentId = form.get("contentId");
  const file = form.get("file");

  if (typeof contentId !== "string" || !(file instanceof File)) {
    return NextResponse.json({ error: "Invalid upload" }, { status: 400 });
  }

  const mimeType = normalizeImageMimeType(file) ?? (file.name ? mimeTypeFromFileName(file.name) : null);
  if (!mimeType || !ALLOWED_MIME_TYPES.includes(mimeType)) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File too large" }, { status: 400 });
  }

  const content = await prisma.content.findUnique({ where: { id: contentId } });
  if (!content || content.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const objectKey = content.originalObjectKey ?? `originals/${session.user.id}/${contentId}/upload.jpg`;

  try {
    if (isR2Configured()) {
      await putObject(objectKey, buffer, mimeType);
    } else {
      await saveLocalImage(objectKey, buffer);
    }
  } catch (err) {
    console.error("Upload storage failed", err);
    return NextResponse.json({ error: "Storage upload failed" }, { status: 500 });
  }

  await prisma.content.update({
    where: { id: contentId },
    data: {
      originalObjectKey: objectKey,
      mimeType,
      fileSize: file.size,
    },
  });

  return NextResponse.json({ success: true });
}
