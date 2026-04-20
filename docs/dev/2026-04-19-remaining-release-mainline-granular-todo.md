# Remaining Release Mainline Granular TODO

## Purpose

This document replaces the earlier broad next-step notes with the concrete remaining queue after `P8` and `P9` had already been closed.

The goal is direct execution, not another strategy discussion.

## Current Status

Already complete:

- `P0` browser-level frontend acceptance automation
- `P1` real user account operations baseline
- `P2` docs/archive normalization
- `P3` mobile + responsive acceptance hardening
- `P4` screenshot-based visual regression baseline
- `P5` account lifecycle phase 2
- `P6` startup / deployment / runbook hardening
- `P7` security / abuse-control baseline
- `P8` production gateway hardening
- `P9` capacity baseline

Completed in this round:

- `P10` admin audit center
- `P11` invitation activation + forgot/reset password recovery

Remaining mainline after that:

- `P12` release closeout and final archive normalization

## Priority Order

1. `P12` release closeout

---

## P10 TODO: Admin Audit Center Closeout

### Goal

Finish the admin-facing audit surface so it is actually operable, tested, and documented.

### Granular TODO

1. Re-read `public/js/app.js` around admin audit state, render, and init wiring.
2. Confirm no duplicate listeners already exist for the audit form and pagination buttons.
3. Bind `#admin-audit-form` submit to audit filter loading.
4. Bind `#admin-audit-reset` click to audit filter reset.
5. Bind `#admin-audit-prev` click to previous-page loading.
6. Bind `#admin-audit-next` click to next-page loading.
7. Reconfirm audit state resets on logout, auth-expiry recovery, and non-admin render paths.
8. Extend backend auth tests for anonymous `GET /api/admin/audit-logs` returning `401`.
9. Extend backend auth tests for non-admin `GET /api/admin/audit-logs` returning `403`.
10. Extend backend auth tests for admin pagination fields:
    - `page`
    - `pageSize`
    - `total`
    - `totalPages`
    - `hasMore`
11. Extend backend auth tests for `action` filtering.
12. Extend backend auth tests for `actorUsername` filtering.
13. Extend backend auth tests for `targetUsername` filtering.
14. Extend backend auth tests for `from` / `to` date filtering.
15. Extend frontend state tests so remote persistence explicitly exposes `getAdminAuditLogs`.
16. Add one frontend state test that validates audit query params are sent through correctly.
17. Extend page-markup tests for the audit form, table body, and pagination anchors.
18. Extend browser smoke checks so admin login confirms the audit area becomes visible and finishes loading.
19. Run focused validation:
    - `node test-auth-history.js`
    - `node test-frontend-state.js`
    - `node test-page-markup.js`
    - `node test-ui-flow-smoke.js --port 18797 --launch-server`
20. If the admin visual baseline shifts, rerun:
    - `node test-ui-visual.js --port 18797 --launch-server`
21. Rerun:
    - `. 'D:\\document\\PowerShell\\profile.ps1'; node test-regression.js --skip-live --port 18797`
22. Update:
    - `docs/dev/2026-04-19-admin-audit-center-execution.md`
    - `docs/dev/2026-04-19-release-readiness-checklist.md`
    - `docs/dev/2026-04-19-dev-archive-index.md`
23. Record:
    - newly surfaced admin UX problems
    - missed earlier assumptions
    - remaining limits kept out of scope

### Acceptance

- admin audit center loads after admin login
- filters and pagination are wired
- anonymous / non-admin / admin route behavior is covered
- docs and regression gates reflect the feature

---

## P11 TODO: Invitation Activation + Forgot/Reset Password Recovery

### Goal

Move from admin-issued temporary passwords only toward a user-facing onboarding and recovery path that can survive broader user testing.

### Granular TODO

1. Write a dedicated `P11` plan in `docs/dev`.
2. Decide the minimum supported recovery scope:
   - invitation activation
   - forgot-password request
   - reset-password completion
3. Decide whether delivery is link-based only for this phase.
4. Decide whether tokens live only in SQLite for now.
5. Add token storage schema for invitation and password-reset records.
6. Add cleanup strategy for expired/used tokens.
7. Add state-store helpers for:
   - create invitation token
   - consume invitation token
   - create reset token
   - consume reset token
   - mark token used
8. Add admin route to issue an invitation for a user.
9. Add public route to validate invitation token.
10. Add public route to activate account from invitation.
11. Add public route to request password-reset token.
12. Add public route to validate reset token.
13. Add public route to complete password reset with token.
14. Define abuse controls for invitation issue and reset request endpoints.
15. Decide how the frontend enters invitation mode:
    - separate gate
    - URL-driven panel
16. Decide how the frontend enters forgot-password mode.
17. Add auth-gate copy for:
    - invitation activation
    - forgot password
18. Add invitation activation form markup.
19. Add forgot-password request form markup.
20. Add reset-password completion form markup.
21. Add `app-shell` methods for all new invitation/reset APIs.
22. Add `app.js` state and transitions for:
    - invitation token validation
    - reset token validation
    - activation submit
    - forgot-password submit
    - reset-password submit
23. Add backend tests for:
    - invalid token
    - expired token
    - already-used token
    - successful activation
    - successful reset
    - stale credentials invalid after reset
24. Add frontend state and markup tests for the new auth surfaces.
25. Add browser smoke coverage for one invitation/recovery happy path if the scope stays small enough.
26. Run focused tests for the new flow.
27. Rerun skip-live regression.
28. Update:
    - auth rules
    - release checklist
    - runbook notes if new operator actions exist
29. Record:
    - token lifecycle edge cases
    - abuse risks still deferred
    - any product copy gaps

### Acceptance

- a new user can activate with a real one-time flow
- an existing user can recover access without admin intervention
- token misuse and expiry paths fail intentionally

---

## P12 TODO: Release Closeout

### Goal

Freeze the current mainline into a release-ready, traceable package for user-facing testing.

### Granular TODO

1. Re-read `docs/dev/2026-04-19-release-readiness-checklist.md`.
2. Re-read `docs/dev/2026-04-19-dev-archive-index.md`.
3. Add every `P10` and `P11` document to the archive read order.
4. Review `git status --short` and separate source changes from generated artifacts.
5. Confirm `.gitignore` covers:
   - performance artifacts
   - UI snapshots
   - any new reset/invitation temp outputs
6. Refresh the release checklist with any new auth/admin/manual gates.
7. Refresh the local runbook if startup or operator steps changed.
8. Run the required focused suites for the last modified phase.
9. Run full skip-live regression:
   - `. 'D:\\document\\PowerShell\\profile.ps1'; node test-regression.js --skip-live --port 18797`
10. Run full live regression if credentials and network remain available:
    - `. 'D:\\document\\PowerShell\\profile.ps1'; node test-regression.js`
11. Review any failures and loop back before calling the round closed.
12. Write a release closeout execution log in `docs/dev`.
13. Record:
    - final green baseline
    - remaining deferred items
    - known throughput limits
    - operator notes for the next session

### Acceptance

- docs/dev is the single clear active archive for this round
- regression status is explicit
- remaining risk is documented instead of implied

---

## Immediate Start List

If execution resumes immediately after `P11`, do these first:

1. refresh `docs/dev/2026-04-19-release-readiness-checklist.md`
2. refresh `docs/dev/2026-04-19-dev-archive-index.md`
3. rerun full skip-live regression
4. rerun full regression
5. write the release closeout execution log
