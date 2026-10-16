import { z } from "zod";
import { ASSETS, CandleSchema, Timeframe, type Candle } from "./schema";
import { parseBinanceDepthEvent, type BinanceDepthEvent } from "./orderbook";

const NumericText = z.string().regex(/^(?:\d+\.?\d*|\.\d+)$/).transform(Number).refine(Number.isFinite);
const TickerEvent = z.object({
  e: z.literal("24hrTicker"), E: z.number().int().positive(), s: z.string(),
  c: NumericText, P: NumericText, q: NumericText, b: NumericText, a: NumericText,
});
const KlineEvent = z.object({
  e: z.literal("kline"), E: z.number().int().positive(), s: z.string(),
  k: z.object({ t: z.number().int().nonnegative(), s: z.string(), i: z.string(), o: NumericText, h: NumericText, l: NumericText, c: NumericText, v: NumericText, x: z.boolean() }),
});

export type MarketTickerEvent = { type: "ticker"; assetId: string; pair: string; price: number; change24h: number; volume24h: number; bid: number; ask: number; eventTime: number };
export type MarketCandleEvent = { type: "candle"; assetId: string; pair: string; interval: string; candle: Candle; closed: boolean; eventTime: number };
export type MarketDepthEvent = { type: "depth"; assetId: string; pair: string; eventTime: number; depth: BinanceDepthEvent };
export type MarketStreamEvent = MarketTickerEvent | MarketCandleEvent | MarketDepthEvent;

/** Parses either a raw stream payload or Binance's { stream, data } combined envelope. */
export function parseBinanceStreamMessage(raw: unknown): MarketStreamEvent | null {
  let value: unknown = raw;
  if (typeof value === "string") {
    try { value = JSON.parse(value) as unknown; } catch { return null; }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const envelope = value as Record<string, unknown>;
  if ("data" in envelope && typeof envelope.stream === "string") value = envelope.data;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;

  if (candidate.e === "24hrTicker") {
    const parsed = TickerEvent.safeParse(candidate);
    if (!parsed.success) return null;
    const row = parsed.data, asset = ASSETS.find((entry) => entry.pair === row.s);
    if (!asset || row.c <= 0 || row.q < 0 || row.b <= 0 || row.a <= 0) return null;
    return { type: "ticker", assetId: asset.id, pair: row.s, price: row.c, change24h: row.P, volume24h: row.q, bid: row.b, ask: row.a, eventTime: row.E };
  }

  if (candidate.e === "kline") {
    const parsed = KlineEvent.safeParse(candidate);
    if (!parsed.success) return null;
    const { data } = parsed, asset = ASSETS.find((entry) => entry.pair === data.s);
    const timeframe = Timeframe.safeParse(data.k.i);
    if (!asset || data.k.s !== data.s || !timeframe.success || data.k.o <= 0 || data.k.h <= 0 || data.k.l <= 0 || data.k.c <= 0 || data.k.v < 0) return null;
    const normalized = CandleSchema.safeParse({ time: data.k.t, open: data.k.o, high: data.k.h, low: data.k.l, close: data.k.c, volume: data.k.v });
    if (!normalized.success) return null;
    return { type: "candle", assetId: asset.id, pair: data.s, interval: timeframe.data, candle: normalized.data, closed: data.k.x, eventTime: data.E };
  }

  if (candidate.e === "depthUpdate") {
    const depth = parseBinanceDepthEvent(candidate);
    if (!depth) return null;
    const asset = ASSETS.find((entry) => entry.pair === depth.s);
    return asset ? { type: "depth", assetId: asset.id, pair: depth.s, eventTime: depth.E, depth } : null;
  }
  return null;
}
