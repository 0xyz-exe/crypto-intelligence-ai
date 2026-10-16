import { ema, type Candle } from "../indicators";

export type EmaSignal = { strategyId: "ema-crossover"; action: "buy" | "close"; time: number; referencePrice: number; fastPeriod: number; slowPeriod: number; fastValue: number; slowValue: number; explanation: string };

/** Evaluate only the supplied closed candles; callers must not pass a still-forming bar. */
export function evaluateEmaCrossover(closedCandles: Candle[], fastPeriod = 12, slowPeriod = 26): EmaSignal | null {
  if (!Number.isInteger(fastPeriod) || !Number.isInteger(slowPeriod) || fastPeriod < 1 || fastPeriod >= slowPeriod) throw new Error("EMA periods must be positive integers with fast below slow.");
  if (closedCandles.length < slowPeriod + 1) return null;
  for (let index = 0; index < closedCandles.length; index++) {
    const candle = closedCandles[index];
    if (!Number.isSafeInteger(candle.time) || candle.time < 0 || ![candle.open, candle.high, candle.low, candle.close, candle.volume].every(Number.isFinite) || candle.low <= 0 || candle.low > candle.high || candle.open < candle.low || candle.open > candle.high || candle.close < candle.low || candle.close > candle.high || candle.volume < 0 || (index > 0 && candle.time <= closedCandles[index - 1].time)) throw new Error("Invalid or unordered candle history.");
  }
  const closes = closedCandles.map((candle) => candle.close), fast = ema(closes, fastPeriod), slow = ema(closes, slowPeriod), index = closes.length - 1;
  const previousFast = fast[index - 1], previousSlow = slow[index - 1], currentFast = fast[index], currentSlow = slow[index];
  if (previousFast === null || previousSlow === null || currentFast === null || currentSlow === null) return null;
  const action = previousFast <= previousSlow && currentFast > currentSlow ? "buy" : previousFast >= previousSlow && currentFast < currentSlow ? "close" : null;
  if (!action) return null;
  return { strategyId: "ema-crossover", action, time: closedCandles[index].time, referencePrice: closes[index], fastPeriod, slowPeriod, fastValue: currentFast, slowValue: currentSlow, explanation: `Closed-candle ${fastPeriod}/${slowPeriod} EMA ${action === "buy" ? "bullish" : "bearish"} crossover; research signal only, not a prediction.` };
}
