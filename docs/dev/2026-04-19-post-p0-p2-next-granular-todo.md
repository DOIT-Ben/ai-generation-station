# Post P0-P2 Next Granular TODO

## Purpose

This document defines the next recommended work after the following phases have already been closed:

1. browser-level frontend acceptance automation
2. real user account operations baseline
3. docs/archive normalization

The goal now is not to reopen broad product strategy.
The goal is to define the next executable queue with enough granularity for direct implementation.

## Current Baseline

Already complete:

- desktop browser smoke flow
- bootstrap/admin login flow
- admin create user
- admin reset password
- old-session invalidation on password reset
- `docs/dev` as the active documentation root

Current known gaps:

- no mobile browser smoke automation
- no screenshot-based visual regression
- no first-login password rotation or self-service password change
- no stable local service daemon/startup workflow baseline
- no production-facing rate-limit / audit / abuse controls

## Recommendation

If only one next mainline is chosen, choose:

## Mobile + Visual Acceptance Hardening

Reason:

- the current biggest release risk is still frontend behavior drift outside the covered desktop path
- desktop shell automation exists, but mobile and visual stability are still mostly manual
- this is the highest-value continuation before adding more operational or onboarding scope

## Priority Order

1. P3: mobile + responsive acceptance hardening
2. P4: screenshot-based visual regression baseline
3. P5: account lifecycle phase 2
4. P6: startup / deployment / runbook hardening
5. P7: security / abuse-control baseline

---

## P3 TODO: Mobile + Responsive Acceptance Hardening

### Goal

Close the largest remaining frontend acceptance gap by making mobile and tablet behavior explicit, testable, and repeatable.

### Files Likely To Touch

- `public/css/style.css`
- `public/index.html`
- `public/js/app.js`
- `test-ui-flow-smoke.js`
- `docs/dev/2026-04-19-frontend-acceptance-matrix.md`
- new execution log in `docs/dev`

### Granular TODO

1. Create a dedicated execution log for the mobile acceptance round in `docs/dev`.
2. Re-run a manual mobile pass at:
   - `<= 767px`
   - `768px - 1023px`
3. Record concrete issues by area:
   - sidebar open/close
   - top-right utility cluster
   - auth gate readability
   - chat sidebar overflow
   - chat input row wrapping
   - generator card spacing
4. Fix any chat overflow or clipped-height issues on narrow screens.
5. Fix any top-right theme/login/account overlap on narrow screens.
6. Fix any auth gate width, padding, or form stacking issues on narrow screens.
7. Verify the mobile sidebar can:
   - open
   - close via overlay
   - close after nav selection
8. Extend `test-ui-flow-smoke.js` with one narrow-screen branch.
9. Add automated checks for:
   - mobile sidebar toggle
   - mobile login
   - mobile nav switch
10. Decide whether tablet gets a separate viewport path or remains manual.
11. Update the frontend acceptance matrix with:
   - automated mobile checks
   - remaining manual-only checks
12. Run focused verification:
   - `node test-ui-flow-smoke.js`
   - `. 'D:\document\PowerShell\profile.ps1'; node test-regression.js --skip-live --port 18797`
13. Record:
   - newly surfaced mobile issues
   - missed earlier layout assumptions
   - remaining manual-only risks

### Acceptance

- mobile sidebar behavior is automated at least once
- login/theme/nav remain usable at narrow width
- chat and generator pages do not break layout on mobile

---

## P4 TODO: Screenshot-Based Visual Regression Baseline

### Goal

Add one small visual-regression layer so future UI drift is caught before it reaches manual review.

### Files Likely To Touch

- `package.json`
- `test-ui-flow-smoke.js` or a new visual test file
- optional screenshot storage path
- optional ignore rules for generated artifacts
- `docs/dev/2026-04-19-product-ui-contract-baseline.md`
- `docs/dev/2026-04-19-release-readiness-checklist.md`

### Granular TODO

1. Decide the smallest visual-regression strategy:
   - Playwright screenshots recommended
   - avoid a full snapshot matrix on first pass
2. Define the first fixed capture set:
   - desktop dark chat
   - desktop light chat
   - desktop lyrics
   - auth gate
   - admin panel
3. Decide where baseline images live.
4. Decide what image diff threshold is acceptable.
5. Add one visual-regression command.
6. Add one failure message format that clearly tells which page/theme drifted.
7. Wire the visual test into regression only if it is stable and not too flaky.
8. Add ignore rules for transient output if needed.
9. Document what visual regression covers and what it still does not cover.
10. Run the visual suite locally and calibrate thresholds.
11. Re-run skip-live regression.
12. Record:
   - flake sources
   - snapshot maintenance cost
   - what visual drift is still outside coverage

