---
name: security-audit
description: "Use when reviewing security of the cryptocurrency research app or its integrations. Validate boundaries and record residual risks."
version: 1.0.0
license: MIT
platforms: [windows, linux, macos]
metadata:
  hermes:
    tags: [crypto, security, audit]
---

# Security audit

Purpose: review concrete code paths for secret exposure, abuse and unsafe external data.

Inputs: repository diff, dependencies, routes, environment variables, provider endpoints and deployment assumptions. Required tools: static search, audit command, focused tests; consult current OWASP/provider docs when claims depend on them.

Workflow: inspect secrets/client bundle; validate inputs/outputs; review fixed outbound destinations, size/time/retry bounds, rate limiting and cache isolation; assess XSS/CSRF/SSRF/prompt injection/resource exhaustion; run `npm audit`; add regression tests for confirmed defects; document severity, evidence, impact, remediation and residual risk.

Output: prioritized findings and verified corrections in `docs/SECURITY_AUDIT.md`.

Verification: rerun affected tests/audits and inspect changed code; a clean dependency scan is not certification.

Failure handling: distinguish confirmed defects from deployment-dependent risks; do not claim unresolved findings are fixed.

Safety: never reveal secrets, disable controls, use Hermes credentials for the app, or commit local `.env` files.