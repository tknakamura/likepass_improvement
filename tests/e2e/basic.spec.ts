import { test, expect } from "@playwright/test";

test("landing page loads", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "LIKEPASS" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Googleで続ける" })).toBeVisible();
});

test("ranking page is accessible", async ({ page }) => {
  await page.goto("/ranking");
  await expect(page.getByRole("heading", { name: "タグランキング" })).toBeVisible();
});

test("terms page loads", async ({ page }) => {
  await page.goto("/terms");
  await expect(page.getByRole("heading", { name: "利用規約" })).toBeVisible();
});
