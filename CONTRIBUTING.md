# Contributing to FilePilot

Thanks for contributing.

## Development Principles

- Safety-first behavior for all file operations.
- Local-first and privacy-preserving defaults.
- Strong typing and explicit domain boundaries.
- Test and document changes before merge.

## Local workflow

1. Create or pick a roadmap/task issue.
2. Make the smallest safe change that satisfies the tranche goal.
3. Run the required checks.
4. Update docs when behavior, build flow, or troubleshooting changes.
5. Update `docs/IMPLEMENTATION_TRACKER.md` before committing.

## Required checks

- `pnpm run lint`
- `pnpm run typecheck`
- `pnpm run test`
- `pnpm run build`
- `pnpm run test:e2e` when the environment can launch Electron

## Desktop-specific test helpers

For deterministic local/E2E validation, the desktop app recognizes these environment overrides:

- `FILEPILOT_USER_DATA_DIR`
- `FILEPILOT_LOG_DIR`
- `FILEPILOT_TEST_SELECTED_FOLDER`

These are intended for test harnesses and isolated validation runs, not general product behavior.

## Commit Style

Use conventional commits where possible:

- `feat:`
- `fix:`
- `docs:`
- `refactor:`
- `test:`
- `chore:`

## Implementation Tracker (Required)

- Every commit must include an update to `docs/IMPLEMENTATION_TRACKER.md`.
- Add one new entry per commit at the top of `## Commit Entries`.
- Include date, short hash (or `pending` before commit), commit subject, implemented scope, and affected areas.
- If `pending` is used, replace it with the actual short hash before finishing the work.

## Safety Expectations

Changes affecting scan, move, or delete logic must include:

- explicit failure-mode handling
- non-crashing behavior assertions where practical
- user-visible state clarity for completion, cancellation, and failure
- diagnostics/logging updates when operational behavior changes
