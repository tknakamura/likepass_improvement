import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";
import { authConfig } from "@/lib/auth/auth.config";
import type { UserRole, UserStatus } from "@prisma/client";

const demoMode = process.env.DEMO_MODE === "true";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      username?: string | null;
      status: UserStatus;
      role: UserRole;
      onboardingCompletedAt?: Date | null;
      termsAcceptedAt?: Date | null;
    };
  }

  interface User {
    username?: string | null;
    status: UserStatus;
    role: UserRole;
    onboardingCompletedAt?: Date | null;
    termsAcceptedAt?: Date | null;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    username?: string | null;
    status?: UserStatus;
    role?: UserRole;
    onboardingCompletedAt?: string | null;
    termsAcceptedAt?: string | null;
  }
}

async function loadDemoUser() {
  return prisma.user.findUnique({ where: { email: "demo@likepass.local" } });
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: demoMode ? undefined : PrismaAdapter(prisma),
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, account }) {
      if (account?.provider === "demo") {
        const demoUser = await loadDemoUser();
        if (demoUser) {
          token.sub = demoUser.id;
          token.username = demoUser.username;
          token.status = demoUser.status;
          token.role = demoUser.role;
          token.onboardingCompletedAt = demoUser.onboardingCompletedAt?.toISOString() ?? null;
          token.termsAcceptedAt = demoUser.termsAcceptedAt?.toISOString() ?? null;
        }
      } else if (user) {
        token.sub = user.id;
        token.username = user.username;
        token.status = user.status;
        token.role = user.role;
        token.onboardingCompletedAt = user.onboardingCompletedAt?.toISOString() ?? null;
        token.termsAcceptedAt = user.termsAcceptedAt?.toISOString() ?? null;
      }
      return token;
    },
    async session({ session, token, user }) {
      if (demoMode && token?.sub) {
        session.user.id = token.sub;
        session.user.username = token.username as string | null;
        session.user.status = (token.status as UserStatus) ?? "ACTIVE";
        session.user.role = (token.role as UserRole) ?? "USER";
        session.user.onboardingCompletedAt = token.onboardingCompletedAt
          ? new Date(token.onboardingCompletedAt as string)
          : null;
        session.user.termsAcceptedAt = token.termsAcceptedAt
          ? new Date(token.termsAcceptedAt as string)
          : null;
      } else if (user && session.user) {
        session.user.id = user.id;
        session.user.username = user.username;
        session.user.status = user.status;
        session.user.role = user.role;
        session.user.onboardingCompletedAt = user.onboardingCompletedAt;
        session.user.termsAcceptedAt = user.termsAcceptedAt;
      }
      return session;
    },
    async signIn({ user, account }) {
      if (account?.provider === "demo") {
        const demoUser = await loadDemoUser();
        return !!demoUser;
      }
      if (!account || account.provider !== "google") return true;

      const adminEmails = (process.env.ADMIN_EMAIL_ALLOWLIST ?? "")
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean);

      if (user.email && adminEmails.includes(user.email)) {
        await prisma.user.update({
          where: { id: user.id },
          data: { role: "ADMIN" },
        });
      }

      return true;
    },
  },
});
