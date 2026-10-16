import { rmSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";

export default async function globalTeardown() {
  const directory = process.env.CIA_E2E_DATA_DIR;
  if (!directory) return;
  const root = resolve(process.env.TMPDIR ?? tmpdir());
  const target = resolve(directory);
  if (dirname(target) !== root || !basename(target).startsWith("crypto-intelligence-ai-e2e-")) {
    throw new Error("Refusing to remove an unexpected E2E database path.");
  }
  rmSync(target, { recursive: true, force: true });
}
