---
name: crypto-prd-generator
description: "Use when turning cryptocurrency product goals into an MVP PRD. Prioritize measurable workflows and hard exclusions."
version: 1.0.0
license: MIT
platforms: [windows, linux, macos]
metadata:
  hermes:
    tags: [crypto, product, prd]
---

# Crypto PRD generator

Purpose: produce a testable scope for an educational market-research product.

Inputs: target users, problem, provider constraints, zero-cost limits, existing architecture, and requested delivery date (if any). Required tools: repository file inspection and tests/acceptance evidence where available.

Workflow: clarify only consequential gaps; separate MVP from future work; write prioritized P0/P1/P2 user stories; give every P0 a Given/When/Then test; specify assumptions, non-goals, market-data limitations, security and acceptance criteria. Reconcile scope with existing docs before editing `docs/PRD.md`.

Output: concise PRD with traceable acceptance checks and explicit educational/non-advisory boundaries.

Verification: each requirement is testable; no feature assumes trading execution, guaranteed returns, paid fallback, or unsupported data.

Failure handling: label unknown provider terms as unverified; do not fill gaps with invented facts.

Safety: preserve existing project decisions and user data; never enable a cost-bearing service without explicit approval.