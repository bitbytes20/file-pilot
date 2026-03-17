# FilePilot GitHub Roadmap (Epics -> Stories -> Tasks)

## Sequencing Overview

1. Foundation & Governance
2. Core Architecture & IPC
3. Scan + Indexing
4. Duplicate Detection
5. Search/Filter + Review UX
6. Safe Actions + Trash
7. Audit/Diagnostics
8. Stabilization + Release

---

## Epic 1: Repository Foundation & Contributor Experience

### Story 1.1: Initialize monorepo tooling
- Task: Create workspace root (`pnpm`, `turbo`, base TypeScript configs).
- Task: Add lint/format/test scripts.
- Task: Add package conventions and naming strategy.

### Story 1.2: Documentation baseline
- Task: Add PRD, architecture blueprint, roadmap, testing strategy.
- Task: Add CONTRIBUTING and SECURITY docs.
- Task: Add architecture decision record (ADR) template.

### Story 1.3: GitHub governance
- Task: Add issue templates (bug, feature, task).
- Task: Add PR template and required checklist.
- Task: Add CI workflow with lint/type/test gates.

Dependencies: none.

---

## Epic 2: Desktop Shell and Secure IPC Baseline

### Story 2.1: Electron shell setup
- Task: Create `apps/desktop` with main/preload/renderer structure.
- Task: Enforce secure BrowserWindow defaults.
- Task: Add window lifecycle and app boot logging.

### Story 2.2: Typed IPC framework
- Task: Define domain channel contracts.
- Task: Add zod runtime validation at boundary.
- Task: Add request tracing/correlation IDs.

### Story 2.3: Feature flags and settings skeleton
- Task: Define settings schema.
- Task: Add local persistence and defaults.
- Task: Gate unfinished features behind flags.

Dependencies: Epic 1.

---

## Epic 3: Scan Management and File Index

### Story 3.1: Recursive scan engine
- Task: Implement scanner service with cancellation token.
- Task: Add ignore/exclusion support.
- Task: Emit progress events.

### Story 3.2: Index persistence
- Task: SQLite schema for sessions/files/hash status.
- Task: Upsert logic for file records.
- Task: Add query layer for renderer needs.

### Story 3.3: Metadata extraction
- Task: Basic metadata extraction (size/timestamps/extension/category).
- Task: Optional media/doc metadata adapters.

Dependencies: Epic 2.

---

## Epic 4: Exact Duplicate Detection

### Story 4.1: Hash pipeline
- Task: Candidate grouping by size.
- Task: Quick-hash stage for large groups.
- Task: Full hash stage and persistence.

### Story 4.2: Duplicate group service
- Task: Generate groups from final full hashes.
- Task: Compute potential space savings.
- Task: Add API contract for duplicate views.

### Story 4.3: Reliability tests
- Task: Fixture set with renamed copies, same-size different-content files.
- Task: Integration tests ensuring only full-hash matches group.

Dependencies: Epic 3.

---

## Epic 5: Search, Filters, and Review UX

### Story 5.1: Query/filter backend
- Task: Query builder for text + facet filters.
- Task: Sort/pagination.
- Task: Performance indexes.

### Story 5.2: Duplicate review UI
- Task: Group list with selection helpers.
- Task: Preview pane + metadata details panel.
- Task: Safety cues (badges, impact summaries).

### Story 5.3: Theme and UX polish
- Task: Light/dark themes.
- Task: Keyboard support and accessibility basics.

Dependencies: Epics 3-4.

---

## Epic 6: Safe Organization and Deletion Flows

### Story 6.1: Action planning framework
- Task: Dry-run planner for move/delete operations.
- Task: Human-readable impact summary.
- Task: Confirmation modal integration.

### Story 6.2: Trash-first deletion
- Task: Windows recycle bin adapter.
- Task: External-drive app-managed trash adapter.
- Task: `TrashRecord` persistence.

### Story 6.3: Category organization
- Task: Rule-based destination mapping.
- Task: Conflict policies (skip/rename default-safe).
- Task: Batch execution with rollback metadata.

Dependencies: Epics 3-5.

---

## Epic 7: Audit, Diagnostics, and Recovery Foundation

### Story 7.1: Audit event model
- Task: Persist immutable audit events for all mutation commands.
- Task: Correlate events with plans and execution IDs.

### Story 7.2: Diagnostics bundle
- Task: Export logs + system/app metadata.
- Task: Add user-facing diagnostics action.

### Story 7.3: Recovery-oriented data model
- Task: Extend trash metadata for restore feasibility.
- Task: Add restore simulation APIs (no UI finalize yet).

Dependencies: Epic 6.

---

## Epic 8: Quality, Packaging, and v1 Release

### Story 8.1: Comprehensive test matrix
- Task: Unit/component/integration/e2e coverage thresholds.
- Task: File-operation regression suite in CI.

### Story 8.2: Packaging and signing
- Task: Windows installer pipeline.
- Task: Code-signing integration.

### Story 8.3: v1 hardening
- Task: Performance profiling on large fixture sets.
- Task: Bug bash and release checklist.

Dependencies: Epics 1-7.