### Acceptance

- at least one screenshot-based drift gate exists
- chat/auth/admin visual regressions can fail automatically
- the suite remains stable enough for routine local use

---

## P5 TODO: Account Lifecycle Phase 2

### Goal

Move beyond admin-only account creation toward a more real user lifecycle without jumping into a full auth-system rebuild.

### Files Likely To Touch

- `server/state-store.js`
- `server/routes/state.js`
- `public/js/app-shell.js`
- `public/js/app.js`
- `public/index.html`
- `test-auth-history.js`
- `test-frontend-state.js`
- new docs in `docs/dev`

### Granular TODO

1. Write a dedicated plan for account lifecycle phase 2.
2. Decide the exact next capability:
   - first-login password rotation
   - self-service password change for logged-in users
   - both, if still small enough
3. Reuse the existing `must_reset_password` field instead of inventing new schema if possible.
4. Define backend responses for:
   - must-reset-required
   - password-change validation failure
   - successful password update
5. Add backend support for forced password rotation after admin reset, if chosen.
6. Add frontend UI for logged-in password change.
7. If first-login reset is enabled, add a dedicated frontend path for it.
8. Remove any remaining implication that `studio` is the normal steady-state user path.
9. Add tests for:
   - forced reset on login
   - self password change
   - old password invalid after change
   - session invalidation rules
10. Update release-readiness and auth-rules docs.
11. Run focused tests and then skip-live regression.
12. Record:
   - newly discovered lifecycle edge cases
   - what still blocks production-grade onboarding

### Acceptance

- users can rotate credentials without admin-only dependency
- the product no longer feels tied to a permanent bootstrap credential flow

---

## P6 TODO: Startup / Deployment / Runbook Hardening

### Goal

Make local and future deployment startup more deterministic so the product can be run and verified without fragile manual shell steps.

### Files Likely To Touch

- startup scripts under repo or user workspace
- optional `server/index.js` health/startup support
- `docs/dev/2026-04-19-release-readiness-checklist.md`
- new runbook/startup docs in `docs/dev`

### Granular TODO

1. Reproduce the current local long-running startup method.
2. Decide the canonical local startup path:
   - direct `node server/index.js`
   - PowerShell wrapper
   - scheduled/background process wrapper
3. Add one script that starts the service reliably.
4. Add one script that stops or validates the service state.
5. Add one explicit health-check command.
6. Add one log-path convention for stdout/stderr.
7. Verify the chosen script works from a clean shell.
8. Document:
   - start
   - stop
   - restart
   - health check
   - common failure modes
9. Decide whether this same path can be reused in deployment later.
10. Update release-readiness docs.

### Acceptance

- one stable startup path exists
- one health-check path exists
- later sessions do not need to rediscover how to boot the app

---

## P7 TODO: Security / Abuse-Control Baseline

### Goal

Add minimal user-facing protection before the product is exposed more broadly.

### Files Likely To Touch

- `server/routes/state.js`
- `server/state-store.js`
- optional middleware/helpers
- `test-auth-history.js`
- `test-failures.js`
- new security notes in `docs/dev`

### Granular TODO

1. Write a short security-baseline plan.
2. Add request-rate rules for:
   - login
   - admin account creation
   - password reset
3. Add audit logging for:
   - create user
   - disable user
   - role change
   - password reset
4. Decide how audit data is stored:
   - sqlite table preferred
   - flat file only if kept very small
5. Add explicit backend error copy for rate-limited actions.
6. Add tests for repeated login and admin abuse paths.
7. Update release checklist with security gates.
8. Record remaining security gaps not yet addressed.

### Acceptance

- basic abuse controls exist for account-sensitive actions
- admin lifecycle actions become traceable

---

## Immediate Start List

If work starts right now, do these first:

1. create a new execution log for P3 in `docs/dev`
2. run one manual mobile pass
3. list concrete mobile breakpoints and overflow bugs
4. patch responsive layout issues
5. extend `test-ui-flow-smoke.js` with one mobile smoke branch
6. rerun skip-live regression

## Decision Rule

Choose P3 first unless one of these is true:

1. the next real business need is user onboarding/security rather than frontend stability
2. the current release target is blocked by startup/deployment friction rather than browser confidence

If condition `1` is true, jump to `P5`.
If condition `2` is true, jump to `P6`.
