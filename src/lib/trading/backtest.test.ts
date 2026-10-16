import { describe, expect, it } from "vitest";
import { runEmaBacktest } from "./backtest";
import type { Candle } from "../indicators";

function sampleCandles(): Candle[] {
  const closes = Array.from({ length: 100 }, (_, index) => index < 20 ? 120 - index : index < 50 ? 100 + (index - 20) * 1.2 : index < 75 ? 136 - (index - 50) * 1.5 : 98.5 + (index - 75) * 1.4);
  return closes.map((close, index) => { const open = index ? closes[index - 1] : close; return { time: index * 3_600_000, open, high: Math.max(open, close) + 1, low: Math.min(open, close) - 1, close, volume: 100 }; });
}

describe("EMA crossover backtests", () => {
  it("fills at the next candle open, accounts for costs, and reports separate OOS results", () => {
    const candles = sampleCandles(), result = runEmaBacktest(candles, { fastPeriod: 2, slowPeriod: 5, startingBalance: 10_000 });
    expect(result.config.splitIndex).toBeGreaterThan(50);
    expect(result.inSample.equityCurve.length).toBeGreaterThan(1);
    expect(result.outOfSample.equityCurve[0].time).toBe(candles[result.config.splitIndex].time);
    expect(result.inSample.tradeCount + result.outOfSample.tradeCount).toBeGreaterThan(0);
    expect(result.inSample.trades.every((trade) => trade.exitTime > trade.entryTime && trade.fees > 0)).toBe(true);
    expect(result.outOfSample.trades.every((trade) => trade.entryTime >= candles[result.config.splitIndex + 1].time)).toBe(true);
    expect(result.assumptions.join(" ")).toContain("do not imply future performance");
  });

  it("rejects insufficient history instead of returning a partial result", () => {
    expect(() => runEmaBacktest(sampleCandles().slice(0, 10), { fastPeriod: 2, slowPeriod: 5 })).toThrow("At least 14 closed candles");
    expect(() => runEmaBacktest(sampleCandles().slice(0, 20), { fastPeriod: 2, slowPeriod: 5 })).toThrow("out-of-sample segment is too short");
  });

  it("is deterministic and rejects bad candles or exposure assumptions", () => {
    const candles = sampleCandles();
    expect(runEmaBacktest(candles, { fastPeriod: 2, slowPeriod: 5 })).toEqual(runEmaBacktest(candles, { fastPeriod: 2, slowPeriod: 5 }));
    expect(() => runEmaBacktest(candles, { fastPeriod: 2, slowPeriod: 5, positionFraction: 0.5 })).toThrow("Invalid backtest assumptions");
    expect(() => runEmaBacktest(candles, { fastPeriod: 2, slowPeriod: 5, positionFraction: Number.NaN })).toThrow("Invalid backtest assumptions");
    expect(() => runEmaBacktest([candles[1], candles[0]], { fastPeriod: 1, slowPeriod: 1 })).toThrow("EMA periods");
    const bad = [...candles]; bad[5] = { ...bad[5], low: 1_000 };
    expect(() => runEmaBacktest(bad, { fastPeriod: 2, slowPeriod: 5 })).toThrow("valid, strictly ordered candle");
  });
});
