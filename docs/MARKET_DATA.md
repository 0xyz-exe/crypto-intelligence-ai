# Market data

## Provider decision
Primary live source: Binance Spot public Market Data API (`https://data-api.binance.vision`). Binance's official Market Data Only FAQ states these public endpoints do not require authentication and only serve public market data. Official endpoint docs include `GET /api/v3/ticker/24hr` and `GET /api/v3/klines`.

- Source: [Market Data Only](https://developers.binance.com/docs/binance-spot-api-docs/faqs/market_data_only)
- Endpoints: [Market Data Endpoints](https://developers.binance.com/docs/binance-spot-api-docs/rest-api/market-data-endpoints)
- API catalog: [Spot REST API](https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/rest-api/market)

Data is exchange/pair-specific, not consolidated global market capitalization. In the MVP, market cap is unavailable and must be shown as unavailable rather than estimated. 24-hour quote volume is a quote-asset amount (USDT), not a USD-normalized global volume.

## Limits and attribution

Public does not mean unlimited or guaranteed. Rate limits are shared by endpoint/IP and may change. The client must bound request counts, avoid polling loops, apply short deadlines, and display service errors/rate limits. Recheck current official endpoint weight/limit documentation before release. Binance is the attributed source; its public endpoint provides no general guarantee of uptime or global coverage. Data-use terms may restrict redistribution/commercial uses; the MVP remains a personal educational app and must be reviewed against current terms before public deployment. Do not claim legal clearance.

## Runtime behavior

- Live data uses fixed host, supported symbol allowlist and bounded query values.
- All provider responses validate at runtime before normalization.
- Requests use finite timeouts and limited retry only for transient network/server errors; do not retry 4xx/429 blindly.
- No user-controlled URL fetching.
- Demo fixtures are explicitly selected and labeled.
- Live error never silently falls back to demo.
- Show provider, fetched-at time, and stale/error status.

## Schema and normalization

Normalize ticker payload into `AssetMarket`: stable internal asset ID, symbol, pair, quote currency, price, percent change, base/quote volume. Normalize kline rows into open timestamp, OHLC, volume. Reject nonfinite/negative price values, malformed timestamps, excessive result counts, unexpected pair symbols, and invalid interval values.

## Historical behavior

Supported intervals are an allowlist (1h, 4h, 1d) and counts are bounded. History is exchange candle data; timeframe coverage/availability depends on the provider. Empty or malformed history is an unavailable state, never a generated series.
