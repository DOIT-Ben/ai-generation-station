# Visual Regression Multi-Page Alignment Execution

## Related Plan

- `docs/dev/2026-04-20-visual-regression-multipage-alignment-plan.md`

## Goal

Make visual regression validate the current multi-page UI instead of the retired embedded auth/admin structure.

## Execution Log

### Phase 1: Selector And Flow Audit

Status:
- completed

Notes:
- confirmed the failing script still expects the old embedded auth/admin selectors
- confirmed the new UI now lives across:
  - `/auth/`
  - `/account/`
  - `/admin/`
  - `/`
- confirmed the tracked baseline set still contains retired names:
  - `auth-gate-card.png`
  - `admin-panel.png`

### Phase 2: Script Realignment

Status:
- completed

Notes:
- updated `test-ui-visual.js` to capture the real multi-page surfaces:
  - `auth-portal-card`
  - `utility-cluster-authenticated`
  - `account-center-security`
  - `admin-console`
  - `chat-card-dark`
  - `chat-card-light`
  - `lyrics-card-light`
- replaced the old embedded auth/admin selectors with the current `/auth/`, `/account/`, `/admin/`, and workspace selectors
- added admin timestamp normalization for:
  - `#admin-user-list time`
  - `#admin-audit-table-body tr td:first-child .audit-log-copy strong`
- added `--cdp-url` support so the visual harness can at least target an externally started browser when direct Playwright launch is blocked
- hardened `loginAsBootstrapAdmin()` so it no longer assumes `/auth/` always stays on the login form when an existing session redirects back to `/`

### Phase 3: Baseline Refresh

Status:
- blocked

Notes:
- direct visual execution remains blocked in the current environment:
  - `node test-ui-visual.js --port 18797 --launch-server`
  - failure: `browserType.launch: spawn EPERM`
- browser CDP startup is inconsistent in the same session:
  - Chrome often fails to expose `http://127.0.0.1:9223/json/version`
  - Edge can expose `/json/version`, but `chromium.connectOverCDP(...)` still times out after websocket connect
- a raw-CDP fallback experiment was attempted and then reverted because the page websocket never produced stable protocol responses in this sandbox
- because of that, no new baseline images were safely refreshed and the retired baseline files were intentionally left untouched for now

### Phase 4: Docs

Status:
- completed

Notes:
- recorded the environment-specific browser failure modes here so later work can distinguish:
  - selector drift problems
  - sandbox/browser-launch problems
  - CDP attach instability
- baseline refresh remains a carry-forward item for a less restricted local session

## Single-Task Closeout Review

### New Problems Found

- the current sandbox blocks Node-based browser launch with `spawn EPERM`
- Chrome remote-debugging readiness is flaky in this Windows session even when the browser process is started externally
- Edge remote-debugging can become reachable, but Playwright CDP attach still does not complete reliably here

### Missed Edge Cases

- the original visual harness assumed the auth/admin UI still lived inside the workspace page
- the original execution path assumed Node child-process browser launch would remain available
- the original CDP wrapper assumed “CDP endpoint reachable” was enough, but this session shows endpoint readiness and stable browser attach are separate concerns

### Fixes Applied

- realigned the visual capture plan to the current multi-page product structure
- restored deterministic admin normalization on the new admin page layout
- added a dedicated CDP wrapper script for externally started browsers
- changed the wrapper browser resolution order to prefer Edge before Chrome in `auto` mode on this Windows environment
- made the auth login helper tolerant to existing-session redirects so future shared-session visual runs do not fail immediately
