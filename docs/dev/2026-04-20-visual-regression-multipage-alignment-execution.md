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
- completed

Notes:
- refreshed the baseline set successfully with:
  - `node test-ui-visual.js --port 18797 --launch-server --update-baseline`
- validated the refreshed set successfully with:
  - `node test-ui-visual.js --port 18797 --launch-server`
- current tracked baseline set is now:
  - `auth-portal-card.png`
  - `utility-cluster-authenticated.png`
  - `account-center-security.png`
  - `admin-console.png`
  - `chat-card-dark.png`
  - `chat-card-light.png`
  - `lyrics-card-light.png`
- removed the retired baseline files:
  - `auth-gate-card.png`
  - `admin-panel.png`

### Phase 4: Docs

Status:
- completed

Notes:
- recorded the environment-specific browser failure modes here so later work can distinguish:
  - selector drift problems
  - sandbox/browser-launch problems
  - CDP attach instability
- after a later session regained full browser-launch capability, the baseline refresh carry-forward item was closed

## Single-Task Closeout Review

### New Problems Found

- the original baseline directory still contained retired image names even after the capture plan had been updated
- the earlier browser-launch/CDP failures were session-specific environment limits, not a permanent repo-level blocker

### Missed Edge Cases

- the original visual harness assumed the auth/admin UI still lived inside the workspace page
- the original execution path assumed Node child-process browser launch would remain available
- the original CDP wrapper assumed “CDP endpoint reachable” was enough, but this session shows endpoint readiness and stable browser attach are separate concerns
- refreshing baselines is not enough on its own; retired PNGs need an explicit cleanup step

### Fixes Applied

- realigned the visual capture plan to the current multi-page product structure
- restored deterministic admin normalization on the new admin page layout
- added a dedicated CDP wrapper script for externally started browsers
- changed the wrapper browser resolution order to prefer Edge before Chrome in `auto` mode on this Windows environment
- made the auth login helper tolerant to existing-session redirects so future shared-session visual runs do not fail immediately
- refreshed and revalidated the active baseline set successfully
- removed obsolete baseline files so the artifact directory now matches the live capture plan exactly
