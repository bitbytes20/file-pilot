# FilePilot Architecture Blueprint

## 1) High-Level Architecture

FilePilot uses a **local-first, layered monorepo architecture**:

- **Electron Main Process**: privileged runtime (file system, hashing workers, database, OS integrations).
- **Preload Layer**: secure, typed IPC bridge exposing whitelisted capabilities.
- **Renderer (React)**: UI, state orchestration, user workflows.
- **Domain/Application Packages**: pure business logic and use cases independent of Electron.
- **Infrastructure Package**: platform adapters (filesystem, recycle bin, sqlite, metadata parsers, logging).

## 2) Recommended Monorepo Structure

```text
apps/
  desktop/
    src/main/            # Electron main bootstrapping, windows, IPC handlers
    src/preload/         # Context bridge + IPC clients
    src/renderer/        # React app, routes, views, state
packages/
  domain/                # Entities, value objects, domain services, invariants
  application/           # Use-case services and orchestration pipelines
  infrastructure/        # Adapters: fs, hash, db, recycle-bin, trash, metadata
  ui/                    # Shared design system components
  config/                # Shared eslint/tsconfig/vitest/playwright configs
docs/
  PRD.md
  ARCHITECTURE.md
  ROADMAP.md
  TESTING_STRATEGY.md
```

## 3) Application Layers

1. **Presentation** (React screens + component tests)
2. **Application Services** (commands/queries, transactional flow)
3. **Domain** (rules, entities, policies)
4. **Infrastructure** (Node/OS implementations)
5. **Persistence** (SQLite + indexed tables)

## 4) Electron Responsibilities

### Main Process
- Create windows and lifecycle management.
- Register typed IPC handlers.
- Execute privileged operations (scan traversal, file actions).
- Manage worker threads for hash pipeline.
- Persist index and audit logs.

### Renderer
- User-facing workflows, previews, search/filter UI.
- Never accesses Node APIs directly.
- Calls exposed preload APIs only.

### Preload
- Strict API surface by domain (`scan`, `duplicates`, `search`, `actions`, `settings`).
- Runtime input validation (e.g., zod).
- One-way event channels for progress updates.

## 5) IPC Design Principles

- Use request/response for commands/queries; event stream for long-running progress.
- Versioned IPC contracts.
- Domain-scoped channels, e.g. `scan:start`, `scan:progress`, `duplicates:getGroups`.
- Validate every payload at IPC boundary.
- No generic `invoke('run-anything', ...)` patterns.

## 6) Domain Model Suggestions

- `ScanSession` (id, roots, status, timestamps, stats)
- `IndexedFile` (id, path, size, extension, category, hashState, contentHash)
- `DuplicateGroup` (hash, fileIds, totalBytes, potentialSavings)
- `ActionPlan` (id, operationType, items, dryRunSummary, createdBy)
- `ActionExecution` (id, planId, status, perItemResult)
- `TrashRecord` (id, originalPath, trashPath, deletedAt, sourceType)
- `AuditEvent` (id, actor, command, payloadHash, outcome, timestamp)

## 7) Data & Storage Design

**Primary DB**: SQLite (WAL mode) via a typed ORM/query layer.

Core tables:
- `scan_sessions`
- `files`
- `file_hashes`
- `duplicate_groups`
- `action_plans`
- `action_executions`
- `trash_records`
- `audit_events`
- `settings`
- `feature_flags`

Indexing focus:
- path, extension, category, size, mtime, hash columns.
- composite indexes for common filters.

## 8) Scan / Index / Hash Pipeline

1. **Discovery phase**: recursive traversal and metadata collection.
2. **Candidate grouping**: group by size; singletons excluded from hash stage.
3. **Quick hash (optional)**: first/last N KB for large candidate sets.
4. **Full hash**: stream full file content (BLAKE3 recommended; SHA-256 fallback optional).
5. **Duplicate finalization**: only full-hash matches become duplicate groups.
6. **Persist + notify**: update DB and progress stream.

Pipeline requirements:
- Cancellable jobs.
- Backpressure and worker-pool concurrency limits.
- File-lock/read-error tolerant with explicit status.

## 9) File Operation Safety Design

- All mutations go through `SafeFileOperationService`.
- Two-phase execution:
  1. Plan generation (`dryRun`) with impact summary.
  2. Confirmed apply with per-item result logging.
- Policy defaults:
  - overwrite disabled
  - destructive actions require second confirmation
  - bulk threshold prompts (e.g., >100 files or >10 GB)

## 10) Trash / Recovery Design

- **Local fixed drives**: send deletions to Windows Recycle Bin.
- **External drives**: move to `.filepilot-trash/<timestamp>/<uuid>/...` on source drive.
- Persist `TrashRecord` for each move/delete.
- Keep metadata for future restore path conflict resolution.

## 11) Logging & Diagnostics

- Structured logs (JSONL) with domains and correlation IDs.
- Separate operational logs vs audit logs.
- Redaction rules for sensitive path segments (optional setting).
- Diagnostics bundle includes logs, app version, settings snapshot (excluding secrets).

## 12) Security & Privacy

- Context isolation enabled, nodeIntegration disabled in renderer.
- Strict CSP and URL loading restrictions.
- Signed builds for distribution.
- Local-only by default; telemetry disabled unless explicit opt-in.
- Path sanitization and symlink handling safeguards.

## 13) Extensibility for External Drives and Android

Use a `StorageProvider` interface with capability negotiation:
- `LocalNtfsProvider`
- `ExternalDriveProvider`
- `AndroidMtpProvider` (future)

Provider capabilities example:
- supportsRecycleBin
- supportsAtomicMove
- supportsStreamingHash
- supportsPreviewRead

This avoids hardcoding local-drive assumptions into domain logic.
