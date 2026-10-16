# Test plan

## Unit
- SMA/EMA/RSI/MACD/Bollinger/ATR formulas, initialization, insufficient history, flat/rising/falling prices and invalid inputs.
- Price-change calculation; provider/schema normalization; freshness classification; AI output validation; error mapping and retry constraints.

## Integration
- Provider adapter with mocked fetch: valid/invalid payloads, timeout, 429/5xx, bounded retry and fixed URL.
- Route query validation and demo/live separation; failure never returns fixtures in live mode.
- AI unavailable, free-only model selection, bad response schema and deterministic fallback.

## Browser / E2E
- Dashboard, demo label and supported assets; search and detail; timeframe selection; indicators; watchlist add/remove across reload; deterministic AI-unavailable state; responsive nav; keyboard focus; provider error; no API key in browser-visible assets.

## Results

Record commands and actual PASS/FAIL/BLOCKED/NOT RUN after implementation. Live API/paid AI are not test dependencies. Prefer locators and explicit state assertions rather than fixed sleeps.
