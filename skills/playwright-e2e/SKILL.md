---
name: playwright-e2e
description: "Use when adding or running browser tests for the dashboard. Assert real user behavior using stable accessible locators."
version: 1.0.0
license: MIT
platforms: [windows, linux, macos]
metadata:
  hermes:
    tags: [playwright, e2e, crypto]
---

# Playwright E2E

Purpose: verify critical user journeys in the running local application.

Inputs: acceptance criteria, app URL/start command, explicit demo mode and relevant viewport. Required tools: project-local Playwright browser and test runner.

Workflow: run against isolated deterministic demo data; locate controls by role/name/label; assert dashboard render, demo label, asset filtering, chart timeframe, watchlist persistence, deterministic AI state, provider error recovery and mobile width; use explicit waiting/locator conditions; check browser console and exposed browser assets when secret boundaries change.

Output: deterministic spec, exact run command and actual pass/fail report.

Verification: execute `npm run test:e2e`; test must not depend on paid AI or live market API, and retries/sleeps must not mask flakiness.

Failure handling: preserve full trace/error context, isolate setup versus app failure, repair root cause, rerun affected tests.

Safety: do not hit production or authenticated data; never place keys in fixtures, traces or page code.