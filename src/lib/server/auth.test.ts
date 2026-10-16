import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LocalAuthStore } from "./auth";

describe("local single-user authentication", () => {
  let db: Database.Database;
  let auth: LocalAuthStore;
  beforeEach(() => { db = new Database(":memory:"); auth = new LocalAuthStore(db); });
  afterEach(() => db.close());

  it("allows exactly one initial password setup and returns a verifiable opaque session", async () => {
    const now = 1_800_000_000_000;
    expect(auth.needsSetup()).toBe(true);
    const token = await auth.setup("test-only-passphrase-with-enough-length", now);
    expect(token).toEqual(expect.any(String));
    expect(auth.needsSetup()).toBe(false);
    expect(auth.verify(token!, now + 1)).toBe(true);
    expect(await auth.setup("another-test-password-long-enough", now + 2)).toBeNull();
  });

  it("authenticates only the configured password and expires sessions", async () => {
    const now = 1_800_000_000_000;
    const password = "test-only-passphrase-with-enough-length";
    await auth.setup(password, now);
    expect(await auth.login("wrong-test-passphrase-but-long-enough", now + 1)).toBeNull();
    const token = await auth.login(password, now + 2);
    expect(token).toEqual(expect.any(String));
    expect(auth.verify(token!, now + 3)).toBe(true);
    expect(auth.verify(token!, now + 7 * 24 * 60 * 60 * 1000 + 3)).toBe(false);
  });

  it("rate limits repeated failed logins and permits access after the lockout", async () => {
    const now = 1_800_000_000_000;
    const password = "test-only-passphrase-with-enough-length";
    await auth.setup(password, now);
    for (let attempt = 0; attempt < 5; attempt += 1) await auth.login("wrong-test-passphrase-but-long-enough", now + attempt + 1);
    expect(auth.isLoginLocked(now + 6)).toBe(true);
    expect(await auth.login(password, now + 6)).toBeNull();
    const token = await auth.login(password, now + 15 * 60 * 1000 + 6);
    expect(token).toEqual(expect.any(String));
    expect(auth.isLoginLocked(now + 15 * 60 * 1000 + 6)).toBe(false);
  });

  it("revokes the server-side session on logout", async () => {
    const now = 1_800_000_000_000;
    const token = await auth.setup("test-only-passphrase-with-enough-length", now);
    auth.logout(token!);
    expect(auth.verify(token!, now + 1)).toBe(false);
  });

  it("rejects short passwords before storing an account", async () => {
    await expect(auth.setup("short", 1_800_000_000_000)).rejects.toThrow("between 12 and 128 characters");
    expect(auth.needsSetup()).toBe(true);
  });
});
