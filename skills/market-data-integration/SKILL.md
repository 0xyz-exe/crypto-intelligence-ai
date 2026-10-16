---
name: market-data-integration
description: "Use when adding or changing a cryptocurrency market-data provider. Verify terms, validate payloads, and preserve provenance."
version: 1.0.0
license: MIT
platforms: [windows, linux, macos]
metadata:
  hermes:
    tags: [crypto, market-data, provider]
---

# Market data integration

Purpose: add a typed exchange/provider adapter without hiding data quality or cost constraints.

Inputs: official provider docs, endpoint/terms, asset mapping, freshness requirements and repository conventions. Required tools: web search and code/test tools.

Workflow: verify current public API terms, attribution, quotas and interval support; allowlist symbols and fixed host; impose timeout, bounded retry, response-size guard and response validation; normalize units and timestamps; separate explicit demo fixtures from live errors; test success and failure payloads; document source, coverage and staleness.

Output: isolated provider adapter, schema, tests, and update to `docs/MARKET_DATA.md`.

Verification: malformed/nonfinite data is rejected, source and timestamp remain visible, unsupported pair is blocked, and live errors never substitute fixtures.

Failure handling: surface provider outage/rate limit and preserve only genuinely cached verified data.

Safety: no auth bypass, unbounded polling, fabricated market caps or paid fallback. Recheck service terms before deployment.