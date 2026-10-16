import { afterEach, describe, expect, it, vi } from "vitest";
import { getFreshPaperQuotes, getHistory, getMarkets } from "./provider";

afterEach(() => vi.unstubAllGlobals());

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });

describe("Binance public market-data adapter", () => {
  it("requests only configured pairs from the fixed public origin and normalizes tickers", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => { void input; return json([{ symbol: "BTCUSDT", lastPrice: "123.45", priceChangePercent: "2.5", quoteVolume: "1000" }]); });
    vi.stubGlobal("fetch", fetchMock);

    const result = await getMarkets();
    const requestedUrl = String(fetchMock.mock.calls[0][0]);
    expect(requestedUrl.startsWith("https://data-api.binance.vision/api/v3/ticker/24hr?")).toBe(true);
    expect(requestedUrl).toContain("BTCUSDT");
    expect(result.assets).toEqual([expect.objectContaining({ id: "bitcoin", price: 123.45, change24h: 2.5, volume24h: 1000, quote: "USDT" })]);
    expect(result.source).toContain("Binance Spot");
  });

  it("normalizes valid candles and rejects empty or malformed provider data", async () => {
    const row = [1_735_689_600_000, "10", "12", "9", "11", "500"];
    const fetchMock = vi.fn(async () => json([row]));
    vi.stubGlobal("fetch", fetchMock);
    const result = await getHistory("bitcoin", "1h");
    expect(result.candles).toEqual([{ time: row[0], open: 10, high: 12, low: 9, close: 11, volume: 500 }]);

    vi.stubGlobal("fetch", vi.fn(async () => json([])));
    await expect(getHistory("bitcoin", "1h")).rejects.toThrow("No valid historical candles");
  });
  it("fetches fresh quotes only for allowlisted Binance Spot pairs", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      expect(url).toBe("https://data-api.binance.vision/api/v3/ticker/24hr?symbol=BTCUSDT");
      expect(init?.cache).toBe("no-store");
      return json({ symbol: "BTCUSDT", bidPrice: "99", askPrice: "101", lastPrice: "100" });
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await getFreshPaperQuotes(["bitcoin"]);
    expect(result.bitcoin).toEqual({ bid: 99, ask: 101, price: 100, receivedAt: expect.any(Number) });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await expect(getFreshPaperQuotes(["not-supported"])).rejects.toThrow("Unsupported asset");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects malformed fresh ticker values instead of passing them to paper execution", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ symbol: "BTCUSDT", bidPrice: "0", askPrice: "101", lastPrice: "100" })));
    await expect(getFreshPaperQuotes(["bitcoin"])).rejects.toThrow("Paper quote response is invalid");
  });
});
