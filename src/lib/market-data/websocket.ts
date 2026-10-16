import { ASSETS, Timeframe } from "./schema";
import { parseBinanceStreamMessage, type MarketStreamEvent } from "./stream";

export type MarketConnectionStatus = "connecting" | "connected" | "reconnecting" | "stale" | "error" | "disconnected";
export type BrowserSocket = Pick<WebSocket, "onopen" | "onmessage" | "onerror" | "onclose" | "close">;
export type StreamHandlers = { onStatus: (status: MarketConnectionStatus) => void; onEvent: (event: MarketStreamEvent) => void };
const WS_ORIGIN = "wss://data-stream.binance.vision/stream?streams=";
const STALE_AFTER_MS = 12_000;
const MAX_RETRY_MS = 30_000;

export function buildCombinedStreamUrl(pairs: string[], selectedPair: string, interval: string): string {
  const allowed = new Set<string>(ASSETS.map((asset) => asset.pair));
  const timeframe = Timeframe.safeParse(interval);
  if (!timeframe.success || !allowed.has(selectedPair) || pairs.some((pair) => !allowed.has(pair))) throw new Error("Unsupported market stream subscription.");
  const streams = [...new Set(pairs)].map((pair) => `${pair.toLowerCase()}@ticker`);
  streams.push(`${selectedPair.toLowerCase()}@kline_${timeframe.data}`, `${selectedPair.toLowerCase()}@depth@100ms`);
  return `${WS_ORIGIN}${streams.join("/")}`;
}

export function createBinanceMarketStream(options: {
  pairs: string[];
  selectedPair: string;
  interval: string;
  handlers: StreamHandlers;
  socketFactory?: (url: string) => BrowserSocket;
  random?: () => number;
  now?: () => number;
  staleAfterMs?: number;
}) {
  const { pairs, selectedPair, interval, handlers } = options;
  const url = buildCombinedStreamUrl(pairs, selectedPair, interval);
  const socketFactory = options.socketFactory ?? ((address) => new WebSocket(address));
  const random = options.random ?? Math.random;
  const now = options.now ?? Date.now;
  const staleAfter = options.staleAfterMs ?? STALE_AFTER_MS;
  const subscribedPairs = new Set(pairs);
  let socket: BrowserSocket | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let staleTimer: ReturnType<typeof setInterval> | undefined;
  let retries = 0;
  let lastValidAt = now();
  let connectedAt: number | null = null;
  let receivedValidEvent = false;
  let disposed = false;

  const setStatus = (status: MarketConnectionStatus) => handlers.onStatus(status);
  const dataExpired = () => receivedValidEvent ? now() - lastValidAt > staleAfter : connectedAt !== null && now() - connectedAt > staleAfter;
  const reconnect = () => {
    if (disposed || retryTimer) return;
    setStatus(dataExpired() ? "stale" : "reconnecting");
    const delay = Math.min(MAX_RETRY_MS, 1_000 * 2 ** Math.min(retries++, 5));
    retryTimer = setTimeout(() => { retryTimer = undefined; connect(); }, delay * (0.75 + random() * 0.5));
  };
  const connect = () => {
    if (disposed) return;
    connectedAt = null;
    setStatus(retries === 0 ? "connecting" : "reconnecting");
    try {
      socket = socketFactory(url);
      const current = socket;
      current.onopen = () => { connectedAt = now(); };
      current.onmessage = (message) => {
        const event = parseBinanceStreamMessage(message.data);
        if (!event || !subscribedPairs.has(event.pair) || (event.type === "candle" && (event.pair !== selectedPair || event.interval !== interval)) || (event.type === "depth" && event.pair !== selectedPair)) return;
        receivedValidEvent = true;
        lastValidAt = now();
        retries = 0;
        setStatus("connected");
        handlers.onEvent(event);
      };
      current.onerror = () => setStatus("error");
      current.onclose = () => { if (socket === current) socket = null; reconnect(); connectedAt = null; };
    } catch {
      socket = null;
      setStatus("error");
      reconnect();
    }
  };

  connect();
  staleTimer = setInterval(() => {
    if (disposed || !dataExpired()) return;
    if (socket) { setStatus("stale"); socket.close(); }
    else if (!retryTimer) reconnect();
  }, Math.min(1_000, staleAfter));

  return {
    close() {
      if (disposed) return;
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (staleTimer) clearInterval(staleTimer);
      retryTimer = undefined;
      staleTimer = undefined;
      const current = socket;
      socket = null;
      if (current) { current.onclose = null; current.close(); }
      setStatus("disconnected");
    },
  };
}
