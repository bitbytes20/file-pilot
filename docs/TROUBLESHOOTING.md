# FilePilot Troubleshooting

## Scan issues

### Recent scans do not appear after restart

- Confirm the app is using the expected `userData` path.
- If you are running tests or isolated sessions, check `FILEPILOT_USER_DATA_DIR`.
- Inspect `logs/filepilot.log` for database initialization messages.

### Scan fails immediately

Common causes:

- selected root path no longer exists
- root path is not a directory
- runtime SQLite support is unavailable in the current Electron build

The UI should now surface the error in the status banner, and the failure is also recorded in the scan events table and log file.

### Some folders or files are skipped

This is expected for several safety-oriented edge cases:

- permission denied (`EACCES`, `EPERM`)
- path disappeared during scan (`ENOENT`)
- symlink skipped for safety
- device I/O failure (possible disconnect)

These are recorded as diagnostic events instead of crashing the app.

## Test issues

### Electron E2E tests fail to launch locally

The Playwright Electron suite requires a host with the native Electron runtime dependencies installed.

On Linux this commonly means installing packages such as:

- `libgtk-3-0`
- `libnss3`
- `libasound2`
- `libatk1.0-0`
- `xvfb`

If the environment cannot launch Electron, use unit/integration/build verification first and treat E2E as an environment limitation rather than an application regression.

## Database/runtime issues

### SQLite runtime unavailable

FilePilot currently relies on `node:sqlite`.

If the runtime does not expose that module, FilePilot now reports a clear initialization error. The long-term fix is to align Electron runtime support or adopt an explicit packaged SQLite dependency in a later packaging tranche.
