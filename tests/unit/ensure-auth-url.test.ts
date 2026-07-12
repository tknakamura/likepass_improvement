import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ensureAuthUrl } from "@/lib/auth/ensure-auth-url";

describe("ensureAuthUrl", () => {
  const original = { ...process.env };

  beforeEach(() => {
    process.env = { ...original };
    delete process.env.AUTH_URL;
    delete process.env.APP_URL;
    delete process.env.RENDER_EXTERNAL_URL;
    delete process.env.VERCEL_URL;
  });

  afterEach(() => {
    process.env = original;
  });

  it("sets AUTH_URL from RENDER_EXTERNAL_URL on Render", () => {
    process.env.RENDER_EXTERNAL_URL = "https://likepass-web.onrender.com";
    ensureAuthUrl();
    expect(process.env.AUTH_URL).toBe("https://likepass-web.onrender.com");
  });

  it("does not override an existing AUTH_URL", () => {
    process.env.AUTH_URL = "https://example.com";
    process.env.RENDER_EXTERNAL_URL = "https://likepass-web.onrender.com";
    ensureAuthUrl();
    expect(process.env.AUTH_URL).toBe("https://example.com");
  });
});
