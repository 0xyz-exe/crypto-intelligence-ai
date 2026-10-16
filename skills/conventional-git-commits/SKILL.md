---
name: conventional-git-commits
description: "Use when reviewing Git changes or preparing a commit for this repository. Preserve unrelated work and secrets."
version: 1.0.0
license: MIT
platforms: [windows, linux, macos]
metadata:
  hermes:
    tags: [git, workflow, crypto]
---

# Conventional Git workflow

Purpose: review project changes and use conventional commit structure when explicitly authorized.

Inputs: current branch, working-tree status, requested scope and user authorization. Required tools: Git CLI and diff inspection.

Workflow: inspect `git status --short` and branch; review staged and unstaged diff; ensure `.env`, API keys, local data, browser artifacts and downloaded weights are excluded; validate relevant tests; if and only if authorized, write `type(scope): imperative summary`; review staged diff immediately before commit.

Output: change summary, test evidence, and commit hash only if a commit was requested and verified.

Verification: inspect status and exact staged files before and after the action; do not claim commit without Git output.

Failure handling: stop on unexpected branch/worktree state; ask before resolving unrelated or conflicting changes.

Safety: never push, commit, reset, clean, force-update, or rewrite shared history without explicit authorization.