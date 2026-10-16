export type Candle = { time: number; open: number; high: number; low: number; close: number; volume: number };

function valid(values: number[]) {
  if (values.some((n) => !Number.isFinite(n))) throw new Error("Values must be finite numbers");
}

export function sma(values: number[], period: number): (number | null)[] {
  valid(values);
  if (!Number.isInteger(period) || period < 1) throw new Error("Period must be a positive integer");
  return values.map((_, i) => i + 1 < period ? null : values.slice(i + 1 - period, i + 1).reduce((a, b) => a + b, 0) / period);
}

export function ema(values: number[], period: number): (number | null)[] {
  valid(values);
  if (!Number.isInteger(period) || period < 1) throw new Error("Period must be a positive integer");
  const out: (number | null)[] = Array(values.length).fill(null);
  if (values.length < period) return out;
  let current = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out[period - 1] = current;
  const alpha = 2 / (period + 1);
  for (let i = period; i < values.length; i++) { current = values[i] * alpha + current * (1 - alpha); out[i] = current; }
  return out;
}

export function rsi(values: number[], period = 14): (number | null)[] {
  if (values.some((n) => !Number.isFinite(n) || n <= 0)) throw new Error("Prices must be finite positive numbers");
  if (!Number.isInteger(period) || period < 1) throw new Error("Period must be a positive integer");
  const out: (number | null)[] = Array(values.length).fill(null);
  if (values.length <= period) return out;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) { const d = values[i] - values[i - 1]; gains += Math.max(d, 0); losses += Math.max(-d, 0); }
  let avgGain = gains / period, avgLoss = losses / period;
  const score = () => avgLoss === 0 ? (avgGain === 0 ? 50 : 100) : 100 - 100 / (1 + avgGain / avgLoss);
  out[period] = score();
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(d, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-d, 0)) / period;
    out[i] = score();
  }
  return out;
}

export function macd(values: number[], fast = 12, slow = 26, signal = 9) {
  if (fast >= slow) throw new Error("Fast MACD period must be below slow period");
  const a = ema(values, fast), b = ema(values, slow);
  const line = values.map((_, i) => a[i] === null || b[i] === null ? null : (a[i] as number) - (b[i] as number));
  const first = line.findIndex((x) => x !== null);
  const signalTail = first < 0 ? [] : ema(line.slice(first) as number[], signal);
  const signalLine = line.map((_, i) => i < first ? null : signalTail[i - first]);
  const histogram = line.map((x, i) => x === null || signalLine[i] === null ? null : x - (signalLine[i] as number));
  return { line, signal: signalLine, histogram };
}

export function bollinger(values: number[], period = 20, deviations = 2) {
  const middle = sma(values, period);
  const upper = values.map((_, i) => {
    if (middle[i] === null) return null;
    const window = values.slice(i + 1 - period, i + 1), mean = middle[i] as number;
    const sd = Math.sqrt(window.reduce((sum, x) => sum + (x - mean) ** 2, 0) / period);
    return mean + deviations * sd;
  });
  const lower = upper.map((x, i) => x === null ? null : 2 * (middle[i] as number) - x);
  return { middle, upper, lower };
}

export function atr(candles: Candle[], period = 14): (number | null)[] {
  if (!Number.isInteger(period) || period < 1) throw new Error("Period must be a positive integer");
  const tr = candles.map((c, i) => {
    if (![c.high, c.low, c.close].every(Number.isFinite) || c.high < c.low || c.low <= 0) throw new Error("Invalid OHLC candle");
    return i === 0 ? c.high - c.low : Math.max(c.high - c.low, Math.abs(c.high - candles[i - 1].close), Math.abs(c.low - candles[i - 1].close));
  });
  const out: (number | null)[] = Array(candles.length).fill(null);
  if (candles.length < period) return out;
  let value = tr.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out[period - 1] = value;
  for (let i = period; i < tr.length; i++) { value = (value * (period - 1) + tr[i]) / period; out[i] = value; }
  return out;
}
