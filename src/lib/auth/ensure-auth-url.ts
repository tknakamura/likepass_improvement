/**
 * Auth.js uses AUTH_URL for OAuth callback URLs. On Render, Next.js binds to
 * 0.0.0.0 internally, so without AUTH_URL the browser can be redirected there.
 */
export function ensureAuthUrl(): void {
  if (process.env.AUTH_URL?.trim()) return;

  const candidate =
    process.env.APP_URL?.trim() ||
    process.env.RENDER_EXTERNAL_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);

  if (candidate) {
    process.env.AUTH_URL = candidate.replace(/\/$/, "");
  }
}
