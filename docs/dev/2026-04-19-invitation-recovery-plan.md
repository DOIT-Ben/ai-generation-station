# Invitation Activation And Recovery Plan

## Mainline

- Active phase: `P11 Invitation Activation + Recovery`
- Source queue:
  - `docs/dev/2026-04-19-remaining-release-mainline-granular-todo.md`

## Goal

Add the smallest user-facing onboarding and recovery layer that lets a real user:

1. activate an invited account without manually entering a temporary password
2. request a password reset without admin intervention
3. complete activation or reset from a one-time link

## Chosen Scope

Included:

- admin-issued invitation link for an existing user
- public invitation validation + activation
- public forgot-password request
- public password-reset validation + completion
- one-time SQLite-backed token storage
- frontend auth-gate recovery surfaces
- local preview delivery for links

Not included:

- real email/SMS delivery
- MFA
- email verification
- multiple concurrent valid tokens per purpose
- advanced password strength heuristics

## Product Decisions

### Delivery Model

There is no external mail provider in this round.

So this phase will use:

- `local_preview` delivery
- the backend returns a directly usable link preview
- the frontend can continue into activation/reset immediately from that preview

This is acceptable for local user-facing testing, but it is not the final production delivery model.

### Token Model

Use one shared SQLite token table instead of separate invitation/reset tables.

Reason:

- same lifecycle rules:
  - hashed token
  - expires at
  - used at
  - one-time consume
- smaller schema and test surface

Purposes:

- `invite_activation`
- `password_reset`

### Invitation Model

Invitations are issued for an already-created user.

Reason:

- reuses the current admin create-user baseline
- avoids adding a second unfinished “pending user without credential” lifecycle
- still gives the end user a better first-run path than typing a temporary password

On successful activation:

- set the new password
- clear `must_reset_password`
- invalidate old sessions
- create one fresh authenticated session

### Forgot-Password Model

Forgot-password requests stay generic at the request step.

The route will return success even if the account does not exist.

To keep local testing usable without leaking request-step success/failure too explicitly:

- always return the same top-level success message
- return a preview link payload
- if the username is unknown, the preview link uses a synthetic token that will fail at validation/consume time

This keeps the request contract stable while still allowing local testing.

On successful reset completion:

- set the new password
- clear `must_reset_password`
- invalidate old sessions
- create one fresh authenticated session

## Frontend Decision

Stay inside the existing auth-gate family.

Add:

- one forgot-password request gate
- one token-driven gate that can render either:
  - invitation activation
  - password reset completion

Use URL params:

- `?invite=<token>`
- `?reset=<token>`

Reason:

- the link itself becomes the state transition
- no separate router is needed
- users can open a single frontend URL directly

## Backend Decision

Add routes:

- `POST /api/admin/users/:id/invite`
- `GET /api/auth/invitation`
- `POST /api/auth/invitation/activate`
- `POST /api/auth/forgot-password`
- `GET /api/auth/password-reset`
- `POST /api/auth/password-reset/complete`

Store only token hashes in SQLite.

Invalidate older unused tokens of the same purpose for the same user when a new one is issued.

## Validation Plan

1. admin can issue invitation link
2. invalid invitation token is rejected
3. invitation token can be consumed only once
4. activation logs the user in and clears `mustResetPassword`
5. forgot-password request returns generic success
6. valid reset token completes password reset
7. old password fails after reset
8. stale sessions fail after reset
9. frontend exposes recovery/activation methods and markup anchors
10. skip-live regression still passes

## Known Risks

- local preview links are a deliberate stopgap, not a production delivery channel
- synthetic preview links for unknown usernames reduce request-step leakage, but token validation still fails later
- token expiry and reuse rules must stay precise or the frontend will get confusing edge states
