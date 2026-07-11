import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";

const demoMode = process.env.DEMO_MODE === "true";

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
        return {
          id: "demo-user-placeholder",
          email: "demo@likepass.local",
          name: "Demo User",
          status: "ACTIVE" as const,
          role: "USER" as const,
        };
      },
    })
  );
}

export const authConfig = {
  providers,
  pages: {
    signIn: "/signin",
  },
  session: {
    strategy: demoMode ? "jwt" : "database",
  },
  trustHost: process.env.AUTH_TRUST_HOST === "true",
  secret: process.env.AUTH_SECRET,
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const protectedPaths = ["/evaluate", "/upload", "/onboarding", "/me", "/notifications", "/admin"];
      const isProtected = protectedPaths.some(
        (p) => nextUrl.pathname === p || nextUrl.pathname.startsWith(`${p}/`)
      );
      if (isProtected) return !!auth?.user;
      return true;
    },
  },
} satisfies NextAuthConfig;
