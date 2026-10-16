---
name: crypto-data-quality-check
description: "Use when verifying a market snapshot, candle series, or demo/live label. Check schema, provenance, freshness, and numerical integrity."
version: 1.0.0
license: MIT
platforms: [windows, linux, macos]
metadata:
  hermes:
    tags: [crypto, data-quality, validation]
---

# Crypto data quality check

Purpose: detect invalid, partial, stale, mislabeled or mis-normalized market inputs.

Inputs: raw/normalized payload, provider identifier, symbol, quote unit, fetch timestamp, candle timeframe and mode. Required tools: schema and adapter tests; provider documentation for units/semantics.

Workflow: verify allowlisted pair and quote; validate finite positive prices, volume, OHLC relationships and timestamps; check duplicates/order/gaps and response completeness; compare source/time/mode with UI labels; separate exchange-specific volume from unsupported global market-cap claims; test malformed samples.

Output: quality findings, affected sample range and accept/reject recommendation.

Verification: source attribution, synthetic/live state, timestamp and missing-data handling agree through UI and API.

Failure handling: reject invalid data and report the precise reason; never silently interpolate, fabricate or relabel fixtures.

Safety: preserve raw evidence only as needed; never present uncertain exchange data as consolidated global truth.