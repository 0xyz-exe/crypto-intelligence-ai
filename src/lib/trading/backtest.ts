import type { Candle } from "../indicators";
import { evaluateEmaCrossover } from "./strategy";

export type BacktestTrade = { entryTime: number; exitTime: number; entryPrice: number; exitPrice: number; qty: number; fees: number; netPnl: number };
export type BacktestMetrics = { startingBalance: number; endingEquity: number; netPnl: number; returnPct: number; tradeCount: number; winRatePct: number; profitFactor: number | null; maxDrawdownPct: number; trades: BacktestTrade[]; equityCurve: { time: number; equity: number }[] };
export type EmaBacktestResult = { config: { fastPeriod: number; slowPeriod: number; startingBalance: number; feeBps: number; slippageBps: number; positionFraction: number; splitIndex: number }; assumptions: string[]; inSample: BacktestMetrics; outOfSample: BacktestMetrics; buyAndHold: { endingEquity: number; returnPct: number } };

function validate(candles: Candle[], options: { fastPeriod: number; slowPeriod: number; startingBalance: number; feeBps: number; slippageBps: number; positionFraction: number }) {
  if (options.fastPeriod < 1 || options.fastPeriod >= options.slowPeriod || !Number.isInteger(options.fastPeriod) || !Number.isInteger(options.slowPeriod)) throw new Error("EMA periods must be positive integers with fast below slow.");
  if (!Number.isFinite(options.startingBalance) || options.startingBalance <= 0 || !Number.isFinite(options.feeBps) || options.feeBps < 0 || !Number.isFinite(options.slippageBps) || options.slippageBps < 0 || !Number.isFinite(options.positionFraction) || options.positionFraction <= 0 || options.positionFraction > 0.2) throw new Error("Invalid backtest assumptions; exposure must be at most 20% with no leverage.");
  if (candles.length < options.slowPeriod * 2 + 4) throw new Error(`At least ${options.slowPeriod * 2 + 4} closed candles are required for warm-up and out-of-sample evaluation.`);
  for (let index = 0; index < candles.length; index++) {
    const candle = candles[index];
    if (!Number.isSafeInteger(candle.time) || candle.time < 0 || ![candle.open, candle.high, candle.low, candle.close, candle.volume].every(Number.isFinite) || candle.low <= 0 || candle.high < candle.low || candle.open < candle.low || candle.open > candle.high || candle.close < candle.low || candle.close > candle.high || candle.volume < 0 || (index > 0 && candle.time <= candles[index - 1].time)) throw new Error("Backtest requires valid, strictly ordered candle data.");
  }
}

