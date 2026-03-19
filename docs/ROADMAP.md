# FilePilot GitHub Roadmap (Epics -> Stories -> Tasks)

## Current tranche status

- ✅ Tranche A: tooling baseline and monorepo foundation
- ✅ Tranche B: secure preload bridge and typed IPC shell
- ✅ Tranche C: real scan pipeline, SQLite persistence, recent scans, progress UI
- ✅ Tranche D: hardened scan foundation, diagnostics, restart recovery, build/test wiring, Electron E2E harness
- ⏭️ Next tranche: duplicate detection foundation

## Immediate next tranche entry point

The next major implementation tranche should start with **exact duplicate detection foundation**:

1. content hashing strategy and worker model
2. hash persistence schema
3. candidate grouping by size
4. full-hash exact duplicate grouping
5. duplicate results UI and safety-first review flow

## Sequencing Overview

1. Foundation & Governance
2. Core Architecture & IPC
3. Scan + Indexing
4. Duplicate Detection Foundation
5. Search/Filter + Review UX
6. Safe Actions + Trash
7. Audit/Diagnostics
8. Stabilization + Release
