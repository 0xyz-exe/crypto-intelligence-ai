# Real-time and trading upgrade audit

## Existing architecture and confirmed flows

- A local SQLite database and one-time password setup/login now protect the workspace and persist paper account/order/mark state for the single local owner. Session and route details are documented in `docs/TRADING_SECURITY_AUDIT.md`.
- `src/lib/market-data/provider.ts` fetches a Binance Spot USDT-pair REST ticker snapshot and 200 historical candles. Server validates/normalizes payloads, uses a fixed official host, timeout, bounded retry, and Next cache hints.
- `/api/markets` and `/api/history` use live REST unless `mode=demo` is explicitly selected. Demo values and candles originate from deterministic synthetic fixtures in `schema.ts`; browser starts in demo mode.
- Live mode opens a browser-side combined Binance Spot stream for allowlisted ticker and selected-pair/interval kline and `@depth@100ms` events. Connection state requires valid events; chart candle freshness is tracked for the selected pair and interval separately.
- Price chart is a compact SVG polyline of REST history with incremental streamed candle updates. Volume bars and crosshair are absent. A partial local order book is reconciled from a REST snapshot and diff-depth sequence; see scope limits below.
- Watchlist is browser-local. Indicators and a deterministic analyst summary are client-side; optional `:free` AI runs through the server route.
- A deterministic closed-candle EMA strategy, server-side SQLite paper simulation, sampled server-fetched marks, and a basic EMA backtest exist. No exchange order adapter, testnet or live execution, or automated strategy scheduler exists. A local account gate and persisted paper kill switch are implemented.

## Real versus simulated

| Feature | Actual status |
|---|---|
| Live market overview/history | Binance REST snapshot when user selects Live; public exchange-specific values |
| Demo prices/candles | Synthetic, deterministic fixture values; not live/historical observations |
| Stream freshness / incremental chart | Browser received real Binance Spot ticker events through the official market-data-only stream at `wss://data-stream.binance.vision`; selected-chart candle freshness and event-time ordering are implemented |
| Order book | Partial local view from a 100-level Binance REST snapshot + buffered `U/u` diff-depth events; UI hides depth until sequence bridging succeeds; 10 levels displayed per side |
| AI | Deterministic by default; optional separately configured free-model call |
| Trading | Local manual paper simulation only; no exchange orders |

The prior `BTC 24H CHANGE` value is drawn from the selected mode's ticker DTO. In default Demo mode it is synthetic; it should not be described as live.

## Risks and constraints

- A Chromium browser on the local app origin received real BTCUSDT ticker and diff-depth events from `data-stream.binance.vision`; the local API returned a Binance REST depth snapshot and the integrated UI reached “Sequence synchronized” with live bid/ask levels. The `stream.binance.com` hosts on ports 9443 and 443 errored in this runtime. This verifies this browser/network path once, not sustained availability or other deployments.
- No exchange trading credentials are configured or required. Testnet and live execution are excluded and disabled; withdrawals/transfers do not exist.
- Server-side paper account/orders/marks persist in local SQLite, with owner-scoped access, transactional order/idempotency handling, fresh server quotes, and a persistent paper-only halt control. The database is a local simulation store, not an independently backed-up or tamper-evident financial ledger.
- A browser WebSocket can connect only to a public data stream; no private credentials or trading endpoints will be included in the client.
- The local book buffers Spot diff-depth events before the REST snapshot, bridges the snapshot with the `U/u` update-ID range, rejects sequence gaps, and hides depth while stale or resynchronizing. `pu` is tolerated when present but is not required for the Spot stream.
- This is partial depth: the API requests 100 REST levels, displays the best 10 represented levels, bounds local maps, and cannot know unchanged levels outside the initial snapshot. Do not treat it as a full exchange book or use it for execution, imbalance signals, or trading decisions.
- Backtest results depend on bar timing, fee/slippage assumptions and available history; no profitability claim is valid.

## Incremental plan

1. **Implemented:** Runtime-validated Binance combined `@ticker`, selected-interval `@kline`, and selected-pair `@depth@100ms` parsing; allowlisted subscriptions, bounded reconnect and stale-state behavior. Uses Binance's documented market-data-only WebSocket host `wss://data-stream.binance.vision`.
2. **Implemented:** Stream events update ticker rows and the candle for its interval open time; synthetic/live/reconnecting/stale labels are separated.
3. **Implemented:** Pure EMA strategy, paper simulation, and risk policy are separate from exchange execution and covered by tests.
4. **Implemented with limits:** Paper-account setup/login, authenticated server-side SQLite account/order persistence, a persisted paper-only kill switch, and manual paper orders requiring fresh browser ticker data plus a fresh server-fetched quote. Open positions receive server-fetched marks no more often than once every 5 seconds; samples are capped and are not continuous or audit-grade.
5. **Implemented with limits:** Deterministic EMA backtest uses closed-bar signals, next-candle-open fills, fees/slippage, position cap, in/out-of-sample reports and a buy-and-hold comparison. Market microstructure, stops and partial fills are not modeled.
6. **Implemented with limits:** Partial local order book uses a 100-level REST snapshot, buffered Spot diff-depth events, `U/u` snapshot bridging, and gap-triggered resynchronization; browser UI hides depth unless the sequence is synchronized and fresher than five seconds. One-off real-browser/network probe passed; sustained availability is unverified.
7. **Boundary:** Exchange testnet and live order submission are explicitly excluded and disabled; no order adapter or exchange credential path is present. Do not implement either without a separate threat model, design, review, and explicit authorization.

## Acceptance criteria

- One public combined connection, no credentials; allowlisted ticker pairs, selected timeframe, and selected-pair depth.
- Connection status reports fresh only after a valid event and becomes stale if valid events stop; reconnect uses bounded exponential backoff with jitter.
- Order-book depth is hidden until the REST snapshot bridge is complete, sequence continuity is maintained, and data is fresh; depth is explicitly partial.
- Ticker/interval parsing rejects invalid symbols, prices, timestamps and payloads.
- Current kline is replaced/updated by its interval open time; finalized bars are not duplicated by repeated updates.
- Live display uses exchange event/receipt timestamps and never continues to call old data live while disconnected.
- Paper mode remains simulation-only; server-side orders use fresh server quotes, persisted owner-scoped state, bounded risk checks, idempotency and a database-enforced paper halt. Backtests and signals cannot submit orders.
- Testnet and live execution flags are false; no exchange trading credentials or order-submission endpoints exist.
- **PASS:** Unit suite 45/45 across 12 files; deterministic Playwright E2E 6/6; lint, typecheck, production build, `npm audit --audit-level=high` (0 vulnerabilities), and `git diff --check` passed.
- **PASS (one-off real-browser probe):** Chromium on the local app origin received Binance BTCUSDT ticker and depth events; `/api/orderbook` returned a real REST snapshot and the UI reached “Sequence synchronized” with bid/ask levels.
- **NOT VERIFIED:** Sustained connectivity on other networks, browsers, or production deployments.
- **BOUNDARY / NOT IMPLEMENTED:** Automated order scheduling, exchange testnet, and live execution; account persistence/authentication and the paper-only server kill switch are implemented.