function measure(candles: Candle[], firstIndex: number, endIndex: number, startingBalance: number, feeRate: number, slipRate: number, positionFraction: number, fastPeriod: number, slowPeriod: number): BacktestMetrics {
  let cash = startingBalance, position: { qty: number; entryPrice: number; entryFee: number; entryTime: number } | null = null;
  const trades: BacktestTrade[] = [], equityCurve: { time: number; equity: number }[] = [{ time: candles[firstIndex].time, equity: startingBalance }];
  for (let index = firstIndex; index < endIndex - 1; index++) {
    const signal = evaluateEmaCrossover(candles.slice(0, index + 1), fastPeriod, slowPeriod);
    const next = candles[index + 1];
    if (signal?.action === "buy" && !position) {
      const entryPrice = next.open * (1 + slipRate), notional = Math.min(cash / (1 + feeRate), cash * positionFraction), qty = notional / entryPrice, entryFee = qty * entryPrice * feeRate;
      if (qty > 0 && entryFee + qty * entryPrice <= cash) { cash -= qty * entryPrice + entryFee; position = { qty, entryPrice, entryFee, entryTime: next.time }; }
    } else if (signal?.action === "close" && position) {
      const exitPrice = next.open * (1 - slipRate), exitFee = position.qty * exitPrice * feeRate;
      cash += position.qty * exitPrice - exitFee;
      trades.push({ entryTime: position.entryTime, exitTime: next.time, entryPrice: position.entryPrice, exitPrice, qty: position.qty, fees: position.entryFee + exitFee, netPnl: (exitPrice - position.entryPrice) * position.qty - position.entryFee - exitFee });
      position = null;
    }
    equityCurve.push({ time: next.time, equity: cash + (position ? position.qty * next.close : 0) });
  }
  const finalCandle = candles[endIndex - 1];
  if (position) {
    const exitPrice = finalCandle.close * (1 - slipRate), exitFee = position.qty * exitPrice * feeRate;
    cash += position.qty * exitPrice - exitFee;
    trades.push({ entryTime: position.entryTime, exitTime: finalCandle.time, entryPrice: position.entryPrice, exitPrice, qty: position.qty, fees: position.entryFee + exitFee, netPnl: (exitPrice - position.entryPrice) * position.qty - position.entryFee - exitFee });
  }
  if (equityCurve.at(-1)?.time === finalCandle.time) equityCurve[equityCurve.length - 1] = { time: finalCandle.time, equity: cash };
  else equityCurve.push({ time: finalCandle.time, equity: cash });
  const grossProfit = trades.reduce((sum, trade) => sum + Math.max(0, trade.netPnl), 0), grossLoss = trades.reduce((sum, trade) => sum + Math.max(0, -trade.netPnl), 0);
  let peak = startingBalance, maxDrawdown = 0;
  for (const point of equityCurve) { peak = Math.max(peak, point.equity); if (peak > 0) maxDrawdown = Math.max(maxDrawdown, (peak - point.equity) / peak); }
  const endingEquity = cash, netPnl = endingEquity - startingBalance;
  return { startingBalance, endingEquity, netPnl, returnPct: netPnl / startingBalance * 100, tradeCount: trades.length, winRatePct: trades.length ? trades.filter((trade) => trade.netPnl > 0).length / trades.length * 100 : 0, profitFactor: grossLoss > 0 ? grossProfit / grossLoss : null, maxDrawdownPct: maxDrawdown * 100, trades, equityCurve };
}

export function runEmaBacktest(candles: Candle[], options: { fastPeriod?: number; slowPeriod?: number; startingBalance?: number; feeBps?: number; slippageBps?: number; positionFraction?: number } = {}): EmaBacktestResult {
  const config = { fastPeriod: options.fastPeriod ?? 12, slowPeriod: options.slowPeriod ?? 26, startingBalance: options.startingBalance ?? 10_000, feeBps: options.feeBps ?? 10, slippageBps: options.slippageBps ?? 5, positionFraction: options.positionFraction ?? 0.2 };
  validate(candles, config);
  const splitIndex = Math.max(config.slowPeriod + 1, Math.floor(candles.length * 0.7));
  if (candles.length - splitIndex < config.slowPeriod + 2) throw new Error("The out-of-sample segment is too short for the selected EMA warm-up.");
  const feeRate = config.feeBps / 10_000, slipRate = config.slippageBps / 10_000;
  const inSample = measure(candles, config.slowPeriod, splitIndex, config.startingBalance, feeRate, slipRate, config.positionFraction, config.fastPeriod, config.slowPeriod);
  const outOfSample = measure(candles, splitIndex, candles.length, config.startingBalance, feeRate, slipRate, config.positionFraction, config.fastPeriod, config.slowPeriod);
  const first = candles[config.slowPeriod], last = candles.at(-1)!, buyEntry = first.open * (1 + slipRate), buyNotional = Math.min(config.startingBalance, config.startingBalance * config.positionFraction), buyQty = buyNotional / buyEntry, buyFee = buyQty * buyEntry * feeRate, buyExit = last.close * (1 - slipRate), buyExitFee = buyQty * buyExit * feeRate, buyEnd = config.startingBalance - buyNotional - buyFee + buyQty * buyExit - buyExitFee;
  return { config: { ...config, splitIndex }, assumptions: ["Signals use closed candles only; a signal fills at the next candle open.", "Long-only, no leverage; position notional is capped at 20% of segment equity.", "Market fills apply configured adverse slippage and fees at entry and exit.", "Any remaining position is liquidated at the final close with exit slippage and fee.", "Out-of-sample starts with a separate fresh balance; earlier bars are used only for indicator warm-up.", "No stop-loss, limit-order queue, latency, partial fills, or gap protection is simulated; results do not imply future performance."], inSample, outOfSample, buyAndHold: { endingEquity: buyEnd, returnPct: (buyEnd / config.startingBalance - 1) * 100 } };
}
