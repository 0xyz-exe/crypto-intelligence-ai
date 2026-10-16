# Debugging guide

1. Reproduce using the exact mode and route; record sanitized command/error.
2. Separate provider failure from schema/calculation/UI failure; do not make live failures silently switch to fixtures.
3. Inspect normalized DTO and validation error without logging credentials or full sensitive request bodies.
4. Use deterministic fixtures for reproducible calculations and integration tests.
5. Correct root cause and add a regression case; do not disable type checks or broadly swallow exceptions.
6. Re-run relevant lint, typecheck, unit/integration tests and production build.

## Common cases

- **Provider timeout/429:** finite timeout, respect `Retry-After` if supplied, bounded backoff; show retryable status, no unbounded retry.
- **Malformed market response:** reject schema, preserve no fabricated observations, expose safe provider error.
- **No AI key:** deterministic report, clearly state AI unavailable; never inspect Hermes credentials.
- **Invalid model JSON:** reject output and keep deterministic report; never render model output as HTML.
- **Insufficient candle history:** indicator unavailable until minimum period is satisfied.
- **Browser storage disabled:** keep UI usable for session and explain persistence unavailable.
