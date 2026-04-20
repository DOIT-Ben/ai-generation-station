# Account Lifecycle Phase 2 Execution Log

## Mainline

- Active phase: `P5 Account Lifecycle Phase 2`
- Plan:
  - `docs/dev/2026-04-19-account-lifecycle-phase-2-plan.md`

## Goal

Close the biggest remaining auth lifecycle gap by making temporary-password rotation and logged-in self-service password change both real product behavior.

## Implementation

- Reused the existing `must_reset_password` field instead of introducing a second credential-state flag.
- Extended the credential read/write path in `server/state-store.js` so new users, reset users, and self-change flows can all set or clear `must_reset_password` intentionally.
- Stopped re-seeding the bootstrap account password on every restart once the seed user already has a credential row.
  - The bootstrap credential is now treated more like an initialization path than a perpetual reset button.
- Added backend exposure of `mustResetPassword` in:
  - `POST /api/auth/login`
  - `GET /api/auth/session`
- Added backend enforcement so protected app routes return:
  - `403`
  - reason: `password_reset_required`
  - message: `请先修改临时密码后再继续使用`
- Added self-service password change endpoint:
  - `POST /api/auth/change-password`
- Added frontend account-security section for authenticated users.
- Added frontend forced-reset overlay gate for sessions that still carry a temporary password.
- Added frontend remote-persistence support for:
  - password change
  - `app-password-reset-required` event dispatch

## Product Behavior After This Round

### Admin Create User

- new users are created with a temporary password
- first login succeeds
- the session is marked `mustResetPassword: true`
- protected routes stay blocked until the user changes that password

### Admin Reset Password

- reset generates a temporary password state for the target user
- prior sessions are invalidated
- next login succeeds only into forced-reset mode

### Self-Service Password Change

- logged-in users can change their own password from the frontend
- the current session stays active
- other sessions for that user are invalidated
- the new password becomes the steady-state credential immediately

## Verification

Passed:

1. `node test-frontend-state.js`
2. `node test-page-markup.js`
3. `node test-auth-history.js`
4. `node test-ui-flow-smoke.js --port 18797 --launch-server`
5. `node test-ui-visual.js --port 18797 --launch-server --update-baseline`
6. `node test-ui-visual.js --port 18797 --launch-server`

## New Problems Surfaced During This Round

- Visual regression initially failed after the account-security UI was added, not because of a product bug, but because the old baseline still encoded unstable screenshot conditions.
- The first screenshot baseline implicitly depended on transient toasts and viewport-relative translucent backdrops.
  - This was a test-design flaw, not just a stale baseline.
- Running multiple browser suites in parallel against `--launch-server --port 18797` caused an avoidable `EADDRINUSE` conflict.
  - This was an execution-scheduling issue, not a frontend regression.

## Fixes Applied To Newly Surfaced Issues

- Updated `test-ui-visual.js` to hide transient toast/loading UI during capture.
- Added a stable backdrop override for translucent card captures so page-position drift does not produce false diffs.
- Added utility-cluster visibility control per capture so component screenshots are less polluted by fixed shell controls.
- Re-generated the screenshot baseline only after the stabilization changes were in place.

## Missed Earlier Assumptions

- Earlier auth rules assumed “login success” was enough to describe account readiness.
  - It was not enough once temporary-password rotation became part of the real lifecycle.
- Earlier bootstrap logic still behaved like the seeded admin password could be safely reasserted forever.
  - That assumption breaks steady-state self-service password rotation.
- Earlier screenshot strategy assumed element capture alone would isolate page components.
  - That missed fixed overlays, toasts, and translucent backdrops.

## Remaining Limits

- there is still no forgot-password recovery flow
- there is still no invitation-based onboarding or email verification
- password policy is still minimal and does not yet include strength heuristics
- password-reset-required enforcement currently focuses on app routes, not a broader future API surface
