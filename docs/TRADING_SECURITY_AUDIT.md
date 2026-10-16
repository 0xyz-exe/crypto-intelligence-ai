# Trading Security Audit

## Scope and disposition

This review covers the local, single-user Windows app and the implementation in this repository. It is not a production certification. The app has a one-time local account setup, server-side password verification and sessions, protected API routes, SQLite-backed server-side paper state, and a persisted paper-only kill switch. **No exchange testnet or live execution adapter is implemented or enabled.** No exchange trading credentials are requested or used.

## Findings

### HIGH — Local SQLite records are not encrypted, backed up, or tamper-evident

- **Evidence:** `src/lib/server/database.ts` stores the local account, sessions, paper account, orders, marks, and controls in SQLite under the current Windows user's local data directory.
- **Impact:** A person or process with access to that user account or file can copy, edit, or delete local records. The application does not provide database encryption, recovery, or immutable audit evidence.
- **Remediation:** Keep the app local-only, protect the Windows account and data directory, and do not treat paper state as financial records or expose it to multiple users.
- **Residual risk:** Remains for local MVP use; no independent backup or tamper-proof ledger is provided.

### HIGH — Testnet and live execution are not implemented

- **Evidence:** No exchange order adapter, private exchange credential path, testnet adapter, live adapter, reconciliation service, or exchange-side cancel path exists. The persisted kill switch applies only to simulated paper orders.
- **Impact:** The paper UI and kill switch must not be interpreted as authorization or readiness for exchange execution. Switching modes or adding browser credentials would bypass necessary controls.
- **Remediation:** Keep testnet and live execution outside this scope. Any future execution capability requires a separate threat model, server-only credential design, explicit user authorization, reconciliation, idempotency, independent risk controls, and review.
- **Regression tests:** API responses and E2E assert both `testnetExecutionEnabled` and `liveExecutionEnabled` are `false`; no exchange orders have been submitted.
- **Residual risk:** No real exchange activity is possible through the implemented app, but future changes could invalidate this boundary.

### MEDIUM — Market-data WebSocket availability varies by network and endpoint

- **Evidence:** A one-off Chromium run from the local app origin received a real Binance BTCUSDT `24hrTicker` on `wss://data-stream.binance.vision`, and the integrated Live UI reported fresh. `stream.binance.com` on ports 9443 and 443 returned browser socket errors from this runtime.
- **Impact:** Stream access depends on network, browser, and hosting egress policy; REST snapshots may still succeed when WebSockets do not.
- **Remediation:** Use the documented market-data-only endpoint; preserve distinct connecting/reconnecting/stale/error states and verify the deployed environment separately.
- **Regression tests:** Unit lifecycle tests and deterministic E2E cover controlled payloads, stale timeouts, reconnect behavior, and selected-candle status. The successful live browser probe is intentionally not part of the deterministic suite.
- **Residual risk:** Sustained connectivity on other networks and production deployments remains unverified.

### MEDIUM — Local account security depends on Windows and loopback boundaries

- **Evidence:** The app is intended to bind to `127.0.0.1`; sessions are HttpOnly and SameSite=Strict, but local development uses HTTP and the cookie is not marked Secure on HTTP.
- **Impact:** A compromised Windows account, browser extension, malware, or same-origin script injection can operate through the authenticated browser. The app has no password recovery.
- **Remediation:** Keep the server bound to loopback, protect the Windows account and data folder, and do not place the local app behind an unreviewed reverse proxy or expose it to a LAN.
- **Residual risk:** This is a local single-user app, not a hardened remote service.

### LOW — Production response headers and edge controls are not verified

- **Evidence:** This code-level review did not inspect production hosting/CDN response headers.
- **Impact:** CSP, frame restrictions, and related defenses cannot be asserted from this report.
- **Remediation:** Verify runtime headers and deployment configuration before public production use; do not add a permissive CSP as a shortcut.
- **Residual risk:** Unknown until deployment is inspected.

## Controls present

- Auth setup/login is server-side, password hashes use scrypt, session tokens are hashed in SQLite, and failed logins are throttled.
- Protected APIs validate sessions; state-changing routes require loopback same-origin checks and bounded JSON requests.
- Server-side paper account, order results, marks, and halt state are SQLite-backed. Paper orders use a server-fetched fresh quote and a transactionally rechecked persisted halt state; order IDs are unique per owner.
- Market data uses public, allowlisted Binance Spot endpoints. No exchange trading credential is needed or requested.
- No exchange order submission, testnet adapter, live adapter, withdrawal capability, or transfer permission exists.
- Backtest and strategy signals are not order-execution instructions; AI analysis has no route to trading controls.
- UI labels distinguish synthetic Demo, Live market data, and simulated Paper Trading.

## Security regression checks

- `npm test -- auth.test.ts session.test.ts database.test.ts paper-service.test.ts`
- `npm run test:e2e`
- `npm run lint && npm run typecheck`
- `npm run build`

## Testnet-only scope decision (not an implementation)

Decision: keep testnet execution **out of this release**. Testnet orders still require an exchange execution adapter and credential handling, so they are not a harmless extension of paper trading. There is no testnet adapter, endpoint, credential input, or order route; API status explicitly reports both testnet and live execution disabled. No exchange orders were submitted.

If separately authorized in the future, a testnet capability should be a distinct server-only adapter pinned to the exchange's verified official testnet host, with separate testnet credentials held server-side, no withdrawals/transfers, an explicit enable action, fail-closed behavior, and tests proving production hosts cannot be reached or selected. It must never fall back or switch to live execution. That design and implementation require a separate review; this paragraph does not authorize them.

See `docs/TRADING_TEST_PLAN.md` for current automated coverage. This audit does not authorize testnet or live trading.
