import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LocalAuthStore } from "./auth";
import { createLocalDatabase } from "./database";
import { PaperService, type PaperQuote } from "./paper-service";

const tempRoot = process.env.TMPDIR ?? process.cwd();
const directories: string[] = [];
const databases: ReturnType<typeof createLocalDatabase>[] = [];
afterEach(() => {
  vi.restoreAllMocks();
  for (const db of databases.splice(0)) if (db.open) db.close();
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function setup() {
  const directory = mkdtempSync(join(tempRoot, `cia-paper-${randomUUID()}-`));
  directories.push(directory);
  const file = join(directory, "app.sqlite");
  const db = createLocalDatabase(file);
  databases.push(db);
  const auth = new LocalAuthStore(db);
  return { file, db, auth };
}

function quoteProvider(receivedAt: number) {
  return async (assetIds: string[]): Promise<Record<string, PaperQuote>> => Object.fromEntries(assetIds.map((assetId) => [assetId, { bid: 99, ask: 101, price: 100, receivedAt }]));
}

const testPassword = "test-only-password-not-for-use";

describe("server paper account service", () => {
  it("persists paper orders and fresh marks across database reopen, scoped to the local owner", async () => {
    const { file, db, auth } = setup();
    await auth.setup(testPassword, 1_000);
    const service = new PaperService(db, quoteProvider(1_000));
    expect(service.getAccount(2)).toBeNull();
    await expect(service.placeOrder(2, { orderId: "paper-foreign-owner-1", action: "buy", assetId: "bitcoin", requestedNotional: 100 }, 1_000)).rejects.toThrow("Local paper account owner not found.");
    const opened = await service.placeOrder(1, { orderId: "paper-order-1", action: "buy", assetId: "bitcoin", requestedNotional: 100 }, 1_000);
    expect(opened.accepted).toBe(true);
    expect(opened.account.positions).toHaveLength(1);

    const marked = await service.markToMarket(1, 7_000, quoteProvider(7_000));
    expect(marked.equityCurve).toHaveLength(3);
    expect(db.prepare("SELECT COUNT(*) AS count FROM paper_marks WHERE owner_id = ?").get(1)).toEqual({ count: 1 });
    const tooSoon = await service.markToMarket(1, 11_999, quoteProvider(11_999));
    expect(tooSoon.equityCurve).toHaveLength(3);
    db.close();

    const reopened = createLocalDatabase(file);
    databases.push(reopened);
    const persisted = new PaperService(reopened, quoteProvider(12_000)).getAccount(1);
    expect(persisted?.positions).toHaveLength(1);
    expect(persisted?.equityCurve).toHaveLength(3);
    expect(persisted?.processedOrderIds).toContain("paper-order-1");
    reopened.close();
  });

  it("persists the kill switch and refuses an order while halted", async () => {
    const { file, db, auth } = setup();
    await auth.setup(testPassword, 1_000);
    const service = new PaperService(db, quoteProvider(2_000));
    service.getAccount(1);
    service.setHalted(true, 1_500);
    const blocked = await service.placeOrder(1, { orderId: "paper-order-halted", action: "buy", assetId: "bitcoin", requestedNotional: 100 }, 2_000);
    expect(blocked.accepted).toBe(false);
    expect(blocked.reason).toBe("trading_halted");
    expect(blocked.account.positions).toHaveLength(0);
    db.close();

    const reopened = createLocalDatabase(file);
    const restored = new PaperService(reopened, quoteProvider(3_000));
    expect(restored.getControl().halted).toBe(true);
    const stillBlocked = await restored.placeOrder(1, { orderId: "paper-order-halted-2", action: "buy", assetId: "bitcoin", requestedNotional: 100 }, 3_000);
    expect(stillBlocked.reason).toBe("trading_halted");
    reopened.close();
  });

  it("leaves the persisted paper account unchanged when fresh quotes are unavailable", async () => {
    const { db, auth } = setup();
    await auth.setup(testPassword, 1_000);
    const service = new PaperService(db, quoteProvider(1_000));
    await service.placeOrder(1, { orderId: "paper-order-stale-mark-1", action: "buy", assetId: "bitcoin", requestedNotional: 100 }, 1_000);
    const before = service.getAccount(1);
    await expect(service.markToMarket(1, 14_000, quoteProvider(1_000))).rejects.toThrow("Fresh supported market quotes are unavailable.");
    expect(service.getAccount(1)).toEqual(before);
    expect(db.prepare("SELECT COUNT(*) AS count FROM paper_marks WHERE owner_id = ?").get(1)).toEqual({ count: 0 });
    db.close();
  });

  it("rechecks the persisted halt after an awaited quote fetch", async () => {
    const { db, auth } = setup();
    await auth.setup(testPassword, 1_000);
    let resolveQuotes: ((quotes: Record<string, PaperQuote>) => void) | undefined;
    const delayedQuotes = new Promise<Record<string, PaperQuote>>((resolve) => { resolveQuotes = resolve; });
    const service = new PaperService(db, async () => delayedQuotes);
    const pending = service.placeOrder(1, { orderId: "paper-order-race-001", action: "buy", assetId: "bitcoin", requestedNotional: 100 }, 2_000);
    service.setHalted(true, 2_000);
    resolveQuotes?.({ bitcoin: { bid: 99, ask: 101, price: 100, receivedAt: 2_000 } });
    const result = await pending;
    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("trading_halted");
    expect(result.account.positions).toHaveLength(0);
    db.close();
  });

  it("returns the original result for a duplicate order id", async () => {
    const { db, auth } = setup();
    await auth.setup(testPassword, 1_000);
    const service = new PaperService(db, quoteProvider(2_000));
    const request = { orderId: "paper-order-once", action: "buy" as const, assetId: "bitcoin", requestedNotional: 100 };
    const first = await service.placeOrder(1, request, 2_000);
    const retry = await service.placeOrder(1, request, 2_001);
    expect(first.accepted).toBe(true);
    expect(retry.account).toEqual(first.account);
    expect(retry.duplicate).toBe(true);
    expect(service.getAccount(1)?.positions).toHaveLength(1);
    db.close();
  });

  it("validates fresh quote timestamps after the async provider returns", async () => {
    const { db, auth } = setup();
    await auth.setup(testPassword, 1_000);
    let now = 2_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    const service = new PaperService(db, async (assetIds) => {
      now = 3_500;
      return quoteProvider(now)(assetIds);
    });
    const result = await service.placeOrder(1, { orderId: "paper-order-fresh-time-01", action: "buy", assetId: "bitcoin", requestedNotional: 100 });
    expect(result.accepted).toBe(true);
    expect(result.account.positions).toHaveLength(1);
    db.close();
  });

  it("rolls back account state if the idempotency event cannot be committed", async () => {
    const { db, auth } = setup();
    await auth.setup(testPassword, 1_000);
    const service = new PaperService(db, quoteProvider(2_000));
    const initial = service.getOrCreateAccount(1, 1_000);
    db.exec("CREATE TRIGGER reject_paper_order BEFORE INSERT ON paper_orders BEGIN SELECT RAISE(ABORT, 'test transaction rollback'); END");
    await expect(service.placeOrder(1, { orderId: "paper-order-rollback", action: "buy", assetId: "bitcoin", requestedNotional: 100 }, 2_000)).rejects.toThrow("test transaction rollback");
    expect(service.getAccount(1)).toEqual(initial);
    db.close();
  });
});
