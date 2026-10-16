import { expect, test } from "@playwright/test";

const e2ePassword = "e2e-only-passphrase-with-enough-length";

async function loginLocal(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.evaluate(async (password) => {
    const status = await fetch("/api/auth/status", { cache: "no-store" }).then((response) => response.json()) as { setupRequired: boolean };
    const response = await fetch(status.setupRequired ? "/api/auth/setup" : "/api/auth/login", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }),
    });
    if (!response.ok) throw new Error("Local E2E authentication failed.");
  }, e2ePassword);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Market overview" })).toBeVisible();
}

test("demo dashboard, supported asset search and timeframe controls", async ({ page }) => {
  await loginLocal(page);
  await expect(page.getByRole("heading", { name: "Market overview" })).toBeVisible();
  await expect(page.getByText("SYNTHETIC SAMPLE")).toBeVisible();
  await expect(page.getByRole("img", { name: /BTC historical price chart/ })).toBeVisible();
  await page.getByRole("textbox", { name: "Search assets" }).fill("Solana");
  await expect(page.getByRole("row", { name: /Solana/ })).toBeVisible();
  await expect(page.getByRole("row", { name: /Bitcoin/ })).toHaveCount(0);
  await page.getByRole("button", { name: "4h", exact: true }).click();
  await expect(page.getByRole("button", { name: "4h", exact: true })).toHaveClass(/chosen/);
});

test("watchlist is saved locally and deterministic analysis works without a key", async ({ page }) => {
  await loginLocal(page);
  const add = page.getByRole("button", { name: "Add to watchlist: Solana" });
  await add.click();
  await expect(page.getByRole("button", { name: "Remove from watchlist: Solana" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Remove from watchlist: Solana" })).toBeVisible();
  await page.getByRole("button", { name: /Generate research brief/ }).click();
  await expect(page.getByText(/DETERMINISTIC · NO MODEL USED/)).toBeVisible();
  await expect(page.getByText(/Educational information, not financial advice/)).toBeVisible();
});

test("narrow layout has no document-level horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loginLocal(page);
  await expect(page.getByRole("heading", { name: "Market overview" })).toBeVisible();
  const widths = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth, offenders: [...document.querySelectorAll("body *")].map((el) => ({ tag: el.tagName, cls: typeof el.className === "string" ? el.className : "", right: Math.round(el.getBoundingClientRect().right), width: Math.round(el.getBoundingClientRect().width) })).filter((item) => item.right > document.documentElement.clientWidth).slice(0, 10) }));
  expect(widths.content, JSON.stringify(widths.offenders)).toBeLessThanOrEqual(widths.viewport);
});

