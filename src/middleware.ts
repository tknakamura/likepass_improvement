import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const protectedPaths = [
  "/evaluate",
  "/upload",
  "/onboarding",
  "/me",
  "/notifications",
  "/admin",
];

const authFlowPaths = ["/onboarding", "/signin/setup"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = await auth();

  const isProtected = protectedPaths.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );

  if (isProtected && !session?.user) {
    const signInUrl = new URL("/signin", request.url);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signInUrl);
  }

  if (session?.user) {
    const needsSetup =
      !session.user.termsAcceptedAt || !session.user.username;
    const needsOnboarding = !session.user.onboardingCompletedAt;

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

    if (
      session.user.role !== "ADMIN" &&
      pathname.startsWith("/admin")
    ) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/evaluate/:path*",
    "/upload/:path*",
    "/onboarding/:path*",
    "/me/:path*",
    "/notifications/:path*",
    "/admin/:path*",
    "/signin/setup",
  ],
};
