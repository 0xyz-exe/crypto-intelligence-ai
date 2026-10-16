---
name: debug-root-cause
description: "Use when a build, API, numerical test, or UI interaction fails. Reproduce, isolate, correct, and verify the cause."
version: 1.0.0
license: MIT
platforms: [windows, linux, macos]
metadata:
  hermes:
    tags: [debugging, root-cause, crypto]
---

# Debug root cause

Purpose: repair a reproducible failure without hiding it or broadening unrelated changes.

Inputs: exact error/output, command, changed code, environment and expected behavior. Required tools: file inspection and relevant test/build tools.

Workflow: reproduce once; capture complete diagnostic and surrounding code; identify the smallest failing boundary; state a falsifiable hypothesis; test it; make a focused correction; add regression coverage; run affected checks and broader verification when practical.

Output: concise cause, changed paths, actual test results and unresolved limitations.

Verification: the failing case now passes and adjacent behavior remains covered; review diff for accidental scope expansion.

Failure handling: if environment/dependency is the cause, preserve logs and clearly mark blocked; do not retry unchanged operations.

Safety: inspect Git state first; never destroy user data, weaken tests, suppress errors, or claim unrun checks passed.