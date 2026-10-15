# Implementation plan

## Phase 1 — Discovery and requirements (complete)
- Audit local OS, runtime, package manager, Hermes capabilities, disk/memory, Git and model runtime.
- Create PRD and this plan before application code.
- Confirmed target did not exist; created an empty project directory; no Hermes settings or credentials accessed.

## Phase 2 — Foundation
- Scaffold minimal Next.js App Router + strict TypeScript + npm.
- Add styling, lint, test harness and shared responsive shell.
- Verify scaffold, development startup and production build before data features.

## Phase 3 — Market data and demo mode
- Decide and document primary public exchange/provider after checking official API docs/terms.
- Implement typed adapter, runtime schema, timeout and bounded retry; expose source/freshness/errors.
- Add explicit fixture demo mode without silent fallback; add provider normalization tests.

## Phase 4 — Indicators and charts
- Implement SMA, EMA, RSI, MACD, Bollinger Bands and ATR with documented initialization/edge cases.
- Verify deterministic calculations using hand-checkable fixtures; chart valid historical observations.

## Phase 5 — Analysis
- Deterministic report always available.
- Optional model adapter disabled absent app-owned configuration; accept only explicitly free model IDs; enforce timeout, input/output bounds, response schema and no paid fallback.
- Do not configure local inference: Ollama daemon is unavailable and no model is installed/verified.

## Phase 6 — Watchlist and UX
- Add browser-local persistence and empty/error/loading states, accessible controls, reduced motion and narrow-layout checks.

## Phase 7–9 — Reliability, security, verification and docs
- Audit request validation, output rendering, secrets, cost boundaries, provider abuse and dependency state.
- Run lint, type checking, unit/integration tests, E2E browser checks where available and production build; fix regressions.
- Review source for dead code/unsafe assertions, document limitations, ensure no secrets.

## Phase 10 — Delivery
- Record exact commands and actual PASS/FAIL/BLOCKED/NOT RUN evidence.
- Preserve Git history; do not commit, publish or deploy without authorization.

## Acceptance gates

1. Baseline scaffold builds and runs before feature expansion.
2. Every provider response passes schema validation before display or analysis.
3. Demo mode is explicit; live-provider failure never produces fixture data without notice.
4. Indicators are deterministic, independently tested, and unavailable when inputs are insufficient.
5. No AI key/local model is required; no paid fallback is possible.
6. Critical user paths work in a real browser and at narrow viewport, or the exact blocker is documented.
7. Verify tests/build from actual command output and inspect final Git status.

## Known initial risks

- Next.js / Node 26 current compatibility must be checked against installed scaffold output.
- External data provider access may be blocked by exchange policy/network/region.
- Free model inventory/quotas change; no model ID should be assumed valid.
- Playwright CLI is not globally installed; `npx` is available.
