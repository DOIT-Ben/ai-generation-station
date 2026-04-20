# Real User Account Operations Baseline Plan

## Purpose

Define the first account-operations baseline that moves the product beyond a single visible bootstrap credential path.

This phase does not attempt to build a full production identity system.
It only closes the smallest missing operational gap that blocks user-facing testing:

- admin can create a real user
- admin can reset a user's password
- admin can still disable/enable and adjust role/plan
- login copy no longer reads like a permanent internal demo

## Scope

Included in this phase:

1. admin-created accounts only
2. password reset by admin
3. existing enable/disable, role, and plan controls remain
4. frontend admin panel gains the minimum UI to operate those flows
5. backend and regression tests cover the new lifecycle

Explicitly out of scope:

1. public self-service registration
2. forgot-password email or SMS flows
3. MFA
4. profile editing
5. invitation links
6. billing entitlements

## Product Decisions

### Account Creation Model

- the first real-user path is admin-created accounts only
- the seeded `studio` account remains a bootstrap/local-initialization admin account
- the seeded account should no longer be framed like the normal intended user login path

### Password Reset Model

- admins can set a new password directly for a target user
- password reset invalidates the target user's existing sessions
- if an admin resets their own password from the current admin session, the current session may remain usable for continuity, but other sessions for that user should be revoked

### Validation Baseline

- username must be present and normalized
- password must be present and meet a minimum length rule
- duplicate usernames must be rejected explicitly

### Frontend Surface

- admin panel gets:
  - one create-user form
  - one reset-password form
  - existing user list and lifecycle actions
- auth gate copy is updated so bootstrap credentials are clearly local initialization guidance, not the default long-term user account path

## Files Expected To Change

- `server/state-store.js`
- `server/routes/state.js`
- `server/route-meta.js`
- `public/index.html`
- `public/js/app-shell.js`
- `public/js/app.js`
- `public/css/style.css`
- `test-auth-history.js`
- `test-frontend-state.js`
- `test-page-markup.js`
- `docs/dev/2026-04-19-real-user-account-operations-baseline-execution.md`

## Granular TODO

1. Record the approved scope and constraints in an execution log.
2. Audit the current admin surface and existing state-store helpers.
3. Define the backend contract for:
   - admin create user
   - admin reset password
4. Add state-store support for password reset and session invalidation.
5. Add route support for admin create user.
6. Add route support for admin reset password.
7. Extend route metadata for any new POST behavior.
8. Add frontend persistence helpers for the new admin operations.
9. Extend admin panel markup with:
   - create-user form
   - reset-password form
10. Wire frontend submit handlers for create user.
11. Wire frontend submit handlers for password reset.
12. Refresh admin list rendering so the reset form target list stays current.
13. Demote bootstrap-login copy in the auth gate.
14. Add backend regression coverage for:
   - duplicate user rejection
   - new user login
   - password reset
   - old password rejection after reset
   - old sessions revoked after reset
15. Add frontend/state markup coverage for the new admin panel anchors and remote-persistence methods.
16. Run focused tests.
17. Run skip-live regression after the backend and frontend changes are stable.
18. Record:
   - new problems found
   - boundary conditions handled
   - what the earlier plan missed

## Acceptance

This phase is complete only if all of the following are true:

1. an admin can create a new user from the product UI
2. that new user can log in with the issued password
3. an admin can reset a user's password
4. the old password no longer works after reset
5. existing sessions for the reset target are invalidated intentionally
6. the login screen no longer reads like the entire product depends on one fixed public demo account
