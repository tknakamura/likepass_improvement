import { NextResponse } from "next/server";
import { getObjectBuffer } from "@/lib/r2";
import { readLocalImage } from "@/lib/local-images";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key?: string[] }> }
) {
  const { key } = await params;
  if (!key?.length) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const objectKey = key.map(decodeURIComponent).join("/");

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
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
