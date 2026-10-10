import { test, expect } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";
test("login renders and protected workspace redirects to login", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Sign in to Airmech One" })).toBeVisible();
  await expect(page.getByLabel("Email address")).toBeVisible();
  await page.goto("/customers");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("button", { name: /Sign in to workspace/ })).toBeVisible();
});
test("seeded account opens connected modules and engineer sees only field work", async ({
  page,
}) => {
  test.setTimeout(120000);
  test.skip(
    !existsSync("demo-credentials.local.json"),
    "Requires live Supabase migration and seed.",
  );
  const { password } = JSON.parse(readFileSync("demo-credentials.local.json", "utf8"));
  await page.goto("/login");
  await page.getByLabel("Email address").fill("admin@airmech.demo");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: /Sign in to workspace/ }).click();
  await expect(
    page.getByRole("heading", { name: "Operations Overview", level: 1, exact: true }),
  ).toBeVisible({
    timeout: 20000,
  });
  for (const url of [
    "/customers",
    "/enquiries",
    "/quotations",
    "/equipment",
    "/complaints",
    "/dispatch",
    "/reports",
  ]) {
    await page.goto(url);
    await expect(page.locator("main h1")).toBeVisible({ timeout: 20000 });
    await expect(page.locator(".error-panel")).toHaveCount(0);
  }
  await page.goto("/settings");
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.getByLabel("Email address").fill("engineer@airmech.demo");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: /Sign in to workspace/ }).click();
  await expect(page).toHaveURL(/\/field/);
  await expect(page.getByRole("link", { name: "My jobs", exact: true })).toBeVisible({
    timeout: 20000,
  });
  await page.goto("/quotations");
  await expect(page.getByText("This page could not be found.")).toBeVisible();
});
