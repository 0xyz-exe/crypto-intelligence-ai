import { z } from "zod";
import { ASSETS, AssetSchema, CandleSchema, Timeframe, type Asset, type Candle } from "./schema";
import { parseDepthSnapshot } from "./orderbook";

const Ticker = z.object({ symbol: z.string(), lastPrice: z.string(), priceChangePercent: z.string(), quoteVolume: z.string() });
const Kline = z.tuple([z.number(), z.string(), z.string(), z.string(), z.string(), z.string()]).rest(z.unknown());
const FreshPaperTicker = z.object({ symbol: z.string(), bidPrice: z.string(), askPrice: z.string(), lastPrice: z.string() });
const BASE = "https://data-api.binance.vision/api/v3";
const DEADLINE_MS = 7000;
async function fetchJson(url: string): Promise<unknown> {
  for (let attempt = 0; attempt < 3; attempt++) {
    let response: Response;
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(DEADLINE_MS), headers: { accept: "application/json" }, next: { revalidate: 20 } });
    } catch {
      if (attempt === 2) throw new Error("Market provider timed out or is unreachable.");
      await new Promise((resolve) => setTimeout(resolve, 150 * 2 ** attempt + Math.random() * 150));
      continue;
    }
    if (response.status >= 500 && attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, 150 * 2 ** attempt + Math.random() * 150));
      continue;
    }
    if (!response.ok) throw new Error(response.status === 429 ? "Provider rate limit reached. Try again shortly." : `Market provider returned HTTP ${response.status}.`);
    const length = Number(response.headers.get("content-length") ?? 0);
    if (length > 2_000_000) throw new Error("Market provider response exceeded the size limit.");
    const body = await response.text();
    if (body.length > 2_000_000) throw new Error("Market provider response exceeded the size limit.");
    return JSON.parse(body) as unknown;
  }
  throw new Error("Market provider is temporarily unavailable.");
}
async function fetchFreshJson(url: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(DEADLINE_MS), headers: { accept: "application/json" } });
  } catch {
    throw new Error("Order book snapshot timed out or is unreachable.");
  }
  if (!response.ok) throw new Error(response.status === 429 ? "Provider rate limit reached. Try again shortly." : `Market provider returned HTTP ${response.status}.`);
  const body = await response.text();
  if (body.length > 2_000_000) throw new Error("Market provider response exceeded the size limit.");
  return JSON.parse(body) as unknown;
}
export async function getMarkets(): Promise<{ assets: Asset[]; source: string; updatedAt: string }> {
  const symbols = encodeURIComponent(JSON.stringify(ASSETS.map((asset) => asset.pair)));
  const raw = await fetchJson(`${BASE}/ticker/24hr?symbols=${symbols}`);
  if (!Array.isArray(raw) || raw.length > 5000) throw new Error("Market provider response is invalid.");
  const byPair = new Map(raw.map((item) => { const parsed = Ticker.safeParse(item); return parsed.success ? [parsed.data.symbol, parsed.data] as const : ["", null] as const; }));
  const assets = ASSETS.flatMap((asset) => {
    const row = byPair.get(asset.pair);
    if (!row) return [];
    const normalized = AssetSchema.safeParse({ ...asset, price: Number(row.lastPrice), change24h: Number(row.priceChangePercent), volume24h: Number(row.quoteVolume), quote: "USDT" });
    return normalized.success ? [normalized.data] : [];
  });
  if (!assets.length) throw new Error("No supported assets were returned by the market provider.");
  return { assets, source: "Binance Spot · USDT pairs", updatedAt: new Date().toISOString() };
}
export async function getHistory(assetId: string, interval: string): Promise<{ candles: Candle[]; source: string; updatedAt: string }> {
  const asset = ASSETS.find((x) => x.id === assetId), time = Timeframe.safeParse(interval);
  if (!asset || !time.success) throw new Error("Unsupported asset or timeframe.");
  const raw = await fetchJson(`${BASE}/klines?symbol=${encodeURIComponent(asset.pair)}&interval=${time.data}&limit=200`);
  if (!Array.isArray(raw) || raw.length > 200) throw new Error("Historical provider response is invalid.");
  const candles = raw.flatMap((row) => {
    const parsed = Kline.safeParse(row);
    if (!parsed.success) return [];
    const [timeMs, open, high, low, close, volume] = parsed.data;
    const item = CandleSchema.safeParse({ time: timeMs, open: Number(open), high: Number(high), low: Number(low), close: Number(close), volume: Number(volume) });
    return item.success ? [item.data] : [];
  });
  if (!candles.length) throw new Error("No valid historical candles were returned.");
  return { candles, source: "Binance Spot · USDT pairs", updatedAt: new Date().toISOString() };
}
export async function getOrderBookSnapshot(assetId: string): Promise<{ assetId: string; pair: string; lastUpdateId: number; bids: [number, number][]; asks: [number, number][]; source: string; updatedAt: string }> {
  const asset = ASSETS.find((item) => item.id === assetId);
  if (!asset) throw new Error("Unsupported asset.");
  const raw = await fetchFreshJson(`${BASE}/depth?symbol=${encodeURIComponent(asset.pair)}&limit=100`);
  const snapshot = parseDepthSnapshot(raw);
  if (!snapshot) throw new Error("Order book snapshot response is invalid.");
  return { assetId: asset.id, pair: asset.pair, ...snapshot, source: "Binance Spot · REST depth snapshot", updatedAt: new Date().toISOString() };
}

export async function getFreshPaperQuotes(assetIds: string[]): Promise<Record<string, { bid: number; ask: number; price: number; receivedAt: number }>> {
  if (!Array.isArray(assetIds) || assetIds.length === 0 || assetIds.length > 4 || new Set(assetIds).size !== assetIds.length) throw new Error("Unsupported asset set.");
  const assets = assetIds.map((assetId) => ASSETS.find((item) => item.id === assetId));
  if (assets.some((asset) => !asset)) throw new Error("Unsupported asset.");
  const quotes = await Promise.all(assets.map(async (asset) => {
    const raw = await fetchFreshJson(`${BASE}/ticker/24hr?symbol=${encodeURIComponent(asset!.pair)}`);
    const parsed = FreshPaperTicker.safeParse(raw);
    if (!parsed.success || parsed.data.symbol !== asset!.pair) throw new Error("Paper quote response is invalid.");
    const bid = Number(parsed.data.bidPrice), ask = Number(parsed.data.askPrice), price = Number(parsed.data.lastPrice);
    if (!Number.isFinite(bid) || bid <= 0 || !Number.isFinite(ask) || ask < bid || !Number.isFinite(price) || price <= 0) throw new Error("Paper quote response is invalid.");
    return [asset!.id, { bid, ask, price, receivedAt: Date.now() }] as const;
  }));
  return Object.fromEntries(quotes);
}
