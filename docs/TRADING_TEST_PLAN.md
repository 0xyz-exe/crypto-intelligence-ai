# Trading Test Plan

## Test commands

- Unit suite: `npm test`
- Focused security/paper suite: `npm test -- auth.test.ts session.test.ts database.test.ts paper-service.test.ts`
- Focused market/trading suite: `npm test -- stream.test.ts orderbook.test.ts paper.test.ts strategy.test.ts backtest.test.ts provider.test.ts`
- Static checks: `npm run lint && npm run typecheck`
- Browser flows: `npm run test:e2e`
- Production build: `npm run build`

## Existing automated coverage

### Unit tests

- **Market stream:** raw/combined payload normalization, symbol/timeframe allowlists, invalid event rejection, exchange timestamps, candle finalization, URL/origin constraints, stale silent sockets, reconnection lifecycle.
- **Server security/persistence:** one-time setup, password validation and throttling, scrypt verification, session issue/expiry/revocation, loopback same-origin and size checks, SQLite schema/reopen persistence, account ownership, order idempotency, transaction rollback, server kill-switch persistence/race rejection, and stale quote rejection.
- **Paper engine:** stale quote rejection, fees/slippage, bounded risk/exposure, duplicate order prevention, account and position calculations; simulation is not an exchange adapter.
- **EMA strategy:** closed-candle crossover calculations, input validation, unsupported/out-of-order candle handling; signals are not predictions and have no execution adapter.
- **Backtest:** deterministic repeated results, invalid candles/configuration, maximum exposure, closed-bar signals with next-open fills, fees, slippage, separate in/out-of-sample segments, and explicit assumptions.

### Playwright end-to-end tests

- One-time setup/login protects the app; API tests cover cookie flags, login failure, logout, cross-origin/malformed requests, and protected-resource rejection.
- Authenticated workspace tests cover search/timeframes, local browser watchlist, deterministic analysis, and no horizontal overflow at a narrow viewport.
- Controlled Binance-like WebSocket updates selected chart/order-book state; deterministic backtest displays in/out-of-sample metrics and trade journal. Paper state hydrates from server, persists in SQLite across reload, marks open positions from sampled fresh server quotes, and server kill-switch blocks orders even when called directly while halted.

The E2E stream is a deterministic browser mock and does not prove live Binance connectivity. Separately, one-off real Chromium testing from the local app origin received live BTCUSDT ticker and diff-depth events, fetched a REST depth snapshot, and displayed a sequence-synchronized partial book. This verifies the current runtime path only, not sustained operation or every network/deployment.

## Not yet implemented or tested

- Full-depth order book beyond the partial 100-level REST snapshot; the current view is not execution-grade.
- Backtest support for stops, take-profits, limit queues, partial fills, market impact, or gap execution.
- Automated strategy scheduler, exchange reconciliation, private-account credential safety, testnet execution, and live trading; testnet/live flags must remain false.
- Actual provider availability and WebSocket connectivity in every deployment/network.
- This test plan validates the local single-user app only; it is not production certification.

## Safety boundary

Never use production exchange credentials or real exchange orders in automated tests. Testnet and live execution remain unimplemented and disabled; do not mark deferred execution requirements complete because UI controls exist. Any future testnet adapter requires separate explicit authorization and a separate fail-closed, testnet-host-pinned design; it must not switch or fall back to live execution. This test plan does not authorize either execution mode.
