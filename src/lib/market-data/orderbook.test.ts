import { describe, expect, it } from "vitest";
import { OrderBookSynchronizer, parseDepthSnapshot } from "./orderbook";

const snapshot = { lastUpdateId: 100, bids: [["100", "2"], ["99", "1"]], asks: [["101", "3"], ["102", "1"]] };
const update = (U: number, u: number, pu: number | undefined, b: unknown[][] = [], a: unknown[][] = []) => ({ stream: "btcusdt@depth@100ms", data: { e: "depthUpdate", E: 1_700_000_000_000 + u, s: "BTCUSDT", U, u, ...(pu === undefined ? {} : { pu }), b, a } });

describe("Binance Spot local order book synchronization", () => {
  it("buffers depth updates and bridges the REST snapshot before exposing levels", () => {
    const book = new OrderBookSynchronizer("BTCUSDT", 10);
    expect(book.push(update(99, 101, undefined, [["100", "1.5"]], [["101", "0"]])).book).toBeNull();
    expect(book.push(update(102, 103, 101, [["100.5", "2"]], [["101.5", "2"]])).book).toBeNull();
    const result = book.installSnapshot(snapshot);
    expect(result.needsSnapshot).toBe(false);
    expect(result.book).toMatchObject({ pair: "BTCUSDT", lastUpdateId: 103, bids: [{ price: 100.5, quantity: 2 }, { price: 100, quantity: 1.5 }, { price: 99, quantity: 1 }], asks: [{ price: 101.5, quantity: 2 }, { price: 102, quantity: 1 }] });
  });

  it("drops stale events, applies zero-quantity deletions and detects sequence gaps", () => {
    const book = new OrderBookSynchronizer("BTCUSDT");
    expect(book.installSnapshot(snapshot).book).toBeNull();
    const first = book.push(update(99, 101, undefined, [["100", "2"]]));
    expect(first.book?.lastUpdateId).toBe(101);
    expect(book.push(update(101, 101, undefined)).book).toBeNull();
    const next = book.push(update(102, 102, undefined, [], [["101", "0"]]));
    expect(next.book?.asks[0].price).toBe(102);
    const gap = book.push(update(104, 105, 103));
    expect(gap).toEqual({ book: null, needsSnapshot: true });
    expect(book.installSnapshot({ ...snapshot, lastUpdateId: 105 }).book).toBeNull();
  });

  it("rejects malformed snapshots and unsupported or malformed stream events", () => {
    expect(parseDepthSnapshot({ ...snapshot, bids: [["0", "1"]] })).toBeNull();
    const book = new OrderBookSynchronizer("BTCUSDT");
    expect(() => new OrderBookSynchronizer("EVILUSDT")).toThrow("Unsupported order book configuration");
    expect(book.push(update(101, 102, 100, [["NaN", "2"]])).book).toBeNull();
    expect(book.push(update(101, 102, 100)).needsSnapshot).toBe(false);
    expect(book.installSnapshot({ ...snapshot, lastUpdateId: -1 })).toEqual({ book: null, needsSnapshot: true });
  });
});
