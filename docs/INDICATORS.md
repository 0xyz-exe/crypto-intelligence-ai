# Indicator formula and behavior notes

All inputs are ordered closing prices/candles from one provider and interval. No missing observations are interpolated. Warm-up positions are `null`; callers should display unavailable until a value exists.

- **SMA(n):** arithmetic mean of current and preceding `n-1` closes; first output at index `n-1`.
- **EMA(n):** seed with SMA of first `n` values, then `EMA_t = αP_t + (1-α)EMA_(t-1)`, `α=2/(n+1)`. First output at `n-1`. EMA accepts finite intermediate values (MACD itself may be negative); provider prices are validated separately.
- **RSI(n):** Wilder smoothing seeded with arithmetic means of first `n` gains/losses. First output at index `n`. `RSI=100-100/(1+avgGain/avgLoss)`. No losses + positive gains → 100; no gains and no losses → 50.
- **MACD:** EMA(12)−EMA(26); signal is EMA(9) of the MACD line beginning at the first non-null MACD point; histogram = MACD−signal. Null warm-up propagates.
- **Bollinger bands:** SMA(20) with population standard deviation `sqrt(sum((x-mean)^2)/n)`; upper/lower = mean ± 2σ.
- **ATR(n):** True range `max(high-low, abs(high-prevClose), abs(low-prevClose))`; first candle uses high−low. Seed using mean of first `n` true ranges; subsequently Wilder recurrence `(prevATR*(n-1)+TR)/n`.

Periods must be positive integers, MACD fast period below slow period, finite series and candle OHLC relationships are validated. The pure helpers do not replace the runtime schema checks at provider boundaries. These indicators are historical descriptions, not investment advice.
