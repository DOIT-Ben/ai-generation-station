# Browser Frontend Automation Execution Log

## Mainline

- Active mainline: `Browser-Level Frontend Acceptance Automation`
- Source TODO:
  - `docs/dev/2026-04-19-next-step-granular-todo.md`

## Goal

Add one real browser-driven smoke layer for the current user-facing shell without expanding into a full browser test framework rollout.

## Baseline Decision

Current repo state before implementation:

- no Playwright dependency
- no Puppeteer dependency
- no existing browser test config
- current regression already covers:
  - page markup
  - frontend state
  - style contract
  - auth/history
  - failure paths
  - service/live provider flows

Decision:

- use Playwright as the browser engine
- do not introduce Playwright Test runner in the first pass
- keep the first implementation aligned with the current repo style:
  - one `node`-executable test file
  - one package script
  - one regression hook

Reason:

- this keeps the first browser layer small
- avoids a large toolchain jump during the first acceptance-automation round
- integrates cleanly with the current `test-regression.js` structure

## Initial TODO

1. install the minimal browser automation dependency
2. install Chromium for Playwright
3. create one browser smoke test file
4. cover:
   - homepage load
   - login
   - tab switch
   - theme toggle
   - logout
5. add a package script
6. wire the test into `test-regression.js`
7. update the acceptance matrix
8. verify locally before moving on to the next mainline

## Implementation Notes

- Added `playwright` as a dev dependency and confirmed the local browser bundle is available.
- Added `test-ui-flow-smoke.js` as a plain `node` test script rather than introducing Playwright Test config.
- Added `npm run test:ui-flow` / `node test-ui-flow-smoke.js` as the direct browser-smoke entry point.
- Wired `UiFlowSmoke` into `test-regression.js`.
- In regression mode, the smoke test now boots a real HTTP server on the requested port with a temporary isolated SQLite state file so browser login/logout does not mutate the developer's real local state.

## Automated Flow Covered

The first browser smoke currently asserts:

1. homepage loads successfully
2. sidebar, theme toggle, login entry, and auth gate render
3. bootstrap admin login succeeds
4. top-right authenticated state appears
5. admin panel becomes visible
6. navigation can switch from chat to lyrics
7. theme toggle changes root theme state
8. logout returns the UI to the locked/auth-gate state

## Boundary Conditions / Newly Surfaced Issues

- Browser automation cannot reuse the in-memory `withBoundServer` helper because Playwright needs a real listening HTTP port.
- A real browser run would pollute the default app-state database if it reused the normal server config, so isolation via temp state files became necessary.
- This first pass only proves desktop shell behavior; it does not validate mobile sidebar behavior, generator jobs, or visual fidelity.

## Missed Earlier Assumptions Corrected

- Earlier acceptance docs said browser automation was deferred. That is no longer accurate after this round and had to be updated.
- The initial assumption that regression could hook browser smoke into the existing non-network server wrapper was incorrect; browser tests require an actual network listener.

## Verification

Validated on April 19, 2026:

- `node test-ui-flow-smoke.js --port 18797 --launch-server`
  - passed
- `. 'D:\document\PowerShell\profile.ps1'; node test-regression.js --skip-live --port 18797`
  - passed with `UiFlowSmoke` included in the regression bundle
- `. 'D:\document\PowerShell\profile.ps1'; node test-regression.js`
  - passed `15/15`
