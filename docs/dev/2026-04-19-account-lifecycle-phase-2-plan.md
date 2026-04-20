# Account Lifecycle Phase 2 Plan

## Mainline

- Active phase: `P5 Account Lifecycle Phase 2`
- Source TODO:
  - `docs/dev/2026-04-19-post-p0-p2-next-granular-todo.md`

## Goal

Move the product from admin-only account provisioning toward a more real user credential lifecycle without rebuilding the entire auth system.

## Chosen Scope

This phase will implement both:

1. first-login / temporary-password forced rotation
2. logged-in self-service password change

Reason:

- `must_reset_password` already exists in the schema, so forced rotation is now small enough to add
- self-service password change closes the main user-facing lifecycle gap after admin create/reset
- doing both together avoids a half-finished state where users are forced to rotate once but still depend on admins forever after that

## Product Rules

### Forced Rotation

- admin-created users must rotate the issued initial password after first login
- admin-reset users must rotate the temporary password after next login
- the bootstrap `studio` seed account remains exempt from forced rotation in this phase

### Self-Service Change

- logged-in users can change their own password from the frontend
- current session may remain active after a successful self-change
- other sessions for that user should be invalidated

### Backend Enforcement

- login and session APIs must expose `mustResetPassword`
- protected business routes must reject access while `mustResetPassword` is still true
- the password-change endpoint must stay accessible during forced-reset state

## Frontend Decision

- add one shared account-security section for authenticated users
- add one forced-reset overlay gate for `mustResetPassword` sessions
- reuse the current visual language:
  - `section-header`
  - `feature-card`
  - `admin-form`
  - auth-gate family for the forced-reset overlay

## Backend Decision

- extend credential reads/writes to persist `must_reset_password`
- add one password-change route:
  - `POST /api/auth/change-password`
- keep validation simple in this phase:
  - current password required
  - new password required
  - new password minimum length stays aligned with existing admin rule

## Tests Required

1. admin-created user login returns `mustResetPassword`
2. forced-reset user is blocked from protected routes until password change completes
3. self-service password change invalidates old password
4. current session remains usable after self-change
5. remote persistence exposes the new method/event shape
6. frontend markup includes the account-security anchors

## Known Risks

- the forced-reset overlay can accidentally conflict with the existing auth gate if state transitions are sloppy
- protected-route enforcement must not block the password-change endpoint itself
- admin reset semantics must stay clear:
  - reset creates a temporary password
  - self-change creates the steady-state password
