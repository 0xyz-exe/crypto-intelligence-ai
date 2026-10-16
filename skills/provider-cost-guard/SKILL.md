---
name: provider-cost-guard
description: "Use when adding or changing AI, hosting, telemetry, or market-data services. Prove the selected path cannot silently incur charges."
version: 1.0.0
license: MIT
platforms: [windows, linux, macos]
metadata:
  hermes:
    tags: [cost, providers, crypto]
---

# Provider cost guard

Purpose: protect the local Rp0 MVP from hidden paid usage and uncontrolled request volume.

Inputs: provider endpoint/model, current price/terms/quotas, required key, retry/cache schedule and deployment context. Required tools: official service docs, config/source inspection and tests.

Workflow: confirm current free-tier availability, limits, key requirements and terms; default to no AI; allow only explicitly configured free model IDs; bound time, output, retries and request rates; implement visible deterministic fallback; inspect lockfile, telemetry and hosting assumptions; document provider changes.

Output: cost-risk decision, verified evidence links, safeguards and update to `docs/COST_POLICY.md`.

Verification: missing key causes no external AI call; provider failure never selects a paid tier; no automatic model pull, billing setup, upgrade or paid-hosting assumption exists.

Failure handling: if free terms are unclear or changed, disable that integration until reviewed.

Safety: never request/enter payment credentials, activate billing or incur costs without explicit user authorization.