import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import type Database from "better-sqlite3";

export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_MAX_LENGTH = 128;
const HASH_BYTES = 64;

function derivePassword(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, HASH_BYTES, { N: 32_768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, key) => {
      if (error) reject(error);
      else resolve(key as Buffer);
    });
  });
}

function tokenHash(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function isSessionToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{40,64}$/.test(token);
}

function validatePassword(password: string): void {
  const length = [...password].length;
  if (length < PASSWORD_MIN_LENGTH || length > PASSWORD_MAX_LENGTH) {
    throw new Error(`Password must be between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters.`);
  }
}

export class LocalAuthStore {
  constructor(private readonly db: Database.Database) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS local_user (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        salt TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        created_at INTEGER NOT NULL
      ) STRICT;
      CREATE TABLE IF NOT EXISTS auth_sessions (
        token_hash TEXT PRIMARY KEY CHECK (length(token_hash) = 64),
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      ) STRICT;
      CREATE INDEX IF NOT EXISTS auth_sessions_expiry ON auth_sessions(expires_at);
      CREATE TABLE IF NOT EXISTS auth_login_attempts (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        failed_attempts INTEGER NOT NULL CHECK (failed_attempts >= 0),
        locked_until INTEGER NOT NULL CHECK (locked_until >= 0)
      ) STRICT;
      INSERT INTO auth_login_attempts (id, failed_attempts, locked_until) VALUES (1, 0, 0)
        ON CONFLICT(id) DO NOTHING;
    `);
  }

  needsSetup(): boolean {
    return !this.db.prepare("SELECT 1 FROM local_user WHERE id = 1").get();
  }

  async setup(password: string, now: number): Promise<string | null> {
    validatePassword(password);
    if (!Number.isSafeInteger(now) || now < 0) throw new Error("Invalid authentication time.");
    const salt = randomBytes(16).toString("hex");
    const passwordHash = (await derivePassword(password, salt)).toString("hex");
    const create = this.db.transaction(() => {
      if (!this.needsSetup()) return null;
      this.db.prepare("INSERT INTO local_user (id, salt, password_hash, created_at) VALUES (1, ?, ?, ?)").run(salt, passwordHash, now);
      return this.issueSession(now);
    });
    return create();
  }

  isLoginLocked(now: number): boolean {
    if (!Number.isSafeInteger(now) || now < 0) return true;
    const state = this.db.prepare("SELECT failed_attempts, locked_until FROM auth_login_attempts WHERE id = 1").get() as { failed_attempts: number; locked_until: number };
    if (state.locked_until === 0) return false;
    if (state.locked_until <= now) {
      this.db.prepare("UPDATE auth_login_attempts SET failed_attempts = 0, locked_until = 0 WHERE id = 1").run();
      return false;
    }
    return true;
  }

  async login(password: string, now: number): Promise<string | null> {
    if (!Number.isSafeInteger(now) || now < 0 || [...password].length > PASSWORD_MAX_LENGTH || this.isLoginLocked(now)) return null;
    const user = this.db.prepare("SELECT salt, password_hash FROM local_user WHERE id = 1").get() as { salt: string; password_hash: string } | undefined;
    if (!user) {
      this.recordLoginFailure(now);
      return null;
    }
    const candidate = await derivePassword(password, user.salt);
    const expected = Buffer.from(user.password_hash, "hex");
    if (candidate.length !== expected.length || !timingSafeEqual(candidate, expected)) {
      this.recordLoginFailure(now);
      return null;
    }
    return this.db.transaction(() => {
      this.db.prepare("UPDATE auth_login_attempts SET failed_attempts = 0, locked_until = 0 WHERE id = 1").run();
      return this.issueSession(now);
    })();
  }

  verify(token: string, now: number): boolean {
    if (!isSessionToken(token) || !Number.isSafeInteger(now) || now < 0) return false;
    const hash = tokenHash(token);
    const session = this.db.prepare("SELECT expires_at FROM auth_sessions WHERE token_hash = ?").get(hash) as { expires_at: number } | undefined;
    if (!session) return false;
    if (session.expires_at <= now) {
      this.db.prepare("DELETE FROM auth_sessions WHERE token_hash = ?").run(hash);
      return false;
    }
    return true;
  }

  logout(token: string): void {
    if (isSessionToken(token)) this.db.prepare("DELETE FROM auth_sessions WHERE token_hash = ?").run(tokenHash(token));
  }

  private recordLoginFailure(now: number): void {
    this.db.transaction(() => {
      const state = this.db.prepare("SELECT failed_attempts FROM auth_login_attempts WHERE id = 1").get() as { failed_attempts: number };
      const failedAttempts = state.failed_attempts + 1;
      const lockedUntil = failedAttempts >= 5 ? now + 15 * 60 * 1000 : 0;
      this.db.prepare("UPDATE auth_login_attempts SET failed_attempts = ?, locked_until = ? WHERE id = 1").run(failedAttempts, lockedUntil);
    })();
  }

  private issueSession(now: number): string {
    this.db.prepare("DELETE FROM auth_sessions WHERE expires_at <= ?").run(now);
    const token = randomBytes(32).toString("base64url");
    this.db.prepare("INSERT INTO auth_sessions (token_hash, created_at, expires_at) VALUES (?, ?, ?)").run(tokenHash(token), now, now + SESSION_TTL_MS);
    return token;
  }
}