test("live dashboard consumes a controlled Binance stream and server paper controls persist", async ({ page }) => {
  await loginLocal(page);
  const fixture = await page.evaluate(async () => fetch("/api/markets?mode=demo", { cache: "no-store" }).then((response) => response.json()));
  const now = Date.now(), hour = 3_600_000, openTime = Math.floor(now / hour) * hour;
  const closes = Array.from({ length: 100 }, (_, index) => index < 20 ? 68_120 - index * 12 : index < 50 ? 67_880 + (index - 20) * 14 : index < 75 ? 68_300 - (index - 50) * 16 : 67_900 + (index - 75) * 13);
  const candles = closes.map((close, index) => { const open = index ? closes[index - 1] : close; return { time: openTime - (closes.length - index) * hour, open, high: Math.max(open, close) + 10, low: Math.min(open, close) - 10, close, volume: 120 }; });
  await page.route("**/api/markets?mode=live", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ assets: fixture.assets.map((asset: { id: string; price: number }) => asset.id === "bitcoin" ? { ...asset, price: 68_000 } : asset), source: "controlled test fixture", updatedAt: new Date(now).toISOString(), mode: "live" }) }));
  await page.route("**/api/history?asset=bitcoin&interval=1h&mode=live", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ candles, source: "controlled test fixture", updatedAt: new Date(now).toISOString(), mode: "live" }) }));
  await page.route("**/api/orderbook?asset=bitcoin", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ assetId: "bitcoin", pair: "BTCUSDT", lastUpdateId: 100, bids: [["68000", "1"], ["67990", "2"]], asks: [["68010", "2"], ["68020", "1"]], source: "controlled test fixture", updatedAt: new Date(now).toISOString() }) }));
  await page.addInitScript(() => {
    const nativeSocket = window.WebSocket;
    type Stub = { url: string; emit(data: string): void; disconnect(): void };
    const w = window as typeof window & { __ciaSockets: Stub[] };
    w.__ciaSockets = [];
    class StubSocket {
      readyState = 0; onopen: ((event: Event) => void) | null = null; onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: ((event: Event) => void) | null = null; onclose: ((event: CloseEvent) => void) | null = null;
      constructor(readonly url: string) { setTimeout(() => { this.readyState = 1; this.onopen?.(new Event("open")); }, 0); }
      emit(data: string) { this.onmessage?.(new MessageEvent("message", { data })); }
      disconnect() { this.readyState = 3; this.onclose?.(new CloseEvent("close")); }
      close() { this.disconnect(); }
    }
    window.WebSocket = new Proxy(nativeSocket, { construct(target, args) {
      const url = String(args[0]);
      if (url.startsWith("wss://data-stream.binance.vision/stream?streams=")) {
        const socket = new StubSocket(url); w.__ciaSockets.push(socket); return socket as unknown as WebSocket;
      }
      return Reflect.construct(target, args);
    } });
  });
  await page.reload();
  await expect(page.getByText("PAPER · SIMULATED")).toBeVisible();
  await page.getByRole("button", { name: /Demo data/ }).click();
  await expect(page.getByRole("button", { name: /Live data/ })).toBeVisible();
  await page.waitForFunction(() => (window as typeof window & { __ciaSockets?: unknown[] }).__ciaSockets?.length === 1);
  const depthSnapshotResponse = page.waitForResponse((response) => response.url().includes("/api/orderbook?asset=bitcoin"));
  await page.evaluate((eventTime) => {
    const w = window as typeof window & { __ciaSockets: Array<{ emit(data: string): void }> };
    w.__ciaSockets[0].emit(JSON.stringify({ stream: "btcusdt@ticker", data: { e: "24hrTicker", E: eventTime, s: "BTCUSDT", c: "68001", P: "1.2", q: "123456", b: "68000", a: "68002" } }));
  }, now);
  await expect(page.getByText("Live feed fresh", { exact: true })).toBeVisible();
  await depthSnapshotResponse;
  await page.evaluate((eventTime) => {
    const w = window as typeof window & { __ciaSockets: Array<{ emit(data: string): void }> };
    w.__ciaSockets[0].emit(JSON.stringify({ stream: "btcusdt@depth@100ms", data: { e: "depthUpdate", E: eventTime, s: "BTCUSDT", U: 99, u: 101, pu: 98, b: [["68000", "1.5"]], a: [["68010", "0"]] } }));
  }, now + 1);
  await expect(page.locator("#orderbook .book-status")).toHaveText("Sequence synchronized");
  await expect(page.locator("#orderbook .book-level.bid").first()).toContainText("68,000");
  await page.evaluate(({ eventTime, candle }) => {
    const w = window as typeof window & { __ciaSockets: Array<{ emit(data: string): void }> };
    w.__ciaSockets[0].emit(JSON.stringify({ stream: "btcusdt@kline_1h", data: { e: "kline", E: eventTime, s: "BTCUSDT", k: { t: candle.time, s: "BTCUSDT", o: "68000", h: "68150", l: "67950", c: "68123", v: "15", x: false, i: "1h" } } }));
  }, { eventTime: now, candle: candles.at(-1)! });
  await expect(page.getByRole("img", { name: /BTC historical price chart/ })).toHaveAttribute("data-candle-count", "100");
  await expect(page.locator(".chart-top b")).toHaveText("$68,123");
  await page.getByRole("button", { name: /Run closed-candle backtest/ }).click();
  await expect(page.locator("#backtest")).toContainText("OUT-OF-SAMPLE RETURN");
  await expect(page.getByRole("img", { name: "Out-of-sample backtest equity curve" })).toBeVisible();
  await expect(page.locator("#backtest")).toContainText("Out-of-sample trade journal");
  const buyButton = page.getByRole("button", { name: /Simulate \$100 PAPER BUY/ });
  await expect(buyButton).toBeEnabled();
  await expect(page.getByText("SAVED SIMULATED EQUITY", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Pause paper orders" }).click();
  await expect(page.getByText("SERVER KILL SWITCH · HALTED")).toBeVisible();
  await expect(buyButton).toBeDisabled();
  const blocked = await page.evaluate(async () => {
    const response = await fetch("/api/paper/order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: "e2e-halted-order-001", action: "buy", assetId: "bitcoin", requestedNotional: 100 }) });
    return { status: response.status, payload: await response.json() as { reason: string; account: { positions: unknown[] } } };
  });
  expect(blocked.status).toBe(423);
  expect(blocked.payload.reason).toBe("trading_halted");
  expect(blocked.payload.account.positions).toHaveLength(0);
  const executionBoundary = await page.evaluate(async () => fetch("/api/trading/control", { cache: "no-store" }).then((response) => response.json()) as Promise<{ liveExecutionEnabled: boolean; testnetExecutionEnabled: boolean }>);
  expect(executionBoundary).toMatchObject({ liveExecutionEnabled: false, testnetExecutionEnabled: false });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Market overview" })).toBeVisible();
  await expect(page.getByText("SERVER KILL SWITCH · HALTED")).toBeVisible();
  await expect(page.getByRole("button", { name: "Resume paper orders" })).toBeEnabled();
  const persistedAccount = await page.evaluate(async () => fetch("/api/paper/account", { cache: "no-store" }).then((response) => response.json()) as Promise<{ account: { positions: unknown[] }; control: { halted: boolean } }>);
  expect(persistedAccount.account.positions).toHaveLength(0);
  expect(persistedAccount.control.halted).toBe(true);
  expect(await page.evaluate(() => localStorage.getItem("cia-paper-account"))).toBeNull();
});
