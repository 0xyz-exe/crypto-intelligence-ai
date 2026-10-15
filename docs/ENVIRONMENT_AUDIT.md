# Environment audit

**Audited:** 2026-10-16 (Windows local session)

## Verified environment

| Tool / fact | Result |
|---|---|
| Working directory | `C:\Users\wondr\crypto-intelligence-ai` |
| OS | Windows 11 Home Single Language, build 10.0.26200 |
| PowerShell | 5.1.26100.9711 |
| Node.js | v26.7.0 |
| npm | 11.19.0 |
| Git | 2.53.0.windows.3 |
| Python | 3.14.7 |
| pnpm / uv | Not installed; npm is available |
| Hermes | 0.21.5+7525.g56f7986; `hermes --help`, `hermes model --help`, and `hermes skills --help` work |
| Disk | C: reports ~378 GB available via `df`; PowerShell confirms ~405.9 GB free |
| Memory | Windows reports ~16.5 GB total visible and ~6.9 GB free at audit time |
| Ollama | Command is present but reports it cannot connect to a running instance; no model downloaded or runtime installed by this task |
| Playwright CLI | `playwright-cli` is not globally available; `npx` is available. Hermes desktop browser tools are available for manual browser checks |
| Target repository | Newly created empty directory; not previously a Git repository |

## Platform constraints and decisions

- Commands in this session run through bash/MSYS; native Windows checks use `powershell.exe`.
- Use npm and a current Next.js App Router stack. Node 26 is installed; verify actual framework/build compatibility in the scaffold before adopting the stack.
- Use local deterministic fixtures as an explicit demo mode. Live market data can be obtained from public Binance Spot market-data endpoints without credentials; endpoint access/availability and regional access may vary. Never describe it as guaranteed real time or silently substitute fixtures.
- No Hermes configuration, credentials, model choice, memories, or skills were read or changed. The app's AI key must be separately supplied as `OPENROUTER_API_KEY` and never copied from Hermes.
- Browser tooling is present via the desktop browser interface. The Playwright command-line package is not preinstalled; adding a test dependency will be considered only if needed and must be documented.

## Cost / approval

- No paid service, account, subscription, model, or API key is required for the deterministic MVP.
- Do not download local model weights. Ollama is not running and no installed-model list was retrieved.
- No paid hosting or telemetry is part of the MVP. Hosting live application costs are not assumed to be Rp0.
- npm dependencies are open-source software installs; no paid service activation is involved.

## Initial tool capability checks

- PASS: terminal, filesystem, Git, npm, Python, Hermes CLI/help.
- PASS: working directory create/write access.
- BLOCKED: Ollama local endpoint; daemon unavailable.
- NOT RUN: Playwright CLI E2E; CLI package not installed yet.
- NOT RUN: browser automation check against the app (app not yet scaffolded).

## Selected strategy

Build the minimal Next.js + TypeScript App Router application with npm. Keep public market-data access server-side, validate responses at runtime, provide only explicit demo fixtures as fallback mode, calculate indicators locally and deterministically, and leave AI optional with a provider unavailable state when no app-owned key is configured. Reassess the exact framework version, public market API behavior, and current provider terms before integration.
