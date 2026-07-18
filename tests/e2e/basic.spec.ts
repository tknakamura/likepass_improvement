import { test, expect } from "@playwright/test";

test("landing page loads", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "LIKEPASS" })).toBeVisible();

  const demoMode = process.env.DEMO_MODE === "true";
  if (demoMode) {
    await expect(page.getByRole("button", { name: "デモで評価を試す" })).toBeVisible();
  } else {
    await expect(page.getByRole("link", { name: "Googleで続ける" })).toBeVisible();
  }
});

test("ranking page is accessible", async ({ page }) => {
  await page.goto("/ranking");
  await expect(page.getByRole("heading", { name: "タグランキング" })).toBeVisible();
});

test("terms page loads", async ({ page }) => {
  await page.goto("/terms");
  await expect(page.getByRole("heading", { name: "利用規約" })).toBeVisible();
});

test("demo sign-in and evaluate page", async ({ page }) => {
  const demoMode = process.env.DEMO_MODE === "true";
  test.skip(!demoMode, "Requires DEMO_MODE=true");

  await page.goto("/signin");
  await page.getByRole("button", { name: /デモで/ }).click();
  await page.waitForURL(/\/(evaluate|onboarding|ranking|me)/, { timeout: 15000 });

  if (page.url().includes("/onboarding")) {
    await page.getByRole("button", { name: "次へ" }).click();
    await page.getByRole("button", { name: "次へ" }).click();
    const tags = page.locator('button:has-text("#")');
    const count = await tags.count();
    for (let i = 0; i < Math.min(3, count); i++) {
      await tags.nth(i).click();
    }
    await page.getByRole("button", { name: "評価を始める" }).click();
  }

  await page.goto("/evaluate");
  await expect(page.getByRole("button", { name: "LIKE" })).toBeVisible();
  await expect(page.getByRole("button", { name: "PASS" })).toBeVisible();
});

test("my page dashboard", async ({ page }) => {
  const demoMode = process.env.DEMO_MODE === "true";
  test.skip(!demoMode, "Requires DEMO_MODE=true");

  await page.goto("/signin");
  await page.getByRole("button", { name: /デモで/ }).click();
  await page.waitForURL(/\/(evaluate|onboarding|ranking|me)/, { timeout: 15000 });

  await page.goto("/me");
  await expect(page.getByText("評価を続ける")).toBeVisible();
  await expect(page.getByText("投稿する")).toBeVisible();
});

test("discover page lists tags", async ({ page }) => {
  const demoMode = process.env.DEMO_MODE === "true";
  test.skip(!demoMode, "Requires DEMO_MODE=true");

  await page.goto("/signin");
  await page.getByRole("button", { name: /デモで/ }).click();
  await page.waitForURL(/\/(evaluate|onboarding|ranking|me)/, { timeout: 15000 });

  await page.goto("/discover");
  await expect(page.getByRole("heading", { name: "発見" })).toBeVisible();
});

test("upload page is accessible", async ({ page }) => {
  const demoMode = process.env.DEMO_MODE === "true";
  test.skip(!demoMode, "Requires DEMO_MODE=true");

  await page.goto("/signin");
  await page.getByRole("button", { name: /デモで/ }).click();
  await page.waitForURL(/\/(evaluate|onboarding|ranking|me)/, { timeout: 15000 });

  await page.goto("/upload");
  await expect(page.getByRole("heading", { name: "写真を投稿" })).toBeVisible();
});

test("NPC reviewing content is hidden from other users", async ({ page, browser }) => {
  const demoMode = process.env.DEMO_MODE === "true";
  test.skip(!demoMode, "Requires DEMO_MODE=true");

  // Owner signs in and opens their posts; if any NPC審査中 badge exists, capture its href.
  await page.goto("/signin");
  await page.getByRole("button", { name: /デモで/ }).click();
  await page.waitForURL(/\/(evaluate|onboarding|ranking|me)/, { timeout: 15000 });

  await page.goto("/me/posts");
  await expect(page.getByRole("heading", { name: "自分の投稿" })).toBeVisible();

  const reviewing = page.locator("a", { hasText: "NPC審査中" }).first();
  if ((await reviewing.count()) === 0) {
    test.skip(true, "No NPC_REVIEWING posts in demo data");
    return;
  }

  const href = await reviewing.getAttribute("href");
  expect(href).toBeTruthy();

  // Anonymous visitor must not see the reviewing content detail.
  const anon = await browser.newPage();
  const res = await anon.goto(href!);
  expect(res?.status()).toBe(404);
  await anon.close();
});

test("likes gallery page is accessible", async ({ page }) => {
  const demoMode = process.env.DEMO_MODE === "true";
  test.skip(!demoMode, "Requires DEMO_MODE=true");

  await page.goto("/signin");
  await page.getByRole("button", { name: /デモで/ }).click();
  await page.waitForURL(/\/(evaluate|onboarding|ranking|me)/, { timeout: 15000 });

  await page.goto("/me/likes");
  await expect(page.getByRole("heading", { name: "LIKEした画像" })).toBeVisible();
});
