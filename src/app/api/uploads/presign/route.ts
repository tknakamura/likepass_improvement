import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
} from "@/lib/r2";
import { isR2Configured } from "@/lib/local-images";
import { mimeTypeFromFileName } from "@/lib/uploads/mime";

const schema = z.object({
  mimeType: z.string(),
  fileSize: z.number().max(MAX_FILE_SIZE),
  fileName: z.string().optional(),
});

function resolveMimeType(mimeType: string, fileName?: string): string | null {
  if (ALLOWED_MIME_TYPES.includes(mimeType)) return mimeType;
  if (fileName) return mimeTypeFromFileName(fileName);
  return null;
}

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

  const mimeType = resolveMimeType(parsed.data.mimeType, parsed.data.fileName);
  if (!mimeType) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
  }

  const ext = mimeType.split("/")[1] === "jpeg" ? "jpg" : mimeType.split("/")[1];
  const content = await prisma.content.create({
    data: {
      userId: session.user.id,
      status: "UPLOADING",
      mimeType,
      fileSize: parsed.data.fileSize,
    },
  });

  const objectKey = `originals/${session.user.id}/${content.id}/${uuidv4()}.${ext}`;
  await prisma.content.update({
    where: { id: content.id },
    data: { originalObjectKey: objectKey },
  });

  if (isR2Configured()) {
    return NextResponse.json({
      contentId: content.id,
      serverUpload: true,
      objectKey,
    });
  }

  return NextResponse.json({
    contentId: content.id,
    uploadUrl: null,
    mockMode: true,
    message: "R2 not configured - upload via server in dev",
  });
}
