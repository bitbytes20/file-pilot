# FilePilot

FilePilot is a **Windows-first, local-first desktop utility** for safe and intelligent personal file management.

## Current implementation state

Tranche D hardens the real scan foundation with:

- real filesystem scanning into SQLite
- recent scan persistence across relaunch
- cancellation and failure-state handling
- structured diagnostics and scan event logging
- resilient desktop E2E scaffolding and CI quality gates

## Project Docs

- Product requirements: [`docs/PRD.md`](docs/PRD.md)
- Architecture blueprint: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- Testing strategy: [`docs/TESTING_STRATEGY.md`](docs/TESTING_STRATEGY.md)
- Packaging/runtime notes: [`docs/PACKAGING.md`](docs/PACKAGING.md)
- Troubleshooting: [`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md)
- Roadmap: [`docs/ROADMAP.md`](docs/ROADMAP.md)
- Implementation tracker: [`docs/IMPLEMENTATION_TRACKER.md`](docs/IMPLEMENTATION_TRACKER.md)
- Contributing guide: [`CONTRIBUTING.md`](CONTRIBUTING.md)
- Security policy: [`SECURITY.md`](SECURITY.md)

## Monorepo Layout

```text
apps/
  desktop/              # Electron main + preload + renderer
packages/
  domain/               # Core domain entities/value objects/interfaces
  application/          # Use cases / orchestration services
  infrastructure/       # FS adapters, DB bootstrap, logging, diagnostics
  ui/                   # Shared UI components and design tokens
  config/               # Shared ESLint/TS/Vitest/Playwright configs
  shared-contracts/     # Typed IPC contracts shared across layers
```

## Getting Started

```bash
pnpm install
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run build
```

## Useful commands

```bash
# Launch the desktop app in dev mode
pnpm --filter @filepilot/desktop run dev

# Run Electron E2E coverage
pnpm run test:e2e

# Build the desktop app bundles
pnpm run build:desktop

# Launch the built desktop app locally
pnpm run smoke:desktop
```

## Runtime notes

- FilePilot stores the scan database in Electron `userData` as `filepilot.sqlite`.
- Structured logs are written under `userData/logs/filepilot.log`.
- Test and isolation helpers are documented in [`docs/PACKAGING.md`](docs/PACKAGING.md).
