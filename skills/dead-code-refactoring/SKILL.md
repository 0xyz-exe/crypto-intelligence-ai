---
name: dead-code-refactoring
description: "Use when simplifying unused or duplicated app code. Establish use and a passing baseline before deleting or restructuring."
version: 1.0.0
license: MIT
platforms: [windows, linux, macos]
metadata:
  hermes:
    tags: [refactoring, code-quality, crypto]
---

# Dead-code refactoring

Purpose: reduce verified dead code and duplicated logic without changing user-visible behavior.

Inputs: clean/current test baseline, changed files, dependency graph, framework conventions and dynamic import paths. Required tools: code search, lint, typecheck, test/build.

Workflow: inspect repository conventions and Git changes; find candidates; verify no framework/dynamic use; document before/after scope; remove one bounded unit at a time; retain public contracts; run targeted and full relevant checks.

Output: focused refactor and `docs/REFACTORING_REPORT.md` with confirmed findings.

Verification: lint/typecheck/tests/build pass; no unused dependency is removed while still used elsewhere.

Failure handling: revert only the agent's narrow change if behavior regresses; investigate rather than suppressing diagnostics.

Safety: do not discard user edits, rewrite shared history, or claim code is production-ready from a passing build alone.