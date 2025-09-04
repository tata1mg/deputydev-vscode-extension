# Contributing to DeputyDev (VS Code Extension)

Thanks for your interest in improving DeputyDev! This guide explains the project layout, local setup, development workflows, code style, and how to submit changes.

If you’re new to VS Code extension development or to this codebase, start with the README and in-repo comments. The previous docs/ pages have been removed.


## Project layout (quick tour)

- src/ — Extension backend (activation, commands, services, WebSocket/HTTP clients, diff/code-review managers, etc.)
  - extension.ts — Extension entry point (activation/deactivation, command registrations)
  - panels/ — Webview backend classes (panel lifecycle, message wiring)
  - services/, clients/, utilities/, terminal/, diff/, codeReview*/ — Core feature modules
- webviews/ — React + Vite webview UIs (self-contained projects)
  - webviews/sidebar — Main sidebar UI (has its own package.json, lint config, etc.)
  - webviews/changeProposer — Custom editor UI used by the change proposer
- out/ — Built extension output (generated)
- docs/ — Additional developer documentation (removed)
- esbuild.js — Extension bundler config (esbuild)
- .env.example — Example environment variables; copy to .env for local dev

Important: The extension version is defined in two places and must stay in sync when you bump versions:
- package.json → version
- src/config.ts → CLIENT_VERSION


## Prerequisites

- VS Code ≥ 1.93.0
- Node.js ≥ 18 (esbuild target is node18)
- Yarn installed (classic is fine)

Optional tools
- Git (for standard contribution flow)
- A modern browser (for running the sidebar UI dev server)


## Environment configuration

Copy .env.example to .env at the repo root and adjust as needed:

- DD_HOST: Backend host (defaults to http://localhost:8084 via esbuild define)
- ENABLE_OUTPUT_CHANNEL: "true" to show the DeputyDev output channel with debug logs
- USE_LOCAL_BINARY: "true" to use a locally running binary instead of auto-managed one
- LOCAL_BINARY_PORT: Port of the local binary (default 8001)

Notes
- When USE_LOCAL_BINARY !== "true", the extension manages downloading/starting the binary via ServerManager.
- MCP configuration file path is fixed at ~/.deputydev/mcp_settings.json.


## Install and build

1) Install all dependencies (root + webviews):
- yarn install:all

2) Build the entire package

- One-off build:
  - yarn build:all
  - Press F5 (Run Extension) / Select Run extension from debug menu


## Code style and quality

TypeScript configuration
- Strict mode is enabled in tsconfig.json for the extension code.

Linting & formatting (root)
- Lint: yarn lint
- Lint (fix): yarn lint:fix
- Format: yarn format

Webviews (sidebar)
- Lint: yarn lint:webviews:sidebar
- Lint (fix): yarn lint:fix:webviews:sidebar
- Format: yarn format:webviews:sidebar

Husky
- Husky is configured (installed via the prepare script). Pre-commit hooks may run lint/format checks. If you add or change hooks, keep them fast and deterministic.

General guidelines
- Prefer small, focused PRs.
- Keep modules cohesive and reusable; avoid cross-cutting changes.
- Maintain clear error handling and logging (see utilities/Logger, Singleton-logger, outputChannelFlag).
- When touching message passing to/from webviews, ensure type safety and backward compatibility.
- Document visible behavior changes in README.md.


## Working on extension functionality

- Commands, menus, keybindings: Add to contributes in package.json (commands, menus, keybindings) and register handlers in src/extension.ts.
- Websocket/HTTP integrations: Prefer adding endpoints via clients/ and handler middlewares (see src/clients/* and handlerMiddlewares/*).
- Webviews: Backend logic lives in src/panels/* and corresponding React UIs live in webviews/*.
- Diff and change proposer: See src/diff/* and src/diff/viewers/deputydevChangeProposer/*; the custom editor viewType is deputydev.changeProposer.
- Code review: See src/codeReview*, src/codeReviewManager, and Review/Comment services and menus in package.json.

When adding new configuration keys or env vars
- Reflect defaults in esbuild.js define (so they’re available in the compiled bundle)
- Update .env.example and README.md accordingly


## Running and debugging

- Launch Extension Development Host: F5 in VS Code
- View extension logs: DeputyDev output channel (enable via ENABLE_OUTPUT_CHANNEL=true)
- Toggle the sidebar views via commands in the activity bar (DeputyDev icon)

Local binary vs managed binary
- USE_LOCAL_BINARY=true → extension connects to ws/http at ws://127.0.0.1:PORT and http://127.0.0.1:PORT (PORT from LOCAL_BINARY_PORT)
- Otherwise the extension downloads/starts the binary in the background (see ServerManager and BackgroundPinger)


## Submitting changes

1) Fork-based workflow (default; non-maintainers)
- Non-maintainers cannot create branches on the upstream repository.
- Fork this repository to your GitHub account.
- In your fork, create a branch using the same conventions: feat/…, fix/…, chore/…, docs/…
- Push to your fork and open a Pull Request against the upstream default branch (usually main). If unsure, target main.
- Enable "Allow edits by maintainers" on the PR.

2) Maintainers-only workflow (optional)
- Maintainers may create branches directly in the upstream repository.
- Branch naming: feat/…, fix/…, chore/…, docs/…

3) Ensure quality gates pass
- Build succeeds (yarn build:all) or dev watch compiles cleanly.
- Lint/format pass (yarn lint, yarn lint:fix, yarn format).
- No TypeScript errors.
- Pre-commit hooks pass (Husky).
- Update README.md and .env.example if you introduce user-visible changes or configuration.
- Add tests or usage notes for behavioral changes.
- UI changes: add screenshots/GIFs to the PR description.

4) Commit messages
- Prefer clear, conventional-style messages (feat:, fix:, chore:, docs:, refactor:).

5) Open a Pull Request
- Describe the motivation, what changed, and how you validated it.
- Link related issues.
- Avoid bumping the version; maintainers handle releases


## Versioning and release notes

- Keep package.json version and src/config.ts CLIENT_VERSION in sync when bumping versions.
- Add or update user-facing notes in README.md as appropriate.
- Packaging/publishing steps may be handled by maintainers (VSIX artifacts exist in the repo); coordinate in the PR if you need a preview build.


## Security and privacy

- Never commit secrets. Use .env locally and update .env.example (without secrets) when introducing new variables.
- Be mindful of logs; avoid leaking tokens or PII in outputChannel or console logs.


## Code of Conduct

See CODE_OF_CONDUCT.md at the repository root.


## Troubleshooting

- Node version errors: Ensure Node ≥ 18.
- Webview doesn’t update inside the Extension Host: Rebuild the relevant webview (e.g., yarn build:webviews:sidebar) or keep watch running (yarn watch:all).
- Binary connectivity issues: If USE_LOCAL_BINARY=true, ensure the binary is listening on LOCAL_BINARY_PORT; otherwise let the extension manage it.
- VS Code API types: Ensure @types/vscode matches package.json engines.vscode (already aligned at 1.93.0).


## Questions?

Open an issue or start a discussion in the repository. Thanks again for contributing to DeputyDev!