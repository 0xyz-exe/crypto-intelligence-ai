import { expect, test } from "@playwright/test";

const testPassword = "e2e-only-passphrase-with-enough-length";

test("first-run onboarding creates the single local account and opens the dashboard", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Set up your local account" })).toBeVisible();
  await page.getByLabel("Local password").fill(testPassword);
  await page.getByRole("button", { name: "Create local account" }).click();
  await expect(page.getByRole("heading", { name: "Market overview" })).toBeVisible();
  await expect(page.getByLabel("Local password")).toHaveCount(0);
  expect(await page.evaluate(() => document.cookie.includes("cia_session"))).toBe(false);
  const cookie = (await page.context().cookies()).find((item) => item.name === "cia_session");
  expect(cookie?.httpOnly).toBe(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Market overview" })).toBeVisible();
});
