import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import { z } from "zod";
import { ASSETS } from "../market-data/schema";
import { buyPaperPosition, closePaperPosition, createPaperAccount, markPaperAccount, parsePaperAccount, type PaperAccount } from "../trading/paper";

export type PaperQuote = { bid: number; ask: number; price: number; receivedAt: number };
export type PaperQuoteProvider = (assetIds: string[]) => Promise<Record<string, PaperQuote>>;
export type PaperOrderRequest = { orderId: string; action: "buy" | "close"; assetId: string; requestedNotional?: number };
export type PaperOrderResult = { accepted: boolean; reason: string; quantity?: number; account: PaperAccount; halted: boolean; duplicate?: boolean };
export type TradingControl = { halted: boolean; updatedAt: number };

const LOCAL_USER_ID = 1;
export const LOCAL_PAPER_OWNER_ID = LOCAL_USER_ID;
const MAX_QUOTE_AGE_MS = 12_000;
const SUPPORTED_ASSETS = new Set<string>(ASSETS.map((asset) => asset.id));
const OrderRequest = z.object({
  orderId: z.string().min(12).max(64).regex(/^[A-Za-z0-9_-]+$/),
  action: z.enum(["buy", "close"]),
  assetId: z.string().refine((value) => SUPPORTED_ASSETS.has(value)),
  requestedNotional: z.number().finite().positive().max(1_000_000).optional(),
}).refine((value) => value.action !== "buy" || value.requestedNotional !== undefined);

function validTime(now: number): void {
  if (!Number.isSafeInteger(now) || now < 0) throw new Error("Invalid paper account time.");
}

function parseStoredAccount(raw: string): PaperAccount {
  let value: unknown;
  try { value = JSON.parse(raw) as unknown; } catch { throw new Error("Stored paper account is invalid."); }
  const account = parsePaperAccount(value);
  if (!account || account.startingBalance !== 10_000 || account.positions.some((position) => !SUPPORTED_ASSETS.has(position.assetId))) {
    throw new Error("Stored paper account is invalid.");
  }
  return account;
}

function parseOrderResult(raw: string): PaperOrderResult {
  const parsed = JSON.parse(raw) as PaperOrderResult;
  const account = parsePaperAccount(parsed.account);
  if (typeof parsed.accepted !== "boolean" || typeof parsed.reason !== "string" || typeof parsed.halted !== "boolean" || !account) {
    throw new Error("Stored paper order result is invalid.");
  }
  return { ...parsed, account };
}

export class PaperService {
  private readonly createAccount: (userId: number, now: number) => PaperAccount;

