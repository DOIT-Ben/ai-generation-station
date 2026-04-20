# Release Core Normalization Execution

## Related Plan

- `docs/dev/2026-04-20-release-core-normalization-plan.md`

## Completed Scope

- added a non-browser `release-core` regression lane
- separated browser-assisted regression from core regression in the test runner
- added package scripts for the new regression lane
- normalized the current active documentation entry back to `docs/dev`
- tightened worktree rules so historical docs and generated artifacts stop polluting the active status view
- bootstrapped git metadata into the writable mirror so the current round can be committed

## Code And Doc Changes

### Regression Lane

- `test-regression.js`
  - added `--skip-browser`
  - skips:
    - `UiFlowSmoke`
    - `UiVisualRegression`
  - keeps the rest of the regression suite intact
- `package.json`
  - added:
    - `test:regression-core`
    - `test:release-core`

### Docs/Worktree

- `.gitignore`
  - ignore historical `docs/开发过程文档/`
  - ignore generated `test-artifacts/`
- `docs/dev/2026-04-20-auth-surface-round-status.md`
  - created one active status document for the current 2026-04-20 extension round
- `docs/dev/2026-04-19-docs-dev-bridge-note.md`
  - tightened the active-write rule around `docs/dev`
- `docs/dev/2026-04-19-dev-archive-index.md`
  - refreshed latest read order
  - recorded the new release-core regression lane
- `docs/dev/2026-04-19-release-readiness-checklist.md`
  - split:
    - release-core gates
    - full browser-assisted gates

### Git Closure

- copied `.git` metadata from the read-only source repo into the writable mirror
- restored tracked `output/` artifacts into the mirror so git would not stage unintended deletions

## Validation

### Syntax / Parse Checks

- `node --check test-regression.js` passed
- `scripts/run-ui-flow-smoke-via-cdp.ps1` parsed successfully

### Phase 1 Validation

- `npm run test:regression-core` passed

Result:
- passed groups:
  - `FrontendState`
  - `PageMarkup`
  - `StyleContract`
  - `SecurityGateway`
  - `AuthHistory`
  - `TaskPersistence`
  - `MusicRoute`
  - `VoiceCoverRoute`
  - `Smoke`
  - `Failures`
- skipped by design:
  - `UiFlowSmoke`
  - `UiVisualRegression`

### Phase 2 Validation

- `npm run test:release-core` passed

Result:
- release-core regression passed
- capacity baseline artifact generated successfully under:
  - `test-artifacts/performance/`

## Single-Task Closeout Review

### Phase 1: Release-Core Regression Lane

- New issue found:
  - the current regression runner assumed browser availability and had no intentional non-browser execution path
- Missed edge:
  - without an explicit skip flag, every later phase would falsely look blocked even when non-browser coverage was healthy
- Fix:
  - added `--skip-browser`
  - added dedicated npm scripts for core regression

### Phase 2: Docs/Worktree Normalization

- New issue found:
  - the active worktree still mixed `docs/dev` with the historical archive and generated artifacts
- Missed edge:
  - even correct current-round work would remain hard to stage and audit because status noise hid the active diff
- Fix:
  - tightened the bridge rule
  - added an active round-status document
  - ignored the historical doc tree and generated test artifacts in the active workflow

### Phase 3: Git Commit Closure

- New issue found:
  - the writable mirror was not a git repository
  - the first mirror copy excluded tracked `output/` files, which made git report false deletions
- Missed edge:
  - committing from the mirror without restoring tracked artifacts would have mixed real code changes with accidental artifact removals
- Fix:
  - copied `.git` metadata into the mirror
  - restored tracked `output/` files before staging

## Deferred Items

- browser UI launch troubleshooting remains deferred
- full browser-assisted regression remains deferred until a runnable browser environment is available
