import "server-only";
import Database from "better-sqlite3";
import { chmodSync, mkdirSync } from "node:fs";
import { homedir, platform } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { LocalAuthStore } from "./auth";
import { PaperService } from "./paper-service";
import { getFreshPaperQuotes } from "../market-data/provider";

type AppGlobals = typeof globalThis & {
  __ciaDatabase?: Database.Database;
  __ciaAuthStore?: LocalAuthStore;
  __ciaPaperService?: PaperService;
};

const appGlobals = globalThis as AppGlobals;

export function getLocalDataDirectory(): string {
  const configuredDirectory = process.env.CIA_DATA_DIR;
  if (configuredDirectory) return resolve(configuredDirectory);
  const root = platform() === "win32"
    ? process.env.LOCALAPPDATA || join(homedir(), "AppData", "Local")
    : join(homedir(), ".local", "share");
  return join(root, "CryptoIntelligenceAI");
}

export function createLocalDatabase(filePath: string): Database.Database {
  if (!isAbsolute(filePath)) throw new Error("The local database path must be absolute.");
  mkdirSync(dirname(filePath), { recursive: true, mode: 0o700 });
  const db = new Database(filePath, { timeout: 5_000 });
  try {
    db.pragma("journal_mode = WAL");
    db.pragma("synchronous = FULL");
    db.pragma("foreign_keys = ON");
    if (platform() !== "win32") {
      chmodSync(dirname(filePath), 0o700);
      chmodSync(filePath, 0o600);
    }
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}

export function getDatabase(): Database.Database {
  if (!appGlobals.__ciaDatabase) {
    const filePath = join(getLocalDataDirectory(), "app.sqlite");
    appGlobals.__ciaDatabase = createLocalDatabase(filePath);
  }
  return appGlobals.__ciaDatabase;
}

export function getAuthStore(): LocalAuthStore {
  if (!appGlobals.__ciaAuthStore) appGlobals.__ciaAuthStore = new LocalAuthStore(getDatabase());
  return appGlobals.__ciaAuthStore;
}

export function getPaperService(): PaperService {
  if (!appGlobals.__ciaPaperService) appGlobals.__ciaPaperService = new PaperService(getDatabase(), getFreshPaperQuotes);
  return appGlobals.__ciaPaperService;
}