  constructor(private readonly db: Database.Database, private readonly getQuotes: PaperQuoteProvider, private readonly clock: () => number = Date.now) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS paper_accounts (
        owner_id INTEGER PRIMARY KEY REFERENCES local_user(id) ON DELETE CASCADE,
        account_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      ) STRICT;
      CREATE TABLE IF NOT EXISTS paper_orders (
        owner_id INTEGER NOT NULL REFERENCES local_user(id) ON DELETE CASCADE,
        order_id TEXT NOT NULL,
        action TEXT NOT NULL CHECK (action IN ('buy', 'close')),
        accepted INTEGER NOT NULL CHECK (accepted IN (0, 1)),
        reason TEXT NOT NULL,
        result_json TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (owner_id, order_id)
      ) STRICT;
      CREATE TABLE IF NOT EXISTS paper_marks (
        owner_id INTEGER NOT NULL REFERENCES local_user(id) ON DELETE CASCADE,
        time INTEGER NOT NULL,
        equity REAL NOT NULL CHECK (equity >= 0),
        PRIMARY KEY (owner_id, time)
      ) STRICT;
      CREATE TABLE IF NOT EXISTS trading_control (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        halted INTEGER NOT NULL CHECK (halted IN (0, 1)),
        updated_at INTEGER NOT NULL
      ) STRICT;
      INSERT INTO trading_control (id, halted, updated_at) VALUES (1, 0, 0)
        ON CONFLICT(id) DO NOTHING;
    `);
    this.createAccount = (userId, now) => {
      if (userId !== LOCAL_USER_ID) throw new Error("Local paper account owner not found.");
      validTime(now);
      return createPaperAccount(undefined, now);
    };
  }

  getAccount(userId: number): PaperAccount | null {
    if (!Number.isSafeInteger(userId) || userId <= 0 || !this.db.prepare("SELECT 1 FROM local_user WHERE id = ?").get(userId)) return null;
    const row = this.db.prepare("SELECT account_json FROM paper_accounts WHERE owner_id = ?").get(userId) as { account_json: string } | undefined;
    return row ? parseStoredAccount(row.account_json) : null;
  }

  getOrCreateAccount(userId: number, now = Date.now()): PaperAccount {
    this.assertOwner(userId);
    validTime(now);
    const transaction = this.db.transaction(() => {
      const existing = this.db.prepare("SELECT account_json FROM paper_accounts WHERE owner_id = ?").get(userId) as { account_json: string } | undefined;
      if (existing) return parseStoredAccount(existing.account_json);
      const account = this.createAccount(userId, now);
      this.db.prepare("INSERT INTO paper_accounts (owner_id, account_json, updated_at) VALUES (?, ?, ?)").run(userId, JSON.stringify(account), now);
      return account;
    });
    return transaction.immediate();
  }

  getControl(): TradingControl {
    const row = this.db.prepare("SELECT halted, updated_at FROM trading_control WHERE id = 1").get() as { halted: number; updated_at: number };
    return { halted: row.halted === 1, updatedAt: row.updated_at };
  }

  setHalted(halted: boolean, now = Date.now()): TradingControl {
    if (typeof halted !== "boolean") throw new Error("Invalid paper trading control state.");
    validTime(now);
    const transaction = this.db.transaction(() => {
      this.db.prepare("UPDATE trading_control SET halted = ?, updated_at = ? WHERE id = 1").run(halted ? 1 : 0, now);
      return this.getControl();
    });
    return transaction.immediate();
  }

  async placeOrder(userId: number, input: PaperOrderRequest, now?: number): Promise<PaperOrderResult> {
    const parsed = OrderRequest.safeParse(input);
    if (!parsed.success) throw new Error("Invalid paper order request.");
    const requestTime = now ?? this.clock();
    validTime(requestTime);
    this.assertOwner(userId);
    const { orderId, action, assetId, requestedNotional } = parsed.data;
    this.getOrCreateAccount(userId, requestTime);
    const existing = this.getOrder(userId, orderId);
    if (existing) return { ...existing, duplicate: true };
    const haltedCheck = this.db.transaction(() => {
      const duplicate = this.getOrder(userId, orderId);
      if (duplicate) return { ...duplicate, duplicate: true };
      const account = this.readAccountInTransaction(userId, requestTime);
      if (!this.getControl().halted) return null;
      const blocked: PaperOrderResult = { accepted: false, reason: "trading_halted", account, halted: true };
      this.db.prepare("INSERT INTO paper_orders (owner_id, order_id, action, accepted, reason, result_json, created_at) VALUES (?, ?, ?, 0, ?, ?, ?)").run(userId, orderId, action, blocked.reason, JSON.stringify(blocked), requestTime);
      return blocked;
    });
    const haltedResult = haltedCheck.immediate();
    if (haltedResult) return haltedResult;
    const accounts = this.getOrCreateAccount(userId, requestTime);
    const assetIds = [...new Set([...accounts.positions.map((position) => position.assetId), assetId])];
    const quotes = await this.getQuotes(assetIds);
    const actionTime = now === undefined ? this.clock() : requestTime;
    validTime(actionTime);
    this.validateQuotes(assetIds, quotes, actionTime);
    const transaction = this.db.transaction(() => {
      const duplicate = this.getOrder(userId, orderId);
      if (duplicate) return { ...duplicate, duplicate: true };
      const account = this.readAccountInTransaction(userId, actionTime);
      const currentControl = this.getControl();
      let result: PaperOrderResult;
      if (currentControl.halted) {
        result = { accepted: false, reason: "trading_halted", account, halted: true };
      } else {
        const currentPrices = Object.fromEntries(Object.entries(quotes).map(([id, quote]) => [id, quote.price]));
        const quote = quotes[assetId];
        const operation = { account, assetId, marketPrice: action === "buy" ? quote.ask : quote.bid, marketFresh: true, currentPrices, orderId, now: actionTime };
        const simulated = action === "buy"
          ? buyPaperPosition({ ...operation, requestedNotional: requestedNotional! })
          : closePaperPosition(operation);
        result = { ...simulated, halted: false };
      }
      this.db.prepare("UPDATE paper_accounts SET account_json = ?, updated_at = ? WHERE owner_id = ?").run(JSON.stringify(result.account), actionTime, userId);
      this.db.prepare("INSERT INTO paper_orders (owner_id, order_id, action, accepted, reason, result_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(userId, orderId, action, result.accepted ? 1 : 0, result.reason, JSON.stringify(result), actionTime);
      return result;
    });
    return transaction.immediate();
  }

  async markToMarket(userId: number, now?: number, provider: PaperQuoteProvider = this.getQuotes): Promise<PaperAccount> {
    const requestTime = now ?? this.clock();
    validTime(requestTime);
    const account = this.getOrCreateAccount(userId, requestTime);
    const last = account.equityCurve.at(-1);
    if (account.positions.length === 0 || (last && (requestTime <= last.time || requestTime - last.time < 5_000))) return account;
    const assetIds = [...new Set(account.positions.map((position) => position.assetId))];
    const quotes = await provider(assetIds);
    const markTime = now === undefined ? this.clock() : requestTime;
    validTime(markTime);
    this.validateQuotes(assetIds, quotes, markTime);
    const prices = Object.fromEntries(Object.entries(quotes).map(([id, quote]) => [id, quote.price]));
    const transaction = this.db.transaction(() => {
      const current = this.readAccountInTransaction(userId, markTime);
      const next = markPaperAccount(current, prices, markTime);
      if (next !== current) {
        const equity = next.equityCurve.at(-1)!.equity;
        this.db.prepare("UPDATE paper_accounts SET account_json = ?, updated_at = ? WHERE owner_id = ?").run(JSON.stringify(next), markTime, userId);
        this.db.prepare("INSERT INTO paper_marks (owner_id, time, equity) VALUES (?, ?, ?)").run(userId, markTime, equity);
        this.db.prepare("DELETE FROM paper_marks WHERE owner_id = ? AND time NOT IN (SELECT time FROM paper_marks WHERE owner_id = ? ORDER BY time DESC LIMIT 1001)").run(userId, userId);
      }
      return next;
    });
    return transaction.immediate();
  }

  private getOrder(userId: number, orderId: string): PaperOrderResult | null {
    const row = this.db.prepare("SELECT result_json FROM paper_orders WHERE owner_id = ? AND order_id = ?").get(userId, orderId) as { result_json: string } | undefined;
    return row ? parseOrderResult(row.result_json) : null;
  }

  private readAccountInTransaction(userId: number, now: number): PaperAccount {
    const row = this.db.prepare("SELECT account_json FROM paper_accounts WHERE owner_id = ?").get(userId) as { account_json: string } | undefined;
    if (row) return parseStoredAccount(row.account_json);
    const account = this.createAccount(userId, now);
    this.db.prepare("INSERT INTO paper_accounts (owner_id, account_json, updated_at) VALUES (?, ?, ?)").run(userId, JSON.stringify(account), now);
    return account;
  }

  private assertOwner(userId: number): void {
    if (!Number.isSafeInteger(userId) || userId <= 0 || !this.db.prepare("SELECT 1 FROM local_user WHERE id = ?").get(userId)) {
      throw new Error("Local paper account owner not found.");
    }
  }

  private validateQuotes(assetIds: string[], quotes: Record<string, PaperQuote>, now: number): void {
    for (const assetId of assetIds) {
      const quote = quotes[assetId];
      if (!quote || !Number.isFinite(quote.bid) || quote.bid <= 0 || !Number.isFinite(quote.ask) || quote.ask < quote.bid || !Number.isFinite(quote.price) || quote.price <= 0 || !Number.isSafeInteger(quote.receivedAt) || quote.receivedAt > now + 1_000 || now - quote.receivedAt > MAX_QUOTE_AGE_MS) {
        throw new Error("Fresh supported market quotes are unavailable.");
      }
    }
  }
}

export function createPaperOrderId(): string { return randomUUID(); }
