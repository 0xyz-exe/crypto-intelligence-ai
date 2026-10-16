import { describe, expect, it } from "vitest";
import { evaluateEmaCrossover } from "./strategy";
import type { Candle } from "../indicators";

const makeCandles = (closes: number[]): Candle[] => closes.map((close, index) => ({ time: index * 60_000, open: close, high: close + 1, low: close - 1, close, volume: 1 }));

describe("EMA crossover research signals", () => {
  it("reports only a crossover on the latest completed observation", () => {
    const signal = evaluateEmaCrossover(makeCandles([10, 9, 8, 7, 6, 7, 8]), 2, 3);
    expect(signal?.action).toBe("buy");
    expect(signal?.referencePrice).toBe(8);
    expect(signal?.explanation).toContain("not a prediction");
    expect(evaluateEmaCrossover(makeCandles([10, 9, 8, 7, 6]), 2, 3)).toBeNull();
  });

  it("rejects unordered or invalid candle data and unsafe period configurations", () => {
    const candles = makeCandles([10, 9, 8, 7, 6, 7, 8]);
    expect(() => evaluateEmaCrossover([...candles, candles[0]], 2, 3)).toThrow("Invalid or unordered candle history");
    expect(() => evaluateEmaCrossover(candles, 3, 3)).toThrow("EMA periods");
  });
});
