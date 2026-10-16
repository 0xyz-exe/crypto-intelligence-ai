import { z } from "zod";
import { ASSETS } from "../market-data/schema";

export const PAPER_POLICY = Object.freeze({
  startingBalance: 10_000,
  maxRiskPerTrade: 0.005,
  maxAggregateExposure: 0.2,
  maxDailyLoss: 0.02,
  maxConcurrentPositions: 3,
  stopDistance: 0.02,
  feeBps: 10,
  slippageBps: 5,
  quantityDecimals: 8,
});

const PositionSchema = z.object({ id: z.string(), assetId: z.string(), qty: z.number().finite().positive(), entryPrice: z.number().finite().positive(), stopPrice: z.number().finite().positive(), entryFee: z.number().finite().nonnegative(), openedAt: z.number().int().nonnegative() });
const TradeSchema = z.object({ id: z.string(), assetId: z.string(), qty: z.number().finite().positive(), entryPrice: z.number().finite().positive(), exitPrice: z.number().finite().positive(), entryFee: z.number().finite().nonnegative(), exitFee: z.number().finite().nonnegative(), netPnl: z.number().finite(), openedAt: z.number().int().nonnegative(), closedAt: z.number().int().nonnegative() });
const PointSchema = z.object({ time: z.number().int().nonnegative(), equity: z.number().finite().nonnegative() });
const RiskEventSchema = z.object({ id: z.string(), time: z.number().int().nonnegative(), action: z.enum(["buy", "close"]), assetId: z.string(), accepted: z.boolean(), reason: z.string() });
const DayAnchorSchema = z.object({ date: z.string(), equity: z.number().finite().positive() });
export const PaperAccountSchema = z.object({ version: z.literal(1), startingBalance: z.number().finite().positive(), cash: z.number().finite().nonnegative(), positions: z.array(PositionSchema).max(3), trades: z.array(TradeSchema).max(1000), equityCurve: z.array(PointSchema).max(1001), riskEvents: z.array(RiskEventSchema).max(200), processedOrderIds: z.array(z.string()).max(1000), dayAnchor: DayAnchorSchema });
export type PaperAccount = z.infer<typeof PaperAccountSchema>;
type ActionResult = { accepted: boolean; reason: string; quantity?: number; account: PaperAccount };
type MarketInputs = { account: PaperAccount; assetId: string; marketPrice: number; marketFresh: boolean; currentPrices: Record<string, number>; orderId: string; now: number };

const utcDay = (time: number) => new Date(time).toISOString().slice(0, 10);
export function createPaperAccount(startingBalance = PAPER_POLICY.startingBalance, now = 0): PaperAccount {
  if (!Number.isFinite(startingBalance) || startingBalance <= 0 || !Number.isSafeInteger(now) || now < 0) throw new Error("Invalid paper account initialization.");
  return { version: 1, startingBalance, cash: startingBalance, positions: [], trades: [], equityCurve: [{ time: now, equity: startingBalance }], riskEvents: [], processedOrderIds: [], dayAnchor: { date: utcDay(now), equity: startingBalance } };
}

