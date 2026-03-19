# FilePilot Architecture Blueprint

## 1) High-Level Architecture

FilePilot uses a **local-first, layered monorepo architecture**:

- **Electron Main Process**: privileged runtime (filesystem traversal, SQLite bootstrap, OS integration, structured logging).
- **Preload Layer**: secure, typed IPC bridge exposing whitelisted capabilities only.
- **Renderer**: UI state, workflow orchestration, recent scan visibility, progress, diagnostics, and failure presentation.
- **Domain/Application Packages**: pure business logic and orchestration independent of Electron.
- **Infrastructure Package**: scanner, repositories, filesystem handling, database bootstrap, and logging interfaces.

## 2) Layer Responsibilities

### `packages/domain`

- scan/job/file/event types
- category inference and pure rules

### `packages/application`

- scan coordination
- stale job recovery orchestration on app restart
- query/list flows for jobs, files, and diagnostic events

### `packages/infrastructure`

- SQLite bootstrap and schema setup
- scan job/file/event repositories
- memory-safe breadth-first traversal
- filesystem error classification and warning recording
- structured logger contract used by Electron wiring

### `packages/shared-contracts`

- typed IPC channel names
- request/response/event DTOs
- boundary parsers for jobs, files, and scan diagnostics

### `apps/desktop/main`

- BrowserWindow creation
- secure session/navigation defaults
- typed IPC handler registration
- userData/database/log path wiring
- runtime initialization logging

### `apps/desktop/preload`

- narrow `window.filePilot` API only
- renderer-safe event subscription helpers
- no raw `ipcRenderer` exposure

### `apps/desktop/renderer`

- progress/status UI
- clear completed/cancelled/failed state rendering
- diagnostics event list for scan warnings and failures
- test selectors for resilient Electron E2E coverage

## 3) Tranche D Runtime Hardening

Tranche D focuses on making the Tranche C scan pipeline reliable before duplicate hashing is added.

Implemented hardening themes:

- **Stale in-progress recovery**: pending/running jobs are marked failed on restart.
- **Failure visibility**: scan failures, cancellation, and warnings are persisted and shown in the UI.
- **Operational logging**: database bootstrap, scan lifecycle, filesystem warnings, and desktop startup are written to structured logs.
- **Performance guardrails**: the scanner walks incrementally instead of materializing the entire file tree up front, throttles progress updates, and yields periodically to reduce UI starvation risk.
- **Packaged-runtime awareness**: SQLite initialization is deferred so unsupported runtimes fail with a clear message instead of crashing on import.

## 4) Security Invariants

- `contextIsolation: true`
- `nodeIntegration: false`
- preload-only renderer access
- no generic raw IPC bridge
- navigation locked to trusted origins
- permissions denied by default
- strict CSP applied to the renderer shell

## 5) Scan Lifecycle Model

1. Renderer selects a root folder through the typed preload API.
2. Main process boots or reuses the scan runtime and database.
3. Application layer starts a scan controller.
4. Infrastructure traverses the tree breadth-first and records files/events incrementally.
5. Progress/completion events stream back to the renderer.
6. Renderer refreshes metrics, file results, and diagnostics.
7. On restart, stale pending/running jobs are marked failed before new work starts.

## 6) Known Tranche D Constraints

- SQLite currently depends on `node:sqlite` support in the runtime.
- Installer/signing work is intentionally deferred.
- Duplicate detection has not started yet; Tranche D only hardens scan foundation behavior.
