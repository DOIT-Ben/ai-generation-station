# Email Identity Baseline Execution Log

## Mainline

- Active phase: `P15 Email Identity Baseline`
- Plan:
  - `docs/dev/2026-04-19-email-identity-baseline-plan.md`

## Goal

Promote `email` from a dormant DB column into a real, validated admin-managed account field.

## Implementation

- Extended `server/state-store.js`.
  - added `getUserByEmail()`
  - extended admin user update persistence so email changes are stored
- Updated `server/routes/state.js`.
  - added email normalization
  - added email format validation
  - added duplicate-email rejection
  - extended admin create-user to accept `email`
  - extended admin update-user to accept `email`
- Updated admin UI in `public/index.html` and `public/js/app.js`.
  - admin create-user form now includes an email field
  - user list now renders each account's email state
  - added a minimal “编辑邮箱” action using the existing admin update route
- Extended tests:
  - `test-auth-history.js` now covers invalid email create, duplicate email create, email update, duplicate email update, and email exposure in admin listing
  - `test-frontend-state.js` now verifies admin create/update payloads carry email
  - `test-page-markup.js` now asserts the email field and email-editing control exist

## Validation

Passed:

1. `node test-auth-history.js`
2. `node test-frontend-state.js`
3. `node test-page-markup.js`
4. `node test-ui-flow-smoke.js --port 18797 --launch-server`

Final result:

- focused validation is green

## New Problems Surfaced During This Round

- The product had already committed to email-oriented invite/recovery goals while still treating email as an optional hidden data point.
- The admin UI could mutate status, role, and plan, but not the one field future delivery depends on.

## Fixes Applied To Newly Surfaced Issues

- Moved email into the same explicit admin-management surface as the other account attributes.
- Added route-level validation and uniqueness checks instead of relying on raw SQLite constraint failures.

## Missed Earlier Assumptions

- Earlier account-lifecycle work assumed username alone was enough to carry onboarding and recovery.
  - It was not enough once the delivery target shifted toward real email.
- Earlier user-management UI assumed email could wait until the notification phase.
  - That would have forced a second user-model change right before delivery work.

## Remaining Limits

- email is still optional in this phase
- there is still no email verification
- invitation and recovery delivery are still `local_preview` until the next phase
