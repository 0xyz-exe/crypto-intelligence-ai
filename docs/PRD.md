# Product requirements document — Crypto Intelligence AI

## Problem and vision

Retail researchers lack a single approachable workspace that distinguishes observed market data from computed indicators and speculative interpretation. Crypto Intelligence AI is an educational research dashboard that combines attributed market observations, reproducible technical measures, and optional AI explanations without trading actions or profit claims.

## Personas and primary journeys

- **Learner:** open dashboard → search BTC → inspect historical prices and indicator definitions → understand the deterministic summary.
- **Retail researcher:** compare market snapshot and chart → inspect provider timestamp/staleness → optionally request an explanation.
- **Developer:** explore stable asset identifiers, normalized data and documented provider boundaries.

## Scope and exclusions

**MVP:** dashboard, search, asset details, historical chart/timeframes, SMA/EMA/RSI/MACD/Bollinger Bands/ATR, explicit live/demo mode, locally persistent watchlist, deterministic analyst report, optional separately configured AI, responsive accessible UI, validation/tests/docs.

**Explicitly out of scope:** order execution, trading recommendations, guaranteed forecasts, custody/signing, leverage, accounts/cloud-sync, paid data or AI service, model downloads, portfolio tracking, alerts, news sentiment, backtesting, advanced quant models.

## Functional requirements

1. Show top assets, available quote price/change/market cap/volume, source and successful update time.
2. Show loading/error/retry and stale states; never label demo fixtures as live or silently replace live responses with fixtures.
3. Search a bounded supported asset list, route by stable provider identifier, show historical price and timeframe with missing-history handling.
4. Calculate supported indicators deterministically; expose only indicators supported by sufficient valid observations.
5. Provide factual deterministic analysis without AI; optional AI must use validated application data and label model interpretation distinctly.
6. Persist watchlist locally, with add/remove and empty state.
7. Avoid nonfunctional controls and expose unavailable providers honestly.

## Non-functional requirements

- Strict TypeScript; runtime input/provider validation; server-side provider requests, bounded timeout/retries and bounded request volume.
- Responsive desktop/mobile UI, semantic controls, visible focus, keyboard usability, reduced-motion support; color is not the sole directional cue.
- No secrets in browser bundles, repository, or logs. Application works without AI credentials or a local model.
- Deterministic tests; no paid dependency or service required for default demo configuration.
- Clear attribution, data timestamps, risk/disclaimer and known service limitations.

## Prioritized stories and acceptance criteria

### P0 — trustworthy market overview
**As a researcher, I can distinguish provider data from demo data.** Given demo mode is explicitly selected, when the dashboard loads, then it labels data as demo/fixture and shows no real-time claim. Given live mode succeeds, when valid provider data loads, then source and update time appear. Given live mode fails, then an actionable error/retry is shown and fixtures are not substituted.

### P0 — asset search and detail
**As a learner, I can locate a supported asset and inspect history.** Given a supported asset, when I search its symbol/name, then I can open its detail view. Given valid history, then chart/timeframe and available price change render. Given absent/invalid history, then the UI presents a clear empty/error state and no fabricated series.

### P0 — reproducible technical analysis
**As a researcher, I can see deterministic indicators.** Given a known sequence with sufficient observations, when indicators are calculated, then results match independently verified test values. Given insufficient or malformed observations, then the calculation rejects or marks unavailable rather than inventing a value.

### P0 — useful without AI
**As a user without an AI key, I can still understand the data.** Given no optional provider is configured or available, when analysis is requested, then the app returns a clearly labeled deterministic report from validated facts/indicators and states that no model generated it.

### P0 — private watchlist
**As a user, I can maintain a personal watchlist.** Given browser storage is available, when I add/remove an asset, then the list persists locally across reloads; when empty, an explicit empty state is shown.

### P1 — optional AI analyst
**As a user, I can request a structured explanation with explicit uncertainty.** Given a separately configured free-only model identifier and API key, when a request succeeds, then validated structured content distinguishes observations, metrics, interpretation, risk and limitations. Given key absent, provider error, or invalid output, then no hidden paid fallback occurs and deterministic analysis remains available.

### P1 — resilience and accessibility
**As a keyboard/mobile user, I can use core research flows.** Given narrow viewport/keyboard-only use, then navigation, search, watchlist and timeframe controls remain operable and focus is visible; reduced-motion is respected.

### P2 — future cloud and research features
Authentication/sync, alerts, portfolio tracking, sentiment, backtesting and quantitative modeling are deferred and explicitly excluded from this release.

## Assumptions, risks, limitations

- Public exchange data and service availability can vary by region and provider; the provider is not an investment-grade feed.
- Market coverage reflects chosen exchange pairs, not a global consolidated price.
- Browser storage is device/browser local and can be cleared; it is not an account-backed backup.
- Free AI model availability and quotas can change; AI must stay optional and disabled by default without explicit config.
- Technical indicators describe historical series and are not forecasts or financial advice.
- Current external service terms and endpoint behavior must be verified and documented before enabling live integration.
