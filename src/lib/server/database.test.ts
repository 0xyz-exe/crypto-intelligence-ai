import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { createLocalDatabase } from "./database";

const tempRoot = process.env.TMPDIR ?? process.cwd();
const directories: string[] = [];
afterEach(() => { for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true }); });

describe("local SQLite database", () => {
  it("keeps committed data across reopen and enables safe SQLite defaults", () => {
    const directory = mkdtempSync(join(tempRoot, `cia-db-${randomUUID()}-`));
    directories.push(directory);
    const file = join(directory, "app.sqlite");
    const first = createLocalDatabase(file);
    first.exec("CREATE TABLE durable_test (value TEXT NOT NULL)");
    first.prepare("INSERT INTO durable_test(value) VALUES (?)").run("persisted");
    expect(first.pragma("foreign_keys", { simple: true })).toBe(1);
    expect(first.pragma("synchronous", { simple: true })).toBe(2);
    expect(first.pragma("journal_mode", { simple: true })).toBe("wal");
    first.close();

    const reopened = createLocalDatabase(file);
    expect((reopened.prepare("SELECT value FROM durable_test").get() as { value: string }).value).toBe("persisted");
    reopened.close();
  });
});
