# Invitation Activation And Recovery Execution Log

## Mainline

- Active phase: `P11 Invitation Activation + Recovery`
- Plan:
  - `docs/dev/2026-04-19-invitation-recovery-plan.md`

## Goal

Add the first user-facing invitation activation and forgot/reset password recovery loop for local product testing.

## Implementation

- Added SQLite-backed one-time token storage in `server/state-store.js`.
  - one shared token table
  - hashed tokens only
  - expiry support
  - single active token per user/purpose
- Added new backend routes in `server/routes/state.js`:
  - `POST /api/admin/users/:id/invite`
  - `GET /api/auth/invitation`
  - `POST /api/auth/invitation/activate`
  - `POST /api/auth/forgot-password`
  - `GET /api/auth/password-reset`
  - `POST /api/auth/password-reset/complete`
- Extended `server/route-meta.js` so the new invitation/recovery routes are part of the explicit route contract.
- Reused the existing password/session model for both invitation activation and recovery completion:
  - set a fresh password
  - clear `must_reset_password`
  - invalidate old sessions
  - create one new authenticated session
- Added admin-side invitation issuance UI in the user list.
- Added auth-gate extensions in `public/js/app.js` for:
  - forgot-password request
  - URL-token invitation activation
  - URL-token password reset completion
- Added remote-persistence methods in `public/js/app-shell.js` for all invitation/recovery routes.
- Added auth-gate copy explaining that invitation or recovery links can be opened directly in the current frontend.
- Kept delivery in `local_preview` mode for this round so the flow remains testable without email/SMS infrastructure.

## Validation

Passed:

1. `node test-auth-history.js`
2. `node test-frontend-state.js`
3. `node test-page-markup.js`
4. `node test-ui-flow-smoke.js --port 18797 --launch-server`
5. `node test-ui-visual.js --port 18797 --launch-server --update-baseline`
6. `. 'D:\\document\\PowerShell\\profile.ps1'; node test-regression.js --skip-live --port 18797`
7. `. 'D:\\document\\PowerShell\\profile.ps1'; node test-regression.js`

Final result:

- skip-live regression is green at `12/12`
- full regression is green at `17/17`

## New Problems Surfaced During This Round

- There is no real mail/SMS transport in the current product, so a normal forgot-password flow would have been unusable without an interim delivery strategy.
- Invitation issuance introduces a new admin action that would have looked inconsistent inside the existing audit center unless it got:
  - a named action label
  - a filter option
- The auth gate gained more interaction paths, which meant the browser smoke suite needed at least one real gate-navigation assertion instead of only login/logout.

## Fixes Applied To Newly Surfaced Issues

- Chose `local_preview` link delivery for both invitation and forgot-password so the full flow is testable in the current environment.
- Added the `user_invite_issue` audit action label and frontend filter option so invitation issuance remains visible in the admin audit center.
- Extended `test-ui-flow-smoke.js` so it now verifies the forgot-password gate can open and return to the login gate before the normal login path continues.
- Refreshed the visual baseline after the auth gate gained the extra recovery action row and note copy.

## Missed Earlier Assumptions

- Earlier account-lifecycle work assumed “temporary password + forced reset” was enough for near-term user-facing testing.
  - It was not enough once the goal shifted toward actual user recovery without admin intervention.
- Earlier plans treated invitation onboarding and forgot-password as future concerns with no immediate frontend implications.
  - In practice, both required auth-gate state management, URL-token parsing, and new acceptance coverage.
- Earlier release docs still listed invitation and forgot-password as deferred.
  - That became stale once this phase was implemented.

## Remaining Limits

- delivery is still `local_preview`, not real email or SMS
- forgot-password request throttling is not yet a dedicated rule in this round
- invitation/recovery browser smoke does not yet complete the full happy path in UI automation
- there is still no MFA or email verification layer
