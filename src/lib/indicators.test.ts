import { describe, expect, it } from "vitest";
import { atr, bollinger, ema, macd, rsi, sma } from "./indicators";
import type { Candle } from "./indicators";

const values = [1, 2, 3, 4, 5];
const candles: Candle[] = values.map((v, i) => ({ time: i, open: v, high: v + 1, low: v - 0.5, close: v, volume: 1 }));
describe("deterministic indicators", () => {
  it("calculates SMA with null warmup", () => expect(sma(values, 3)).toEqual([null, null, 2, 3, 4]));
  it("seeds EMA with first-window mean", () => expect(ema(values, 3)).toEqual([null, null, 2, 3, 4]));
  it("handles RSI rising, falling and flat sequences", () => {
    expect(rsi([1, 2, 3, 4], 2).at(-1)).toBe(100);
    expect(rsi([4, 3, 2, 1], 2).at(-1)).toBe(0);
    expect(rsi([2, 2, 2, 2], 2).at(-1)).toBe(50);
    expect(rsi(values.slice(0, 2), 2)).toEqual([null, null]);
  });
  it("builds finite MACD, Bollinger and ATR outputs", () => {
    expect(macd(values, 2, 3, 2).histogram.at(-1)).not.toBeNull();
    const bands = bollinger(values, 3);
    expect(bands.middle.at(-1)).toBe(4);
    expect((bands.upper.at(-1) ?? 0)).toBeGreaterThan(4);
    expect(atr(candles, 3)).toEqual([null, null, 1.8333333333333333, 1.8888888888888886, 1.9259259259259256]);
  });
  it("rejects invalid periods and invalid prices", () => {
    expect(() => sma(values, 0)).toThrow();
    expect(() => ema([1, Number.NaN], 2)).toThrow();
    expect(() => macd(values, 26, 12)).toThrow();
  });
});
