import { expect, test } from "@playwright/test";

const password = "e2e-only-passphrase-with-enough-length";
const origin = "http://127.0.0.1:3100";

test("local setup/login creates an HttpOnly session and protects API routes", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async (testPassword) => {
    const status = await fetch("/api/auth/status", { cache: "no-store" }).then((response) => response.json()) as { setupRequired: boolean };
    const path = status.setupRequired ? "/api/auth/setup" : "/api/auth/login";
    const firstAuth = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: testPassword }) });
    const firstAuthText = await firstAuth.text();
    const protectedResponse = await fetch("/api/markets?mode=demo", { cache: "no-store" });
    const cookieVisibleToJavaScript = document.cookie.includes("cia_session");
    const logout = await fetch("/api/auth/logout", { method: "POST" });
    const denied = await fetch("/api/markets?mode=demo", { cache: "no-store" });
    const paperDenied = await fetch("/api/paper/account", { cache: "no-store" });
    const wrongLogin = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: "not-the-test-password-but-long-enough" }) });
    const login = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: testPassword }) });
    const accessAfterLogin = await fetch("/api/markets?mode=demo", { cache: "no-store" });
    return { authStatus: firstAuth.status, authText: firstAuthText, protectedStatus: protectedResponse.status, cookieVisibleToJavaScript, logoutStatus: logout.status, deniedStatus: denied.status, paperDeniedStatus: paperDenied.status, wrongLoginStatus: wrongLogin.status, loginStatus: login.status, accessAfterLoginStatus: accessAfterLogin.status };
  }, password);

  expect([200, 409], result.authText).toContain(result.authStatus);
  expect(result.authText).not.toContain(password);
  expect(result.protectedStatus).toBe(200);
  expect(result.cookieVisibleToJavaScript).toBe(false);
  expect(result.logoutStatus).toBe(200);
  expect(result.deniedStatus).toBe(401);
  expect(result.paperDeniedStatus).toBe(401);
  expect(result.wrongLoginStatus).toBe(401);
  expect(result.loginStatus).toBe(200);
  expect(result.accessAfterLoginStatus).toBe(200);
  const cookie = (await page.context().cookies(origin)).find((item) => item.name === "cia_session");
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.sameSite).toBe("Strict");
});

