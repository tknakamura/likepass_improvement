import { S3Client, PutObjectCommand, HeadObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function getR2Client() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    return null;
  }

  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

export function getPublicImageUrl(objectKey: string): string {
  const base = process.env.R2_PUBLIC_BASE_URL;
  if (!base) return `/api/images/${encodeURIComponent(objectKey)}`;
  return `${base.replace(/\/$/, "")}/${objectKey}`;
}

export async function createPresignedUploadUrl(
  objectKey: string,
  contentType: string,
  expiresIn = 300
): Promise<string | null> {
  const client = getR2Client();
  const bucket = process.env.R2_BUCKET_NAME;
  if (!client || !bucket) return null;

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: objectKey,
    ContentType: contentType,
  });

  return getSignedUrl(client, command, { expiresIn });
}

export async function objectExists(objectKey: string): Promise<boolean> {
  const client = getR2Client();
  const bucket = process.env.R2_BUCKET_NAME;
  if (!client || !bucket) return false;

  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: objectKey }));
    return true;
  } catch {
    return false;
  }
}

export async function getObjectBuffer(objectKey: string): Promise<Buffer | null> {
  const client = getR2Client();
  const bucket = process.env.R2_BUCKET_NAME;
  if (!client || !bucket) return null;

  const response = await client.send(
    new GetObjectCommand({ Bucket: bucket, Key: objectKey })
  );

  const bytes = await response.Body?.transformToByteArray();
  return bytes ? Buffer.from(bytes) : null;
}

export async function putObject(objectKey: string, body: Buffer, contentType: string): Promise<void> {
  const client = getR2Client();
  const bucket = process.env.R2_BUCKET_NAME;
  if (!client || !bucket) throw new Error("R2 not configured");

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      Body: body,
      ContentType: contentType,
    })
  );
}

export const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_FILE_SIZE = 15 * 1024 * 1024;
