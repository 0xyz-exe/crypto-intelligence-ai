import { z } from "zod";
import { ASSETS } from "./schema";

const Decimal = z.union([z.string().regex(/^(?:\d+\.?\d*|\.\d+)$/).transform(Number).refine(Number.isFinite), z.number().finite()]);
const Level = z.tuple([Decimal, Decimal]).refine(([price, quantity]) => price > 0 && quantity >= 0);
const SnapshotSchema = z.object({ lastUpdateId: z.number().int().nonnegative(), bids: z.array(Level).max(5000), asks: z.array(Level).max(5000) });
const UpdateSchema = z.object({
  e: z.literal("depthUpdate"), E: z.number().int().positive(), s: z.string(),
  U: z.number().int().positive(), u: z.number().int().positive(), pu: z.number().int().nonnegative().optional(),
  b: z.array(Level).max(1000), a: z.array(Level).max(1000),
}).refine((event) => event.U <= event.u);

export type DepthSnapshot = z.infer<typeof SnapshotSchema>;
type DepthUpdate = z.infer<typeof UpdateSchema>;
export type OrderBookLevel = { price: number; quantity: number };
export type OrderBookView = { pair: string; lastUpdateId: number; eventTime: number; bids: OrderBookLevel[]; asks: OrderBookLevel[] };
export type OrderBookSyncResult = { book: OrderBookView | null; needsSnapshot: boolean };
const MAX_BUFFERED_UPDATES = 1000;
const MAX_BOOK_LEVELS = 1000;

export function parseDepthSnapshot(raw: unknown): DepthSnapshot | null {
  const parsed = SnapshotSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export type BinanceDepthEvent = z.infer<typeof UpdateSchema>;
export function parseBinanceDepthEvent(raw: unknown): BinanceDepthEvent | null {
  let value = raw;
  if (typeof value === "string") {
    try { value = JSON.parse(value) as unknown; } catch { return null; }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const envelope = value as Record<string, unknown>;
  if (typeof envelope.stream === "string" && "data" in envelope) value = envelope.data;
  const parsed = UpdateSchema.safeParse(value);
  if (!parsed.success || !ASSETS.some((asset) => asset.pair === parsed.data.s)) return null;
  return parsed.data;
}

function parseUpdate(raw: unknown, pair: string): DepthUpdate | null {
  const update = parseBinanceDepthEvent(raw);
  return update?.s === pair ? update : null;
}

export class OrderBookSynchronizer {
  private bids = new Map<number, number>();
  private asks = new Map<number, number>();
  private pending: DepthUpdate[] = [];
  private lastUpdateId: number | null = null;
  private eventTime = 0;
  private synchronized = false;

  constructor(private readonly pair: string, private readonly levels = 10) {
    if (!ASSETS.some((asset) => asset.pair === pair) || !Number.isInteger(levels) || levels < 1 || levels > 100) throw new Error("Unsupported order book configuration.");
  }

  reset(): void {
    this.bids.clear();
    this.asks.clear();
    this.pending = [];
    this.lastUpdateId = null;
    this.eventTime = 0;
    this.synchronized = false;
  }

  push(raw: unknown): OrderBookSyncResult {
    const update = parseUpdate(raw, this.pair);
    if (!update) return { book: null, needsSnapshot: false };
    return this.receive(update);
  }

  installSnapshot(raw: unknown): OrderBookSyncResult {
    const snapshot = parseDepthSnapshot(raw);
    if (!snapshot) return { book: null, needsSnapshot: true };
    this.bids = new Map(snapshot.bids.filter(([, quantity]) => quantity > 0));
    this.asks = new Map(snapshot.asks.filter(([, quantity]) => quantity > 0));
    this.lastUpdateId = snapshot.lastUpdateId;
    this.eventTime = 0;
    this.synchronized = false;
    const pending = this.pending;
    this.pending = [];
    let synchronizedBook: OrderBookView | null = null;
    for (const update of pending) {
      const result = this.receive(update);
      if (result.needsSnapshot) return result;
      if (result.book) synchronizedBook = result.book;
    }
    return { book: synchronizedBook, needsSnapshot: false };
  }

  private receive(update: DepthUpdate): OrderBookSyncResult {
    if (this.lastUpdateId === null) {
      this.pending.push(update);
      if (this.pending.length > MAX_BUFFERED_UPDATES) {
        this.pending = [update];
        return { book: null, needsSnapshot: true };
      }
      return { book: null, needsSnapshot: false };
    }
    if (update.u <= this.lastUpdateId) return { book: null, needsSnapshot: false };
    if (!this.synchronized) {
      if (update.U > this.lastUpdateId + 1) return this.invalidate(update);
      if (update.u < this.lastUpdateId + 1) return { book: null, needsSnapshot: false };
    } else if (update.U > this.lastUpdateId + 1 || (update.pu !== undefined && update.pu !== this.lastUpdateId)) {
      return this.invalidate(update);
    }
    this.applyLevels(this.bids, update.b, true);
    this.applyLevels(this.asks, update.a, false);
    this.lastUpdateId = update.u;
    this.eventTime = update.E;
    this.synchronized = true;
    const book = this.toView();
    return book ? { book, needsSnapshot: false } : this.invalidate(update);
  }

  private invalidate(update: DepthUpdate): OrderBookSyncResult {
    this.bids.clear();
    this.asks.clear();
    this.pending = [update];
    this.lastUpdateId = null;
    this.eventTime = 0;
    this.synchronized = false;
    return { book: null, needsSnapshot: true };
  }

  private applyLevels(side: Map<number, number>, changes: [number, number][], bids: boolean): void {
    for (const [price, quantity] of changes) {
      if (quantity === 0) side.delete(price);
      else side.set(price, quantity);
    }
    if (side.size > MAX_BOOK_LEVELS) {
      const discarded = [...side.keys()].sort((a, b) => bids ? b - a : a - b).slice(MAX_BOOK_LEVELS);
      for (const price of discarded) side.delete(price);
    }
  }

  private toView(): OrderBookView | null {
    if (!this.synchronized || this.lastUpdateId === null) return null;
    const bids = [...this.bids].map(([price, quantity]) => ({ price, quantity })).sort((a, b) => b.price - a.price).slice(0, this.levels);
    const asks = [...this.asks].map(([price, quantity]) => ({ price, quantity })).sort((a, b) => a.price - b.price).slice(0, this.levels);
    if (!bids.length || !asks.length || bids[0].price >= asks[0].price) return null;
    return { pair: this.pair, lastUpdateId: this.lastUpdateId, eventTime: this.eventTime, bids, asks };
  }
}
