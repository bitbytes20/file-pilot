# Contributing to FilePilot

Thanks for contributing.

## Development Principles

- Safety-first behavior for all file operations.
- Local-first and privacy-preserving defaults.
- Strong typing and explicit domain boundaries.
- Test before merge.

## Workflow

1. Create an issue (or pick one from roadmap).
2. Open a branch with descriptive name.
3. Implement with tests.
4. Run checks locally.
5. Open PR using template.

## Required Checks

- `pnpm run lint`
- `pnpm run typecheck`
- `pnpm run test`

## Commit Style

Use conventional commits where possible:
- `feat:`
- `fix:`
- `docs:`
- `refactor:`
- `test:`
- `chore:`

## Safety Expectations

Changes affecting delete/move logic must include:
- dry-run behavior coverage
- failure mode assertions
- audit event assertions
