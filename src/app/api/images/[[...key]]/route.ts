import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getObjectBuffer } from "@/lib/r2";
import { readLocalImage } from "@/lib/local-images";
import { canViewContent, contentIdFromObjectKey } from "@/server/services/content/access";

async function findContentForObjectKey(objectKey: string) {
  const fromProcessed = contentIdFromObjectKey(objectKey);
  if (fromProcessed) {
    return prisma.content.findUnique({
      where: { id: fromProcessed },
      select: { id: true, userId: true, status: true },
    });
  }

  return prisma.content.findFirst({
    where: {
      OR: [
        { originalObjectKey: objectKey },
        { largeObjectKey: objectKey },
        { mediumObjectKey: objectKey },
        { thumbnailObjectKey: objectKey },
      ],
    },
    select: { id: true, userId: true, status: true },
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key?: string[] }> },
) {
  const { key } = await params;
  if (!key?.length) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const objectKey = key.map(decodeURIComponent).join("/");

  const content = await findContentForObjectKey(objectKey);
  if (content) {
    const session = await auth();
    if (
      !canViewContent({
        status: content.status,
        ownerId: content.userId,
        viewerId: session?.user?.id,
        viewerRole: session?.user?.role,
      })
    ) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  const fromR2 = await getObjectBuffer(objectKey);
  const buffer = fromR2 ?? (await readLocalImage(objectKey));

  if (!buffer) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const contentType = objectKey.endsWith(".webp")
    ? "image/webp"
    : objectKey.endsWith(".png")
      ? "image/png"
      : "image/jpeg";

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": content ? "private, max-age=60" : "public, max-age=31536000, immutable",
    },
  });
}
