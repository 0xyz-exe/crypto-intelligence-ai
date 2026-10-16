import { z } from "zod";

export const ASSETS = [
  { id: "bitcoin", symbol: "BTC", name: "Bitcoin", pair: "BTCUSDT" },
  { id: "ethereum", symbol: "ETH", name: "Ethereum", pair: "ETHUSDT" },
  { id: "binancecoin", symbol: "BNB", name: "BNB", pair: "BNBUSDT" },
  { id: "solana", symbol: "SOL", name: "Solana", pair: "SOLUSDT" },
  { id: "ripple", symbol: "XRP", name: "XRP", pair: "XRPUSDT" },
  { id: "cardano", symbol: "ADA", name: "Cardano", pair: "ADAUSDT" },
  { id: "dogecoin", symbol: "DOGE", name: "Dogecoin", pair: "DOGEUSDT" },
  { id: "tron", symbol: "TRX", name: "TRON", pair: "TRXUSDT" },
  { id: "avalanche-2", symbol: "AVAX", name: "Avalanche", pair: "AVAXUSDT" },
  { id: "chainlink", symbol: "LINK", name: "Chainlink", pair: "LINKUSDT" },
] as const;

export const Timeframe = z.enum(["1h", "4h", "1d"]);
export type Timeframe = z.infer<typeof Timeframe>;
export const AssetSchema = z.object({
  id: z.string(), symbol: z.string(), name: z.string(), pair: z.string(), price: z.number().finite().positive(),
  change24h: z.number().finite(), volume24h: z.number().finite().nonnegative(), quote: z.literal("USDT"),
});
export type Asset = z.infer<typeof AssetSchema>;
export const CandleSchema = z.object({ time: z.number().int().nonnegative(), open: z.number().positive(), high: z.number().positive(), low: z.number().positive(), close: z.number().positive(), volume: z.number().nonnegative() }).refine(c => c.high >= c.low && c.high >= c.open && c.high >= c.close && c.low <= c.open && c.low <= c.close);
export type Candle = z.infer<typeof CandleSchema>;

export const DEMO_ASSETS: Asset[] = ASSETS.map((a, i) => ({
  ...a, price: [67420.15, 3521.4, 594.22, 168.32, 0.526, 0.447, 0.164, 0.154, 36.8, 14.2][i],
  change24h: [2.43, -0.82, 1.74, 4.18, -1.21, 0.56, 3.06, 0.28, -2.35, 1.92][i],
  volume24h: [1820000000, 950000000, 110000000, 770000000, 390000000, 52000000, 83000000, 71000000, 120000000, 92000000][i], quote: "USDT" as const,
}));

export function demoCandles(asset: Asset, count = 120, stepMs = 3_600_000): Candle[] {
  const base = asset.price * 0.88;
  const anchor = Date.UTC(2025, 0, 1, 0, 0, 0);
  return Array.from({ length: count }, (_, i) => {
    const trend = (i / count) * asset.price * 0.15;
    const wave = Math.sin(i * 0.27) * asset.price * 0.018 + Math.cos(i * 0.11) * asset.price * 0.012;
    const close = Math.max(asset.price * 0.4, base + trend + wave);
    const open = i === 0 ? close * 0.998 : Math.max(asset.price * 0.4, base + ((i - 1) / count) * asset.price * 0.15 + Math.sin((i - 1) * 0.27) * asset.price * 0.018 + Math.cos((i - 1) * 0.11) * asset.price * 0.012);
    return { time: anchor - (count - i) * stepMs, open, high: Math.max(open, close) * 1.006, low: Math.min(open, close) * 0.994, close, volume: 1000 + (i % 17) * 130 };
  });
}
