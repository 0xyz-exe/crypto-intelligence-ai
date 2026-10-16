# Git workflow

- Initial repository was created automatically by `create-next-app` in the new, previously absent project directory; active branch is `main`.
- Preserve the generated repository and avoid reset/clean/rebase. Never commit/push without explicit authorization.
- Before and after changes: `git status --short`, `git diff --check`, inspect `git diff`.
- Use Conventional Commit prefixes if the user later asks to commit.
- Never stage `.env`, secrets, personal data, model weights, or `node_modules`.
