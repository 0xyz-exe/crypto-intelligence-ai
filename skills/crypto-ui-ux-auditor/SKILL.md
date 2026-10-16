---
name: crypto-ui-ux-auditor
description: "Use when reviewing Crypto Intelligence AI screens or interactions. Find accessibility, clarity, responsive, and data-provenance defects."
version: 1.0.0
license: MIT
platforms: [windows, linux, macos]
metadata:
  hermes:
    tags: [crypto, ui, ux, accessibility]
---

# Crypto UI/UX auditor

Purpose: audit the market-research UI for usability and honest state communication.

Inputs: running application, affected screen, target viewport(s), and UX brief. Required tools: browser automation and repository inspection.

Workflow: inspect loading/empty/success/error states; verify demo-vs-live label, source, freshness, unsupported metrics, and non-advisory context; exercise search, chart range, watchlist and AI actions; check keyboard focus, accessible names, contrast-by-label, reduced motion and mobile overflow. Report actionable issues with screen, reproduction, impact, and smallest fix.

Output: prioritized issue list plus verified recommendations; do not report a fix as complete until retested.

Verification: use actual DOM/locators and representative desktop/mobile widths, not screenshots alone.

Failure handling: if browser access or data state is unavailable, identify the blocker and do not infer behavior.

Safety: do not connect accounts, expose credentials, or mistake synthetic fixtures for current prices.