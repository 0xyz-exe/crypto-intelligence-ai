# Security audit (initial implementation)

Status: initial review; not a certification. Re-run against final implementation and dependencies.

| Area | Initial finding / control | Residual risk |
|---|---|---|
| Secret exposure | App key is optional server-only env; never copy Hermes credentials | Must inspect production client bundle and deployment env setup |
| SSRF | Fixed provider host and allowlisted symbols/intervals | Verify all routes retain allowlist; no proxy URL input |
| Input validation | Zod validation required for query and provider output | Invalid data still possible; fail closed |
| XSS | Render external/model strings as text, no HTML injection | Review all rendering paths |
| Abuse/resource exhaustion | Finite request timeout, response cap, fixed symbols, bounded counts/retries | Public endpoints can still be abused via app route; deployment-level rate limits may be required |
| Cache isolation | Public market DTO only; no secrets/user data | Confirm cache keys and framework caching behavior |
| CSRF/auth | No account or state-changing server endpoint in MVP | Watchlist is client-local |
| AI cost | Explicit :free model only; no paid fallback and request/output bounds | Free model behavior and API terms may change |
| Dependency audit | Initial scaffold `npm audit` found 5 high vulnerabilities via `eslint-config-next` → `fast-glob` → `micromatch` → `braces`. The available fix required a breaking downgrade. Removed the vulnerable Next ESLint preset rather than force-updating; replaced it with `typescript-eslint`. Follow-up `npm audit --audit-level=high` and `npm audit --omit=dev --audit-level=high` both report 0 vulnerabilities. Next build and TypeScript checks remain enabled; Next-specific ESLint plugin rules are not configured pending patched upstream dependencies. | Reassess the Next lint preset once its dependency chain is patched |

## Follow-up verification

- Check browser-visible output for API key sentinel/non-disclosure.
- Test invalid query values, oversized model request, provider timeout and invalid JSON.
- Re-run full `npm audit` after compatible dependency remediation.
