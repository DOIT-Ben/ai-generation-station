# P21 Auth Write-Path Scaling Execution

## Related Plan

- `docs/dev/2026-04-20-p21-auth-write-scaling-plan.md`

## Goal

Move password hashing and verification off the main event loop so the auth/admin write path can scale beyond the current synchronous `scryptSync` ceiling.

## Execution Log

### Phase 1: Bottleneck Confirmation

Status:
- completed

Notes:
- confirmed the plateau is still isolated to password-sensitive write paths:
  - `POST /api/auth/login`
  - `POST /api/admin/users`
- confirmed the common code bottleneck was synchronous password work in `server/state-store.js`
- re-used the existing capacity evidence instead of reopening scope into session/rate-limit externalization

### Phase 2: Async Password Path

Status:
- completed

Notes:
- extracted password hashing and verification into `server/lib/passwords.js`
- kept the stored password format unchanged:
  - `salt:hash`
- added async `crypto.scrypt(...)` helpers for:
  - hashing
  - verification
- kept the synchronous helpers for seed/setup paths that still intentionally run inline
- added async state-store methods for password-sensitive work:
  - `authenticateUserAsync(...)`
  - `createUserAsync(...)`
  - `changeCurrentUserPasswordAsync(...)`
  - `resetUserPasswordAsync(...)`
- hardened failed-login accounting so async verification does not regress lockout correctness:
  - replaced the reset path with a dedicated reset statement
  - replaced the failure increment with an atomic SQL update

### Phase 3: Route Integration

Status:
- completed

Notes:
- updated the password-sensitive routes to `await` the async state-store helpers:
  - login
  - public register
  - self-service password change
  - invitation activation
  - password reset completion
  - admin create-user
  - admin password reset
- kept read-only routes untouched to avoid unnecessary churn

### Phase 4: Regression And Capacity Validation

Status:
- completed

Notes:
- passed focused validation:
  - `node test-auth-history.js`
  - `node test-state-maintenance.js`
- passed core regression:
  - `npm run test:regression-core`
- passed full release-core validation:
  - `npm run test:release-core`
- post-change capacity artifacts:
  - `test-artifacts/performance/capacity-baseline-1776672180867.json`
  - `test-artifacts/performance/capacity-baseline-1776672214788.json`
- final observed throughput from `npm run test:release-core`:
  - login low: `54.64/s`
  - login medium: `56.37/s`
  - admin create-user low: `54.95/s`
  - admin create-user medium: `56.8/s`
- compared with the previous documented plateau around `~17 req/s`, this phase materially improved the auth/admin write path without touching the broader persistence architecture

## Single-Task Closeout Review

### New Problems Found

- async password verification removes event-loop serialization, so failed-login counters could no longer rely on the old read-modify-write pattern
- direct browser visual refresh remains blocked separately in the current sandbox and was intentionally not mixed into this mainline

### Missed Edge Cases

- test/setup helpers still use direct state-store creation paths, so the synchronous password helpers had to remain available for controlled non-route flows
- password format compatibility had to remain stable to avoid forcing any user-credential migration in the same phase

### Fixes Applied

- introduced a dedicated password utility module with sync and async variants
- moved route-facing auth/write password work onto async `crypto.scrypt(...)`
- made failed-login increment/lock updates atomic at the SQL layer
- kept session invalidation and password-reset semantics unchanged while improving throughput
