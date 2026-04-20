# Admin Audit Center Execution Log

## Mainline

- Active phase: `P10 Admin Audit Center`
- Plan:
  - `docs/dev/2026-04-19-admin-audit-center-plan.md`

## Goal

Turn existing backend audit records into an actual administrator-facing tool instead of a backend-only trace.

## Implementation

- Added backend audit query support in `server/state-store.js` with pagination plus action / actor / target / date filters.
- Added `GET /api/admin/audit-logs` in `server/routes/state.js`.
- Extended `server/route-meta.js` so the audit route is part of the explicit method contract.
- Added frontend remote-persistence support in `public/js/app-shell.js` for loading admin audit logs.
- Added admin audit markup in `public/index.html`:
  - filter form
  - summary line
  - table body
  - previous / next pagination controls
- Added audit state, rendering, and loading logic in `public/js/app.js`.
- Completed the missing init wiring in `public/js/app.js` for:
  - audit filter submit
  - audit reset
  - previous page
  - next page
- Extended browser smoke coverage so admin login now confirms the audit section becomes visible and finishes loading.
- Stabilized the enlarged admin-panel visual capture after the audit section changed its height.

## Validation

Passed:

1. `node test-auth-history.js`
2. `node test-frontend-state.js`
3. `node test-page-markup.js`
4. `node test-ui-flow-smoke.js --port 18797 --launch-server`
5. `node test-ui-visual.js --port 18797 --launch-server --update-baseline`
6. `. 'D:\\document\\PowerShell\\profile.ps1'; node test-regression.js --skip-live --port 18797`

Final result:

- skip-live regression baseline is green at `12/12`

## New Problems Surfaced During This Round

- The first `P10` handoff had already added render/load logic, but the audit form and pagination controls were still missing init-time event binding.
- The admin-panel screenshot baseline became stale after the audit section increased the panel height.
- After the baseline refresh, the admin-panel capture still had a small unstable diff from a dynamic time label in the user list.
- One regression attempt failed with `EADDRINUSE` because baseline refresh and full regression were accidentally launched in parallel on the same fixed port.

## Fixes Applied To Newly Surfaced Issues

- Added the missing audit control event listeners in `public/js/app.js`.
- Refreshed the visual baseline after the audit panel became part of the accepted UI.
- Updated `test-ui-visual.js` to wait for the audit summary to finish loading and to mask the dynamic `time` badge inside the admin panel.
- Re-ran regression serially after the port-conflict mistake instead of sharing `18797` across concurrent browser suites.

## Missed Earlier Assumptions

- Earlier work assumed adding the audit UI structure and render logic was enough.
  - It was not enough without explicit init-time event binding.
- Earlier visual-regression coverage assumed the admin panel remained stable after only masking timestamp text content.
  - The actual screenshot also needed deterministic waiting plus a stable placeholder block for the time badge.
- Earlier execution assumed two browser-driven commands could safely reuse the same `--launch-server --port 18797` target in parallel.
  - That assumption was wrong.

## Remaining Limits

- there is still no export / download flow for audit records
- there is still no full-text search across the audit `details` JSON payload
- the current admin audit UI stays intentionally table-first and operational, not analytical
