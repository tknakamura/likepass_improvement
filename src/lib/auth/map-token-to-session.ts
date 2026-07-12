import type { Session } from "next-auth";
import type { JWT } from "@auth/core/jwt";
import type { UserRole, UserStatus } from "@prisma/client";

type SessionUser = Session["user"] & {
  id: string;
  username?: string | null;
  status: UserStatus;
  role: UserRole;
  onboardingCompletedAt?: Date | null;
  termsAcceptedAt?: Date | null;
};

export function mapTokenToSession(session: Session, token: JWT): Session {
  if (!session.user || !token.sub) return session;

  const user = session.user as SessionUser;
  user.id = token.sub;
  user.username = (token.username as string | null | undefined) ?? null;
  user.status = (token.status as UserStatus | undefined) ?? "ACTIVE";
  user.role = (token.role as UserRole | undefined) ?? "USER";
  user.onboardingCompletedAt = token.onboardingCompletedAt
    ? new Date(token.onboardingCompletedAt as string)
    : null;
  user.termsAcceptedAt = token.termsAcceptedAt
    ? new Date(token.termsAcceptedAt as string)
    : null;

  return session;
}
