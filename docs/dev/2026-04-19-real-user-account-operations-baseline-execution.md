# Real User Account Operations Baseline Execution Log

## Mainline

- Active mainline: `Real User Account Operations Baseline`
- Source TODO:
  - `docs/dev/2026-04-19-next-step-granular-todo.md`
  - `docs/dev/2026-04-19-real-user-account-operations-baseline-plan.md`

## Goal

Add the minimum viable account-operations surface required for user-facing testing:

- admin-created users
- admin-driven password reset
- existing user lifecycle controls preserved
- login copy reframed away from a permanent visible demo-account mindset

## Approved Scope

- no self-service registration in this phase
- no email/SMS recovery flow
- no MFA
- no billing or onboarding rebuild

## Initial Risks Identified

- current admin panel only supports post-creation mutation, so creation/reset actions need both backend and UI work
- password reset is not just a credential write; it needs explicit session invalidation rules
- the auth gate copy currently still surfaces bootstrap credentials too prominently for a user-facing baseline

## Implementation Notes

- Added backend support for `POST /api/admin/users` so admins can create real member accounts from the product UI.
- Added backend support for `POST /api/admin/users/:id/password` so admins can reset passwords.
- Password reset now revokes the target user's prior sessions; when an admin resets their own password from the current session, the current session can be retained for continuity while other sessions are cleared.
- Extended `public/js/app-shell.js` remote persistence with:
  - `createAdminUser`
  - `resetAdminUserPassword`
- Expanded the admin panel with:
  - a create-user form
  - a reset-password form
  - a user-list shortcut to preselect a reset target
- Demoted the bootstrap `studio` credentials in the auth gate from default-login framing to initialization-only guidance.

## Verification

Validated on April 19, 2026:

- `node test-frontend-state.js`
  - passed
- `node test-page-markup.js`
  - passed
- `node test-auth-history.js`
  - passed
- `node test-ui-flow-smoke.js --port 18797 --launch-server`
  - passed
- `. 'D:\document\PowerShell\profile.ps1'; node test-regression.js --skip-live --port 18797`
  - passed `10/10`
- `. 'D:\document\PowerShell\profile.ps1'; node test-regression.js`
  - passed `15/15`

## Boundary Conditions Handled

- duplicate usernames now return an explicit rejection instead of silently reusing an existing user record
- password reset now invalidates stale sessions so old cookies are not left active
- bootstrap credentials remain available only as local initialization guidance, not as the implied long-term user account path

## Missed Earlier Assumptions Corrected

- the previous "minimal admin controls" baseline was not enough for real user-facing testing because it could mutate existing users but could not create them
- password reset required session lifecycle handling, not just a credential overwrite
