# FilePilot Testing Strategy

## Recommended Testing Stack

- **Unit/Integration**: Vitest
- **React component tests**: Testing Library + Vitest + jsdom
- **IPC contract tests**: Vitest (schema and runtime validation)
- **E2E**: Playwright (Electron mode)
- **Mocking/stubs**: `memfs`, temp directories, adapter mocks
- **Coverage**: c8 / built-in Vitest coverage

## Testing Pyramid

1. **Unit tests (60-70%)**
   - Domain rules, filters, duplicate grouping logic, planner policies.
2. **Integration tests (20-30%)**
   - Scan pipeline with temp fixture trees.
   - SQLite repository behavior.
   - Safe action service with mocked storage providers.
3. **Component tests (10-15%)**
   - Duplicate list interactions, confirmation workflows, warning states.
4. **E2E smoke tests (5-10%)**
   - Launch app, run scan, review duplicates, perform safe delete dry-run.

## Regression Safety for File Operations

- Maintain dedicated immutable fixture sets:
  - renamed duplicate pairs
  - same name + different content
  - same size + different content
  - mixed categories and nested folders
- Assert pre/post filesystem snapshots.
- Use dry-run tests as first-class gates.
- Run mutation integration tests against temporary directories only.

## Filesystem Mocking Guidance

- Domain tests: mock repository + provider interfaces.
- Infrastructure tests: use temp dirs on real FS for path/permission realism.
- Avoid unit tests that depend on host user files.

## CI Quality Gates

- Lint + typecheck required.
- Unit/integration/component test pass required.
- E2E smoke on pull requests and nightly full suite.
- Enforce coverage floor with progressive ratcheting.

## Suggested Initial Coverage Targets

- Domain/Application: 80%+
- Infrastructure critical services: 70%+
- UI workflows (critical paths): behavioral assertions over line coverage focus
