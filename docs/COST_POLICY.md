# Cost policy (Rp0 default)

- Baseline demo and deterministic analysis require no API key, model, subscription, paid endpoint, paid hosting assumption, telemetry, or automatic billing.
- Live exchange market endpoints are public/unauthenticated, but availability and use terms are not guaranteed; infrastructure costs are excluded from the local MVP.
- Optional external AI only allows explicitly selected `:free` OpenRouter models and a separately configured user-provided API key. Limits and availability vary; no paid model fallback. Free status is not a perpetual SLA.
- No local model weights are downloaded. Ollama did not connect to a running server.
- Requests, retries and outputs are bounded; no unbounded polling.
- Recheck provider pricing/terms and model pricing immediately before enabling/distributing.
- Do not claim that deployment or externally hosted inference will be zero cost.
