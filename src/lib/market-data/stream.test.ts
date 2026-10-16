import { afterEach, describe, expect, it, vi } from "vitest";
import { parseBinanceStreamMessage } from "./stream";
import { buildCombinedStreamUrl, createBinanceMarketStream, type BrowserSocket } from "./websocket";

afterEach(() => vi.useRealTimers());

describe("Binance combined stream lifecycle", () => {
  it("uses one fixed-origin subscription and validates stream allowlists", () => {
    const url = buildCombinedStreamUrl(["BTCUSDT", "ETHUSDT", "BTCUSDT"], "BTCUSDT", "1h");
    expect(url).toBe("wss://data-stream.binance.vision/stream?streams=btcusdt@ticker/ethusdt@ticker/btcusdt@kline_1h/btcusdt@depth@100ms");
    expect(() => buildCombinedStreamUrl(["EVILUSDT"], "BTCUSDT", "1h")).toThrow("Unsupported market stream subscription");
    expect(() => buildCombinedStreamUrl(["BTCUSDT"], "BTCUSDT", "1m")).toThrow("Unsupported market stream subscription");
  });

  it("marks freshness only after a valid event and reconnects with a bounded delay", async () => {
    vi.useFakeTimers();
    const sockets: FakeSocket[] = [], statuses: string[] = [], received: unknown[] = [];
    const stream = createBinanceMarketStream({ pairs: ["BTCUSDT"], selectedPair: "BTCUSDT", interval: "1h", random: () => 0, handlers: { onStatus: (status) => statuses.push(status), onEvent: (event) => received.push(event) }, socketFactory: (url) => { const socket = new FakeSocket(url); sockets.push(socket); return socket; } });
    expect(statuses.at(-1)).toBe("connecting");
    sockets[0].message(JSON.stringify({ e: "24hrTicker", E: 1_735_689_600_000, s: "BTCUSDT", c: "100", P: "1", q: "1000", b: "99", a: "101" }));
    expect(statuses.at(-1)).toBe("connected");
    expect(received).toHaveLength(1);
    sockets[0].disconnect();
    expect(statuses.at(-1)).toBe("reconnecting");
    await vi.advanceTimersByTimeAsync(750);
    expect(sockets).toHaveLength(2);
    stream.close();
    expect(statuses.at(-1)).toBe("disconnected");
  });

  it("marks a handshaken but silent socket stale rather than live", async () => {
    vi.useFakeTimers();
    let clock = 100;
    const sockets: FakeSocket[] = [], statuses: string[] = [];
    const stream = createBinanceMarketStream({ pairs: ["BTCUSDT"], selectedPair: "BTCUSDT", interval: "1h", staleAfterMs: 100, now: () => clock, handlers: { onStatus: (status) => statuses.push(status), onEvent: () => {} }, socketFactory: (url) => { const socket = new FakeSocket(url); sockets.push(socket); return socket; } });
    sockets[0].open();
    clock = 201;
    await vi.advanceTimersByTimeAsync(100);
    expect(statuses.at(-1)).toBe("stale");
    stream.close();
  });
});

class FakeSocket implements BrowserSocket {
  onopen: ((this: WebSocket, ev: Event) => unknown) | null = null;
  onmessage: ((this: WebSocket, ev: MessageEvent) => unknown) | null = null;
  onerror: ((this: WebSocket, ev: Event) => unknown) | null = null;
  onclose: ((this: WebSocket, ev: CloseEvent) => unknown) | null = null;
  constructor(readonly url: string) {}
  open() { this.onopen?.call(this as unknown as WebSocket, new Event("open")); }
  message(data: string) { this.onmessage?.call(this as unknown as WebSocket, new MessageEvent("message", { data })); }
  disconnect() { this.onclose?.call(this as unknown as WebSocket, new CloseEvent("close")); }
  close() { this.disconnect(); }
}


describe("Binance stream event validation", () => {
  it("normalizes supported rolling ticker events and exchange timestamps", () => {
    expect(parseBinanceStreamMessage(JSON.stringify({ stream: "btcusdt@ticker", data: { e: "24hrTicker", E: 1_735_689_600_000, s: "BTCUSDT", c: "65000.10", P: "1.25", q: "1000000", b: "64999.90", a: "65000.20" } }))).toEqual({
      type: "ticker", assetId: "bitcoin", pair: "BTCUSDT", price: 65000.1, change24h: 1.25, volume24h: 1000000, bid: 64999.9, ask: 65000.2, eventTime: 1_735_689_600_000,
    });
  });

  it("normalizes current and finalized candles without fabricating bars", () => {
    const payload = { e: "kline", E: 1_735_689_600_100, s: "ETHUSDT", k: { t: 1_735_689_600_000, s: "ETHUSDT", i: "1h", o: "100", h: "110", l: "95", c: "105", v: "200", x: true } };
    expect(parseBinanceStreamMessage(payload)).toEqual({ type: "candle", assetId: "ethereum", pair: "ETHUSDT", interval: "1h", eventTime: 1_735_689_600_100, closed: true, candle: { time: 1_735_689_600_000, open: 100, high: 110, low: 95, close: 105, volume: 200 } });
  });

  it("normalizes bounded depth-diff events and rejects unsupported book symbols", () => {
    const event = { stream: "btcusdt@depth@100ms", data: { e: "depthUpdate", E: 1_735_689_600_200, s: "BTCUSDT", U: 10, u: 12, pu: 9, b: [["65000", "1.25"]], a: [["65001", "0"]] } };
    expect(parseBinanceStreamMessage(event)).toMatchObject({ type: "depth", assetId: "bitcoin", pair: "BTCUSDT", eventTime: 1_735_689_600_200, depth: { U: 10, u: 12, pu: 9 } });
    expect(parseBinanceStreamMessage({ ...event, data: { ...event.data, s: "EVILUSDT" } })).toBeNull();
  });

  it("rejects unsupported symbols, invalid numbers, malformed JSON and unknown events", () => {
    expect(parseBinanceStreamMessage("{" )).toBeNull();
    expect(parseBinanceStreamMessage({ e: "24hrTicker", E: 1, s: "NOTREAL", c: "1", P: "0", q: "1", b: "1", a: "1" })).toBeNull();
    expect(parseBinanceStreamMessage({ e: "24hrTicker", E: 1, s: "BTCUSDT", c: "Infinity", P: "0", q: "1", b: "1", a: "1" })).toBeNull();
    expect(parseBinanceStreamMessage({ e: "unknown" })).toBeNull();
  });
});
