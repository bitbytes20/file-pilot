# FilePilot

FilePilot is a **Windows-first, local-first desktop utility** for safe and intelligent personal file management.

## What FilePilot Will Do

- Scan folders and drives on demand
- Detect exact duplicates by **content hash**
- Preview files before actions
- Search and filter with advanced controls
- Reorganize files by categories (documents, music, photos, videos, archives, other)
- Apply safe actions with confirmations, trash-first behavior, and operation audit logs

## Tech Stack

- Electron
- React
- TypeScript
- Monorepo with `pnpm` workspaces + Turborepo

## Project Docs

- Product requirements: [`docs/PRD.md`](docs/PRD.md)
- Architecture blueprint: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- Roadmap (epics/stories/tasks): [`docs/ROADMAP.md`](docs/ROADMAP.md)
- Testing strategy: [`docs/TESTING_STRATEGY.md`](docs/TESTING_STRATEGY.md)
- Implementation tracker: [`docs/IMPLEMENTATION_TRACKER.md`](docs/IMPLEMENTATION_TRACKER.md)
- Contributing guide: [`CONTRIBUTING.md`](CONTRIBUTING.md)
- Security policy: [`SECURITY.md`](SECURITY.md)

## Monorepo Layout

```text
apps/
  desktop/              # Electron main + preload + React renderer
packages/
  domain/               # Core domain entities/value objects/interfaces
  application/          # Use cases / orchestration services
  infrastructure/       # FS adapters, hashing, DB, logging, diagnostics
  ui/                   # Shared UI components and design tokens
  config/               # Shared ESLint, TS, Vitest, Playwright configs
```

## Getting Started

```bash
pnpm install
pnpm run lint
pnpm run typecheck
pnpm run test

# Start the desktop shell (builds TypeScript and launches Electron)
pnpm run dev --filter @filepilot/desktop
```

### Workspace Layout

```text
apps/
  desktop/              # Electron main/preload/renderer workspace
packages/
  domain/               # Domain models and invariants
  application/          # Use cases and orchestration policies
  infrastructure/       # Platform adapters (fs, db, hashing)
  ui/                   # Shared UI primitives/tokens
  shared-contracts/     # IPC contracts shared across layers
  config/               # ESLint/Prettier/Vitest/Playwright configs
```

Each package is a TypeScript project reference so `tsc -b` builds the graph in dependency order. Use `pnpm --filter <package> <script>` to target a specific workspace (e.g., `pnpm --filter @filepilot/domain test`).
