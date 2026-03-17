# FilePilot Product Requirements Document (PRD)

## 1) Product Vision

FilePilot is a safety-first desktop utility that helps users understand, clean, and reorganize personal files without accidental data loss. It is built for users who need confidence and control when handling large, messy file collections.

## 2) Problem Statement

Users accumulate duplicate, scattered, and poorly organized files across internal and external drives. Existing tools are often risky (destructive operations), incomplete (weak duplicate logic), or opaque (limited previews and auditability). Users need a local-first tool that delivers accurate analysis and safe action workflows.

## 3) Goals

1. Provide fast, on-demand scanning of selected folders and drives.
2. Detect exact duplicates based on content hash (not names).
3. Enable safe bulk actions through preview, confirmation, and reversible defaults.
4. Offer advanced filtering/search for targeted cleanup.
5. Maintain an auditable history of file operations.

## 4) Non-Goals (v1)

- Real-time background indexing by default.
- Cloud sync, cloud analytics, or server-side processing.
- Full automatic “one-click cleanup” with destructive defaults.
- Cross-platform parity (v1 is Windows-only).
- Android device scanning implementation (only architecture hook in v1).

## 5) Target Users

- Personal power users with large media/document collections.
- Creators and professionals managing many versions of files.
- Users cleaning old drives or merging backups.

## 6) Core Use Cases

1. **Duplicate review**: Scan a folder tree, review duplicate groups, keep one copy, and safely delete/move others.
2. **Targeted cleanup**: Filter large files, old files, or category-specific clutter and apply safe actions.
3. **Organization pass**: Move mixed folders into category destinations with preview and conflict handling.
4. **Audit & rollback support**: Review action history for future recovery and traceability.

## 7) Functional Requirements

### 7.1 Scan Management
- User can initiate scan on selected roots (folder/drive).
- Recursive traversal with progress visibility and cancellation.
- Persist scan sessions and metadata snapshots.

### 7.2 File Index
- Store per-file metadata: path, name, extension, size, timestamps, category, hash status.
- Index supports query/search/filter across scanned datasets.

### 7.3 Duplicate Detection
- Final duplicate grouping requires identical full-content hash.
- Allow staged pipeline for performance:
  1) group by size,
  2) optional quick partial hash,
  3) full hash for final classification.
- Duplicates can have different names/paths.

### 7.4 Preview & Details
- Preview pane for common image/text/audio/video/document formats where practical.
- Details panel shows metadata, duplicate group info, and proposed action impact.

### 7.5 Search & Filters
- Search by filename/path tokens.
- Filters: category, extension, size range, modified date, hash status, duplicate-only.
- Sort by size, date, name, path depth.

### 7.6 Organization Actions
- Bulk move by category rules with conflict policies (skip, rename, overwrite-disabled by default).
- Preview of action plan before apply.

### 7.7 Safe Delete / Trash
- Local Windows drive deletion uses Recycle Bin APIs.
- External drive deletion moves file to app-managed trash location.
- Permanent deletion opt-in with explicit warning.

### 7.8 Audit / Diagnostics
- Every mutation action logs intent, input selection, result status, and errors.
- Exportable diagnostics bundle for issue reporting.

### 7.9 Settings / Preferences
- Theme (light/dark/system), scan defaults, hash throttling, exclusion patterns.
- Feature flags and experimental toggles.

## 8) Non-Functional Requirements

- **Reliability**: No silent destructive behavior.
- **Performance**: Efficient traversal and staged hashing for large datasets.
- **Privacy**: Local-only processing by default; no telemetry unless explicitly enabled.
- **Maintainability**: Modular architecture with typed domain boundaries.
- **Testability**: Deterministic file-operation abstraction and fixture-based integration tests.

## 9) Safety Requirements (Mandatory)

1. Preview before apply for all bulk operations.
2. Confirmation dialogs for destructive or high-impact actions.
3. Trash-first default behavior.
4. Human-readable summary of planned effects before execution.
5. Structured operation logs for audit and future recovery.

## 10) v1 Scope

- Windows-first app shell (Electron + React + TypeScript).
- On-demand recursive scan.
- Exact duplicate detection pipeline (size -> optional quick hash -> full hash).
- Duplicate review UI with selection assistance.
- Safe move/delete workflows.
- Search/filter panel and details pane.
- Audit history and diagnostics basics.

## 11) Post-v1 Roadmap Ideas

- Optional background indexing mode.
- Android MTP integration and external drive enhancements.
- Recovery assistant for app-managed trash and operation rollback helpers.
- Rule-based auto-organization (safe simulation mode first).
- Plugin/extension points for metadata extractors.

## 12) Risks and Mitigations

- **Risk**: Accidental data loss.
  - **Mitigation**: Trash-first, confirmations, dry-run previews, immutable audit logs.
- **Risk**: Slow hashing on large files.
  - **Mitigation**: staged hashing, worker pool, cancellation support.
- **Risk**: External/MTP inconsistencies.
  - **Mitigation**: adapter abstraction with capability flags and strict fallbacks.
- **Risk**: Complex UX for bulk actions.
  - **Mitigation**: action explainers, progressive disclosure, default-safe options.

## 13) Success Criteria

- Duplicate detection precision: no false duplicate groupings when full hashes differ.
- High operation safety: no known destructive defaults.
- Scan reliability on large personal datasets.
- Users can complete duplicate cleanup and organization tasks with clear confidence.
