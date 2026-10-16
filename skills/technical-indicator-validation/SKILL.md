---
name: technical-indicator-validation
description: "Use when implementing or changing market indicators. Specify formulas and verify numerical edge cases independently."
version: 1.0.0
license: MIT
platforms: [windows, linux, macos]
metadata:
  hermes:
    tags: [crypto, indicators, numerical-tests]
---

# Technical indicator validation

Purpose: keep indicator calculations deterministic, transparent and independently testable.

Inputs: formula specification, ordered validated candles/prices, period/init rules, and intended outputs. Required tools: source inspection, numerical calculation, unit-test runner.

Workflow: document warm-up/null behavior and initialization; implement pure functions; validate period and finite inputs without forbidding legitimate negative intermediate values; derive hand-checkable rising/falling/flat, short-history and boundary vectors; compare outputs to independent arithmetic; add regression tests.

Output: formula notes, implementation and tests.

Verification: exact known-value tests cover EMA seed, RSI edge cases, MACD signal alignment, band deviation convention and ATR true-range seed.

Failure handling: stop and report discrepancies; never adjust a test expectation to conceal a calculation defect.

Safety: indicators are historical descriptions, not forecasts or investment advice; do not use an LLM as numerical authority.