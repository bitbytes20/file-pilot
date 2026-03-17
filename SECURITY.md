# Security Policy

## Supported Versions

FilePilot is pre-release. Security fixes target the latest main branch.

## Reporting a Vulnerability

Please avoid public issues for sensitive reports.

- Email: `security@filepilot.dev` (placeholder; replace before public release)
- Include reproduction steps and impact.

## Security Baselines

- Context isolation enabled in Electron.
- Renderer has no direct Node access.
- IPC payload validation required.
- Local-only processing default.
