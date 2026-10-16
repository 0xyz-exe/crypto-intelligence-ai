import { describe, expect, it } from "vitest";
import { buyPaperPosition, closePaperPosition, createPaperAccount, markPaperAccount } from "./paper";

const now = Date.UTC(2026, 9, 16, 12);
const market = { bitcoin: 100, ethereum: 200 };

describe("paper account risk controls", () => {
  it("starts with a labeled simulated balance and rejects stale market inputs", () => {
    const account = createPaperAccount(10_000, now);
    expect(account.cash).toBe(10_000);
    expect(buyPaperPosition({ account, assetId: "bitcoin", marketPrice: 100, requestedNotional: 100, marketFresh: false, currentPrices: market, orderId: "paper-1", now }).accepted).toBe(false);
  });

  it("applies fees and slippage, caps risk/exposure, and prevents duplicate paper orders", () => {
    const account = createPaperAccount(10_000, now);
    const result = buyPaperPosition({ account, assetId: "bitcoin", marketPrice: 100, requestedNotional: 8_000, marketFresh: true, currentPrices: market, orderId: "paper-1", now });
    expect(result.accepted).toBe(true);
    expect(result.account.cash).toBeLessThan(10_000);
    expect(result.account.positions).toHaveLength(1);
    expect(result.account.positions[0].qty * 100).toBeLessThanOrEqual(2_000);
    expect(result.account.riskEvents.at(-1)?.reason).toContain("accepted");
    expect(buyPaperPosition({ ...result, account: result.account, assetId: "bitcoin", marketPrice: 100, requestedNotional: 100, marketFresh: true, currentPrices: market, orderId: "paper-1", now }).reason).toBe("duplicate_order");
  });

  it("marks open positions from observed live quotes at a bounded cadence", () => {
    const opened = buyPaperPosition({ account: createPaperAccount(10_000, now), assetId: "bitcoin", marketPrice: 100, requestedNotional: 100, marketFresh: true, currentPrices: market, orderId: "mark-buy", now });
    expect(opened.accepted).toBe(true);
    const marked = markPaperAccount(opened.account, { bitcoin: 120 }, now + 5_000);
    expect(marked.equityCurve.at(-1)).toEqual({ time: now + 5_000, equity: expect.any(Number) });
    expect(marked.equityCurve.at(-1)!.equity).toBeGreaterThan(opened.account.equityCurve.at(-1)!.equity);
    expect(markPaperAccount(marked, { bitcoin: 130 }, now + 7_000)).toBe(marked);
    expect(markPaperAccount(marked, {}, now + 10_000)).toBe(marked);
  });

  it("closes a position with deterministic realized P&L and updated cash", () => {
    const buy = buyPaperPosition({ account: createPaperAccount(10_000, now), assetId: "bitcoin", marketPrice: 100, requestedNotional: 100, marketFresh: true, currentPrices: market, orderId: "paper-buy", now });
    const result = closePaperPosition({ account: buy.account, assetId: "bitcoin", marketPrice: 110, marketFresh: true, currentPrices: { ...market, bitcoin: 110 }, orderId: "paper-sell", now: now + 60_000 });
    expect(result.accepted).toBe(true);
    expect(result.account.positions).toHaveLength(0);
    expect(result.account.trades).toHaveLength(1);
    expect(result.account.trades[0].netPnl).toBeGreaterThan(0);
    expect(result.account.cash).toBeGreaterThan(buy.account.cash);
  });
});
