# FilePilot Packaging and Runtime Notes

## Current Tranche D Packaging Posture

Tranche D makes the desktop workspace **build-ready and package-aware**, but not yet installer-signed or store-ready.

What is in place now:

- `pnpm run build:desktop` verifies the production TypeScript bundles for Electron main, preload, and renderer.
- CI runs a dedicated `desktop-build-windows` job on `windows-latest` so Windows-specific build regressions are caught before merge.
- The desktop app resolves all runtime assets from compiled bundle paths and keeps secure BrowserWindow defaults in both development and built modes.
- App data and logs can be redirected with `FILEPILOT_USER_DATA_DIR` and `FILEPILOT_LOG_DIR`, which is used by automated tests and is also useful for packaging validation.

## SQLite Runtime Constraint

FilePilot currently uses Node's built-in `node:sqlite` module.

That has two practical consequences:

1. The runtime must provide `node:sqlite` support.
2. If the host Electron runtime does not provide that module, FilePilot now fails with a **clear initialization error** instead of crashing during module import.

This is acceptable for Tranche D hardening because it makes the constraint explicit and diagnosable, but a later release tranche should either:

- upgrade Electron to a runtime that ships `node:sqlite`, or
- replace the persistence adapter with a packaged SQLite dependency that is explicitly rebuilt for Electron.

## Windows Validation Checklist

For a Windows packaging validation pass, use this sequence:

```bash
pnpm install
pnpm run build:desktop
pnpm run test
pnpm run test:e2e
```

Then validate manually against a Windows desktop environment:

- launch the built app
- confirm recent scans load from `%APPDATA%`/`userData`
- run a scan against a representative folder tree
- cancel a long-running scan
- relaunch the app and confirm persisted recent scans still appear
- inspect the generated log file under `<userData>\logs\filepilot.log`

## Runtime Storage Locations

By default FilePilot stores runtime data under Electron's `app.getPath('userData')`:

- database: `filepilot.sqlite`
- logs: `logs/filepilot.log`

For automated or isolated runs you can override:

- `FILEPILOT_USER_DATA_DIR`
- `FILEPILOT_LOG_DIR`
- `FILEPILOT_TEST_SELECTED_FOLDER` (test-only folder picker override)

## Follow-up Work After Tranche D

Packaging is not the duplicate-detection tranche, but the next platform hardening work should include:

- choosing the long-term SQLite runtime strategy for packaged Electron builds
- adding installer generation/signing
- adding a packaged-app smoke job once the runtime strategy is finalized
