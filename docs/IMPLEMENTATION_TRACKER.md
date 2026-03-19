# Implementation Tracker

This file tracks what is implemented in every commit.

## Update Rules

1. Add one new entry at the top of `## Commit Entries` for each commit.
2. Keep entries implementation-focused and limited to what the commit actually changed.
3. If behavior did not change, state that explicitly.
4. If the commit hash is not known yet, use `pending` and replace it after committing.

## Helper Command

Generate a new top entry skeleton:

```bash
corepack pnpm run tracker:entry -- --subject "feat: short commit subject"
```

Optional flags:

- `--dry-run` (print entry without writing)
- `--date YYYY-MM-DD`
- `--hash <short-hash-or-pending>`

## Entry Template

```md
### [YYYY-MM-DD] <short-hash> <type>: <subject>

- Implemented:
  - ...
- Affected areas:
  - ...
- Notes:
  - ...
```

## Commit Entries

### [2026-03-19] 29d6850 feat: harden tranche d scan foundation

- Implemented:
  - Hardened the scan pipeline with stale-job recovery, structured logging, persisted scan diagnostics, incremental traversal, throttled progress updates, and clearer failure/cancel terminal states.
  - Expanded the desktop shell with diagnostics UI, resilient status handling, isolated test overrides, and typed scan-event IPC support.
  - Added Node-runner integration coverage plus Playwright Electron smoke/e2e scaffolding for launch, scan, cancel, failure, and relaunch persistence flows.
  - Strengthened repo quality gates and documentation with CI job splits, Windows desktop build verification, packaging/runtime notes, and troubleshooting guidance.
- Affected areas:
  - `packages/application`
  - `packages/infrastructure`
  - `packages/shared-contracts`
  - `apps/desktop`
  - `.github/workflows/ci.yml`
  - `docs/*`
  - `README.md`
  - `CONTRIBUTING.md`
- Notes:
  - Electron E2E execution in this container is limited by missing desktop runtime launch support; the suite is wired and ready for CI/desktop-capable environments.

### [2026-03-18] pending fix: align eslint workspace import resolution

- Implemented:
  - Updated the shared ESLint config to resolve TypeScript projects from the repository root so workspace package imports lint correctly regardless of the current package working directory.
  - Added app subproject tsconfig glob support so Electron main, preload, and renderer package references resolve during per-package lint runs in CI.
- Affected areas:
  - `packages/config/src/eslint.cjs`
  - `docs/IMPLEMENTATION_TRACKER.md`
- Notes:
  - This fixes CI lint failures for `@filepilot/shared-contracts` imports in the desktop workspace.

### [2026-03-18] pending fix: resolve pnpm ci version conflict

- Implemented:
  - Updated the GitHub Actions CI workflow to rely on the repository `packageManager` declaration instead of redundantly pinning pnpm in `pnpm/action-setup`.
  - Removed the duplicate pnpm version source that caused `pnpm/action-setup@v4` to fail before install steps started.
- Affected areas:
  - `.github/workflows/ci.yml`
  - `docs/IMPLEMENTATION_TRACKER.md`
- Notes:
  - This is a CI-only fix; application behavior is unchanged.

### [2026-03-18] pending feat: implement tranche b typed ipc shell

- Implemented:
  - Added shared IPC contracts, request/event payload types, and boundary parsers for the Electron app bridge.
  - Registered secure main-process IPC handlers for app version lookup, folder selection, and a mock scan workflow that streams progress/completion events.
  - Replaced the preload placeholder with a narrow `window.filePilot` API and built a renderer shell that can choose a folder and run a mock scan end-to-end.
  - Swapped the temporary placeholder UI loading path for a CSP-hardened renderer HTML bootstrap that inlines the compiled renderer bundle.
- Affected areas:
  - `packages/shared-contracts/src/index.ts`
  - `apps/desktop/src/main`
  - `apps/desktop/src/preload/index.ts`
  - `apps/desktop/src/renderer`
  - `docs/IMPLEMENTATION_TRACKER.md`
- Notes:
  - The scan flow is intentionally mocked for Tranche B so the typed IPC surface can be validated before real traversal services land.

### [2026-03-18] pending chore: make husky pre-commit hook v10 compatible

- Implemented:
  - Updated the Husky pre-commit hook to remove deprecated bootstrap sourcing lines that will fail in Husky v10.
  - Preserved existing commit enforcement behavior requiring `docs/IMPLEMENTATION_TRACKER.md` to be staged.
  - Kept lint-staged execution through `corepack pnpm exec lint-staged` unchanged.
- Affected areas:
  - `.husky/pre-commit`
  - `docs/IMPLEMENTATION_TRACKER.md`
- Notes:
  - Replace `pending` with the actual short hash after commit creation.

### [2026-03-18] 53d797a chore: enforce implementation tracking automation

- Implemented:
  - Added a repository implementation tracker with update rules, helper command guidance, template, and seeded baseline commit entries.
  - Added workspace Copilot instructions to require tracker updates for all commit-producing tasks.
  - Added a Husky pre-commit guard that blocks commits when the tracker file is not part of staged changes.
  - Added a helper script and root package command to generate a new top tracker entry skeleton with `pending` hash defaults.
  - Updated contributor and project documentation to include tracker requirements and discoverability.
- Affected areas:
  - `.github/copilot-instructions.md`
  - `.husky/pre-commit`
  - `CONTRIBUTING.md`
  - `README.md`
  - `docs/IMPLEMENTATION_TRACKER.md`
  - `package.json`
  - `scripts/generate-tracker-entry.mjs`
- Notes:
  - Hash filled after commit creation.

### [2026-03-17] 7d071da feat: add secure Electron desktop shell

- Implemented:
  - Added Electron bootstrap with single-instance behavior and app lifecycle wiring.
  - Added secure BrowserWindow defaults and security guards (CSP, navigation controls, permissions denied by default).
  - Added preload bridge and temporary renderer placeholder shell.
  - Added desktop test coverage for secure main window options.
- Affected areas:
  - `apps/desktop/src/main`
  - `apps/desktop/src/preload`
  - `apps/desktop/src/renderer`
- Notes:
  - Establishes secure desktop baseline; feature workflows are still pending.

### [2026-03-17] 26a61fe chore: scaffold workspace packages

- Implemented:
  - Added package workspaces for `domain`, `application`, `infrastructure`, `shared-contracts`, `ui`, and `config`.
  - Added package-level build/lint/typecheck/test scripts and TypeScript project references.
- Affected areas:
  - `packages/*`
- Notes:
  - Most package exports are placeholders at this stage.

### [2026-03-17] 365322a chore: add shared tooling configuration

- Implemented:
  - Added shared ESLint, Prettier, Vitest, and Playwright config package exports.
  - Added root lint-staged and Husky setup.
- Affected areas:
  - `packages/config`
  - repository root tooling configs
- Notes:
  - Provides baseline quality and consistency tooling.

### [2026-03-17] 8fd00b0 Merge pull request #1 from bitbytes20/codex/generate-complete-project-foundation-for-filepilot

- Implemented:
  - Merged foundation architecture and planning baseline into the mainline branch.
- Affected areas:
  - repository baseline merge
- Notes:
  - Consolidates prior foundation setup work.

### [2026-03-17] fc639d4 docs: bootstrap FilePilot foundation architecture and roadmap

- Implemented:
  - Added core planning and governance docs: architecture, PRD, roadmap, testing strategy, contributing, security.
- Affected areas:
  - `README.md`
  - `docs/*`
  - `CONTRIBUTING.md`
  - `SECURITY.md`
- Notes:
  - Documentation-first baseline before feature implementation.
