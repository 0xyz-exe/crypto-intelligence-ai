import { defineConfig, devices } from "@playwright/test";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const e2eDataDir = resolve(process.env.CIA_E2E_DATA_DIR ?? join(process.env.TMPDIR ?? tmpdir(), `crypto-intelligence-ai-e2e-${process.pid}`));
process.env.CIA_E2E_DATA_DIR = e2eDataDir;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:3100", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
    timeout: 120_000,
    env: { CIA_DATA_DIR: e2eDataDir },
  },
});