export function parsePaperAccount(raw: unknown): PaperAccount | null {
  const parsed = PaperAccountSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function paperEquity(account: PaperAccount, prices: Record<string, number>): number | null {
  let equity = account.cash;
  for (const position of account.positions) {
    const price = prices[position.assetId];
    if (!Number.isFinite(price) || price <= 0) return null;
    equity += position.qty * price;
  }
  return Number.isFinite(equity) && equity > 0 ? equity : null;
}

function result(account: PaperAccount, input: Pick<MarketInputs, "assetId" | "orderId" | "now">, action: "buy" | "close", accepted: boolean, reason: string, quantity?: number): ActionResult {
  const riskEvent = { id: input.orderId, time: input.now, action, assetId: input.assetId, accepted, reason };
  return { accepted, reason, quantity, account: { ...account, riskEvents: [...account.riskEvents, riskEvent].slice(-200) } };
}

export function buyPaperPosition(input: MarketInputs & { requestedNotional: number }): ActionResult {
  const { account, assetId, marketPrice, marketFresh, currentPrices, orderId, now, requestedNotional } = input;
  const asset = ASSETS.find((item) => item.id === assetId);
  if (!asset) return result(account, input, "buy", false, "unsupported_asset");
  if (!orderId || account.processedOrderIds.includes(orderId)) return result(account, input, "buy", false, "duplicate_order");
  if (!marketFresh) return result(account, input, "buy", false, "market_data_not_fresh");
  if (!Number.isFinite(marketPrice) || marketPrice <= 0 || !Number.isFinite(requestedNotional) || requestedNotional <= 0 || !Number.isSafeInteger(now) || now < 0) return result(account, input, "buy", false, "invalid_order_input");
  if (account.positions.some((position) => position.assetId === assetId)) return result(account, input, "buy", false, "position_already_open");
  if (account.positions.length >= PAPER_POLICY.maxConcurrentPositions) return result(account, input, "buy", false, "position_limit_reached");

  const equity = paperEquity(account, currentPrices);
  if (equity === null) return result(account, input, "buy", false, "position_market_price_missing");
  const dayAnchor = account.dayAnchor.date === utcDay(now) ? account.dayAnchor : { date: utcDay(now), equity };
  if (equity <= dayAnchor.equity * (1 - PAPER_POLICY.maxDailyLoss)) return result({ ...account, dayAnchor }, input, "buy", false, "daily_loss_limit_reached");
  const exposure = account.positions.reduce((total, position) => total + position.qty * currentPrices[position.assetId], 0);
  const exposureBudget = Math.max(0, equity * PAPER_POLICY.maxAggregateExposure - exposure);
  const feeRate = PAPER_POLICY.feeBps / 10_000, slipRate = PAPER_POLICY.slippageBps / 10_000;
  const fillPrice = marketPrice * (1 + slipRate), stopPrice = marketPrice * (1 - PAPER_POLICY.stopDistance), stopFillPrice = stopPrice * (1 - slipRate);
  const riskPerUnit = fillPrice - stopFillPrice + fillPrice * feeRate + stopFillPrice * feeRate;
  const riskBudget = equity * PAPER_POLICY.maxRiskPerTrade;
  const maxRiskQty = riskBudget / riskPerUnit, maxExposureQty = exposureBudget / fillPrice;
  const maxCashQty = account.cash / (fillPrice * (1 + feeRate)), requestedQty = requestedNotional / fillPrice;
  const scale = 10 ** PAPER_POLICY.quantityDecimals;
  const qty = Math.floor(Math.min(maxRiskQty, maxExposureQty, maxCashQty, requestedQty) * scale) / scale;
  if (!Number.isFinite(qty) || qty <= 0) return result({ ...account, dayAnchor }, input, "buy", false, account.cash <= 0 ? "insufficient_cash" : "risk_or_exposure_limit");

  const entryNotional = qty * fillPrice, entryFee = entryNotional * feeRate, nextCash = account.cash - entryNotional - entryFee;
  if (nextCash < 0 || !Number.isFinite(nextCash)) return result(account, input, "buy", false, "insufficient_cash");
  const position = { id: orderId, assetId, qty, entryPrice: fillPrice, stopPrice, entryFee, openedAt: now };
  const next: PaperAccount = { ...account, cash: nextCash, positions: [...account.positions, position], processedOrderIds: [...account.processedOrderIds, orderId].slice(-1000), dayAnchor };
  const marked = paperEquity(next, { ...currentPrices, [assetId]: marketPrice });
  if (marked !== null) next.equityCurve = [...next.equityCurve, { time: now, equity: marked }].slice(-1001);
  return result(next, input, "buy", true, "accepted_paper_order", qty);
}

export function closePaperPosition(input: MarketInputs): ActionResult {
  const { account, assetId, marketPrice, marketFresh, currentPrices, orderId, now } = input;
  if (!ASSETS.some((asset) => asset.id === assetId)) return result(account, input, "close", false, "unsupported_asset");
  if (!orderId || account.processedOrderIds.includes(orderId)) return result(account, input, "close", false, "duplicate_order");
  if (!marketFresh) return result(account, input, "close", false, "market_data_not_fresh");
  if (!Number.isFinite(marketPrice) || marketPrice <= 0 || !Number.isSafeInteger(now) || now < 0) return result(account, input, "close", false, "invalid_order_input");
  const position = account.positions.find((item) => item.assetId === assetId);
  if (!position) return result(account, input, "close", false, "position_not_open");
  if (paperEquity(account, currentPrices) === null) return result(account, input, "close", false, "position_market_price_missing");

  const exitPrice = marketPrice * (1 - PAPER_POLICY.slippageBps / 10_000), exitNotional = position.qty * exitPrice, exitFee = exitNotional * PAPER_POLICY.feeBps / 10_000;
  const netPnl = (exitPrice - position.entryPrice) * position.qty - position.entryFee - exitFee;
  const trade = { id: orderId, assetId, qty: position.qty, entryPrice: position.entryPrice, exitPrice, entryFee: position.entryFee, exitFee, netPnl, openedAt: position.openedAt, closedAt: now };
  const next: PaperAccount = { ...account, cash: account.cash + exitNotional - exitFee, positions: account.positions.filter((item) => item.id !== position.id), trades: [...account.trades, trade].slice(-1000), processedOrderIds: [...account.processedOrderIds, orderId].slice(-1000) };
  const marked = paperEquity(next, { ...currentPrices, [assetId]: marketPrice });
  if (marked !== null) next.equityCurve = [...next.equityCurve, { time: now, equity: marked }].slice(-1001);
  return result(next, input, "close", true, "accepted_paper_close", position.qty);
}

export function markPaperAccount(account: PaperAccount, prices: Record<string, number>, now: number): PaperAccount {
  if (!Number.isSafeInteger(now) || now < 0 || account.positions.length === 0) return account;
  const last = account.equityCurve.at(-1);
  if (last && (now <= last.time || now - last.time < 5_000)) return account;
  const equity = paperEquity(account, prices);
  if (equity === null) return account;
  return { ...account, equityCurve: [...account.equityCurve, { time: now, equity }].slice(-1001) };
}

export function maxDrawdown(account: PaperAccount): number {
  let peak = account.startingBalance, drawdown = 0;
  for (const point of account.equityCurve) { peak = Math.max(peak, point.equity); if (peak > 0) drawdown = Math.max(drawdown, (peak - point.equity) / peak); }
  return drawdown;
}
