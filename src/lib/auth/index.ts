import NextAuth, { type NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";
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

const providers: NextAuthConfig["providers"] = [
  Google({
    clientId: process.env.AUTH_GOOGLE_ID!,
    clientSecret: process.env.AUTH_GOOGLE_SECRET!,
  }),
];

if (demoMode) {
  providers.push(
    Credentials({
      id: "demo",
      name: "Demo",
      credentials: {},
      authorize: async () => {
        const user = await prisma.user.findUnique({
          where: { email: "demo@likepass.local" },
        });
        return user;
      },
    })
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers,
  session: { strategy: "database" },
  pages: {
    signIn: "/signin",
  },
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
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
      if (!account || account.provider === "demo" || account.provider === "credentials") {
        return true;
      }
      if (account.provider !== "google") return true;

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
  trustHost: process.env.AUTH_TRUST_HOST === "true",
  secret: process.env.AUTH_SECRET,
});
