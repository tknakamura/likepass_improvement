import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth/auth.config";

const { auth } = NextAuth(authConfig);

const authFlowPaths = ["/onboarding", "/signin/setup"];

export default auth((request) => {
  const { pathname } = request.nextUrl;
  const session = request.auth;

  if (session?.user) {
    // Demo mode: seeded user is fully onboarded; auth.config lacks JWT field callbacks
    if (process.env.DEMO_MODE === "true") {
      if (session.user.role !== "ADMIN" && pathname.startsWith("/admin")) {
        return NextResponse.redirect(new URL("/", request.url));
      }
      return NextResponse.next();
    }

    const user = session.user as {
      termsAcceptedAt?: Date | string | null;
      username?: string | null;
      onboardingCompletedAt?: Date | string | null;
      role?: string;
    };

    const needsSetup = !user.termsAcceptedAt || !user.username;
    const needsOnboarding = !user.onboardingCompletedAt;

    if (
      needsSetup &&
      !pathname.startsWith("/signin/setup") &&
      !pathname.startsWith("/api/")
    ) {
      return NextResponse.redirect(new URL("/signin/setup", request.url));
    }

    if (
      !needsSetup &&
      needsOnboarding &&
      !authFlowPaths.some((p) => pathname.startsWith(p)) &&
      !pathname.startsWith("/api/")
    ) {
      return NextResponse.redirect(new URL("/onboarding", request.url));
    }

    if (user.role !== "ADMIN" && pathname.startsWith("/admin")) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/evaluate/:path*",
    "/upload/:path*",
    "/onboarding/:path*",
    "/discover/:path*",
    "/me/:path*",
    "/notifications/:path*",
    "/admin/:path*",
    "/signin/setup",
  ],
};
