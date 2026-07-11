import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { saveLocalImage } from "@/lib/local-images";
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE } from "@/lib/r2";

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

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
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
  await saveLocalImage(objectKey, buffer);

  if (!content.originalObjectKey) {
    await prisma.content.update({
      where: { id: contentId },
      data: { originalObjectKey: objectKey, mimeType: file.type, fileSize: file.size },
    });
  }

  return NextResponse.json({ success: true });
}
