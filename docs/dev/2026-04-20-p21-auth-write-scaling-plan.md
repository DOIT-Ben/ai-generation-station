# P21 Auth Write-Path Scaling Plan

## Mainline

- active phase: `P21 auth/write-path scaling and multi-node readiness`
- parent TODO:
  - `docs/dev/2026-04-20-next-state-durability-mainline-granular-todo.md`

## Goal

Take one bounded scaling step against the already-documented auth/admin-write throughput plateau without expanding into a distributed-session rewrite.

## Current Bottleneck

From the existing capacity artifacts and code audit:

- login and admin create-user plateau around `~17 req/s`
- session/history read routes remain far higher
- the common hot path is synchronous password work inside the main event loop:
  - `crypto.scryptSync(...)` in `server/state-store.js`
  - synchronous verification during login
  - synchronous hashing during:
    - admin create-user
    - public register
    - password change
    - invitation activation
    - password reset completion
    - admin password reset

## Chosen P21 Scope

Choose exactly one scaling move in this phase:

- replace synchronous password hashing/verification with async `crypto.scrypt(...)`

Why this step:

- directly targets the measured plateau
- keeps the SQLite persistence model intact
- improves write-path concurrency without forcing:
  - shared-cache/session redesign
  - external distributed rate-limit storage
  - multi-process auth service extraction

## Explicitly Out Of Scope

- Redis or other external session/rate-limit storage
- cross-machine shared limiter/session coordination
- dedicated auth microservice or worker process
- MFA, CAPTCHA, or broader anti-abuse redesign
- browser/UI changes

## Design Notes

### Password Service

Create a small password utility that exposes:

- `hashPassword(...)`
- `verifyPassword(...)`
- async variants backed by `crypto.scrypt(...)`

Keep the stored password format unchanged:

- `salt:hash`

This avoids data migration and keeps backward compatibility with existing users.

### State Store Contract

Introduce async write/auth helpers for the password-sensitive paths:

- `authenticateUser(...)` becomes async
- `createUser(...)` becomes async
- `changeCurrentUserPassword(...)` becomes async
- `resetUserPassword(...)` becomes async

Keep read-only state-store helpers synchronous.

### Login Failure Accounting

Async verification introduces concurrency that the old event-loop-serialized logic did not have.

So this phase must also harden failed-login tracking:

- replace the read-modify-write failure increment with an atomic SQL update
- keep lockout behavior unchanged:
  - threshold `5`
  - lock duration `15 minutes`

### Route Surface

Update only the route handlers that depend on password work so they `await` the new async state-store helpers.

## Execution Order

1. extract password hash/verify helpers into a dedicated module
2. add async password helpers using `crypto.scrypt(...)`
3. convert password-sensitive state-store methods to async
4. make failed-login increment/lock atomic
5. update auth/admin routes to await the new helpers
6. extend or adjust focused tests if any sync assumptions break
7. run:
   - `node test-auth-history.js`
   - `node test-capacity-baseline.js`
   - `npm run test:regression-core`
8. compare post-change throughput against the documented `~17 req/s` baseline
9. record remaining multi-node limits that are still intentionally deferred

## Acceptance

- password storage format remains unchanged
- auth/admin password-sensitive routes continue to pass regression tests
- login lockout behavior remains correct
- capacity baseline shows the write-path no longer pinned to the old synchronous plateau, or the result is explicitly documented if improvement is smaller than expected
- docs record what this phase improved and what it still did not address
