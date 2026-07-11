import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

const ROOT = process.env.LOCAL_IMAGE_DIR ?? path.join(process.cwd(), ".data", "images");

function resolvePath(objectKey: string): string {
  const safe = objectKey.replace(/\.\./g, "");
  return path.join(ROOT, safe);
}

export async function saveLocalImage(objectKey: string, body: Buffer): Promise<void> {
  const filePath = resolvePath(objectKey);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, body);
}

export async function readLocalImage(objectKey: string): Promise<Buffer | null> {
  try {
    return await readFile(resolvePath(objectKey));
  } catch {
    return null;
  }
}

export function isR2Configured(): boolean {
  return !!(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME
  );
}
