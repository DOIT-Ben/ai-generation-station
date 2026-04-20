# Account Center And Logout Fix Execution

## Related Plan

- `docs/dev/2026-04-20-account-center-logout-fix-plan.md`

## Goal

Repair the account-center experience and make portal logout reliably return to the auth page.

## Execution Log

### Phase 1: Planning And Guardrails

Status:
- completed

Notes:
- created the dedicated plan and execution log
- confirmed the reported issues affect:
  - `public/account/index.html`
  - `public/js/account-page.js`
  - `public/js/site-shell.js`
  - `public/js/auth-page.js`
  - `public/js/app-shell.js`
  - `server/routes/state.js`
  - `test-page-markup.js`
  - `test-frontend-state.js`
  - `test-ui-flow-smoke.js`

### Phase 2: Logout Reliability

Status:
- completed

Notes:
- hardened browser session checks in `public/js/app-shell.js` so `loadSession()` now bypasses cache with explicit `no-store` hints
- marked `/api/auth/session` and `/api/auth/logout` responses as `Cache-Control: no-store` in `server/routes/state.js`
- changed shared portal logout in `public/js/site-shell.js` to:
  - attempt logout
  - verify the session no longer exists
  - only redirect after the session is actually gone
  - keep the user on the current page with an error toast if logout did not complete
- applied the same post-logout session verification principle to workspace logout in `public/js/app.js`

### Phase 3: Account Center Redesign

Status:
- completed

Notes:
- replaced the old stacked generic-card layout in `public/account/index.html` with a clearer personal-center structure:
  - profile hero
  - quick-entry overview
  - scoped page-responsibility panel
  - primary password and security panel
- removed the old “当前原则” style filler card that made the page read like product notes instead of a user center
- added account-specific layout and responsive styles in `public/css/style.css`
- kept the existing account IDs needed by JS and smoke tests while layering in new status-summary bindings

### Phase 4: Verification

Status:
- completed

Notes:
- updated regression coverage in:
  - `test-page-markup.js`
  - `test-frontend-state.js`
  - `test-ui-flow-smoke.js`
- passed focused checks:
  - `node test-frontend-state.js`
  - `node test-page-markup.js`
  - `node test-ui-flow-smoke.js --launch-server`
- passed broader regression:
  - `npm run test:regression-core`
  - `npm run test:release-core`

## Single-Task Closeout Review

### New Problems Found

- the existing portal logout smoke assertion was too weak because it only checked a transient path change, not whether the auth page remained stable after the next session probe
- the auth session endpoint did not explicitly advertise `no-store`, which left room for stale session reads after logout

### Missed Edge Cases

- a logout flow can look correct for one navigation step and still bounce back later if the auth page rehydrates from a stale session result
- a cleaner account-center redesign still needs explicit mobile layout treatment; this could not be left to generic portal-grid breakpoints alone

### Fixes Applied

- enforced no-store session loading on both the frontend and backend
- added post-logout session verification before redirecting away from portal or workspace pages
- rebuilt `/account/` into a clearer member-center layout with stronger identity/security hierarchy
- tightened frontend and browser smoke coverage so the logout bounce regression is less likely to slip again
