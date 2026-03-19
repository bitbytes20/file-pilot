# FilePilot Testing Strategy

## Tranche D Test Matrix

FilePilot now uses a pragmatic split:

- **Unit + integration**: Node test runner for application, infrastructure, shared IPC contracts, and desktop renderer helpers.
- **Static quality gates**: ESLint + TypeScript project-reference builds across the monorepo.
- **Desktop E2E**: Playwright Electron coverage for launch, real scan, cancellation, failure handling, and relaunch persistence.
- **Windows build verification**: CI build-only validation on `windows-latest`.

## Covered Critical Paths

### Infrastructure / application

- real directory scan persistence
- cancellation handling
- stale running job recovery after restart
- missing-root failure handling
- symlink skip behavior
- event repository persistence

### Shared contracts

- request parsing
- positive-integer limit validation
- event DTO parsing to catch IPC drift early

### Desktop renderer helpers

- byte formatting
- file table markup
- diagnostics markup

### Electron E2E intent

The Playwright suite targets:

- app launch smoke
- select folder → start real scan → inspect results
- cancel scan mid-run
- inaccessible/missing path failure state
- relaunch persistence sanity

## E2E Design Notes

The suite uses a test-only environment override for folder selection:

- `FILEPILOT_TEST_SELECTED_FOLDER`

This keeps the production renderer and preload surface secure while still allowing deterministic automation of the folder-selection flow.

Additional isolated runtime overrides:

- `FILEPILOT_USER_DATA_DIR`
- `FILEPILOT_LOG_DIR`

## CI Gates

Primary CI gates now include:

- `pnpm run lint`
- `pnpm run typecheck`
- `pnpm run test`
- `pnpm run build`
- `pnpm run test:e2e` on Linux where Electron runtime dependencies are available
- `pnpm run build:desktop` on Windows

## Environment Caveat

Electron E2E depends on native desktop libraries. If Electron cannot launch in the current environment, treat that as an environment limitation and verify:

- lint
- typecheck
- unit/integration tests
- production build output

before diagnosing application logic.
