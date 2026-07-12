import { ALLOWED_MIME_TYPES } from "@/lib/r2";

const EXT_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export function mimeTypeFromFileName(fileName: string): string | null {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (!ext) return null;
  const mime = EXT_TO_MIME[ext];
  return mime && ALLOWED_MIME_TYPES.includes(mime) ? mime : null;
}

export function normalizeImageMimeType(file: File): string | null {
  if (file.type && ALLOWED_MIME_TYPES.includes(file.type)) {
    return file.type;
  }
  return mimeTypeFromFileName(file.name);
}
