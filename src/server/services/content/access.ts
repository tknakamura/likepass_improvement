import type { ContentStatus, UserRole } from "@prisma/client";

const PUBLIC_STATUSES: ContentStatus[] = ["EXPLORING", "ACTIVE", "DORMANT"];

export function isPublicContentStatus(status: ContentStatus): boolean {
  return PUBLIC_STATUSES.includes(status);
}

/**
 * Pre-publish / moderated content is only visible to the owner or an admin.
 */
export function canViewContent(options: {
  status: ContentStatus;
  ownerId: string;
  viewerId?: string | null;
  viewerRole?: UserRole | string | null;
}): boolean {
  if (options.status === "DELETED") return false;
  if (isPublicContentStatus(options.status)) return true;
  if (!options.viewerId) return false;
  if (options.viewerId === options.ownerId) return true;
  if (options.viewerRole === "ADMIN") return true;
  return false;
}

/** Extract contentId from processed object keys like `processed/{contentId}/medium.webp`. */
export function contentIdFromObjectKey(objectKey: string): string | null {
  const match = objectKey.match(/^processed\/([^/]+)\//);
  return match?.[1] ?? null;
}
