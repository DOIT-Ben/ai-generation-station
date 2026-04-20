# Security Abuse-Control Baseline Plan

## Mainline

- Active phase: `P7 Security / Abuse-Control Baseline`
- Source TODO:
  - `docs/dev/2026-04-19-post-p0-p2-next-granular-todo.md`

## Goal

Add the smallest backend safety baseline required before broader user-facing testing:

1. request-rate protection for the most abuse-prone auth/admin routes
2. durable audit logging for sensitive admin account actions
3. explicit regression coverage for both paths

## Chosen Scope

This phase intentionally stays narrow.

Included:

- login route request limiting
- admin create-user request limiting
- admin reset-password request limiting
- SQLite-backed audit logs for:
  - user creation
  - user disable
  - role change
  - password reset
- focused automated tests
- release/readiness/doc updates

Not included in this phase:

- distributed or proxy-backed global rate limiting
- CAPTCHA / email verification / forgot-password
- frontend audit-log UI
- comprehensive security headers / CSP hardening

## Chosen Approach

### Rate Limiting

Use an in-process sliding-window limiter owned by `server/routes/state.js`.

Reason:

- the current product is still single-process and local-first
- this is enough to stop obvious burst abuse without introducing Redis or cross-process coordination
- keeping the limiter near the auth/admin routes makes the first baseline easy to test and reason about

Planned keys:

- login:
  - keyed by client IP
- admin create user:
  - keyed by authenticated admin user id
- admin reset password:
  - keyed by authenticated admin user id

Planned behavior:

- return `429`
- return explicit localized error copy
- include `reason`
- include `retryAfterSeconds`
- include `Retry-After` response header

### Audit Logging

Use a new SQLite table in `server/state-store.js`.

Reason:

- audit data should survive process restart
- the state store is already the canonical persistence layer for user/account state
- later admin UI or export tooling can reuse the same table without redesign

Planned audit fields:

- event id
- action
- actor user id
- target user id
- actor username snapshot
- target username snapshot
- actor role snapshot
- target role snapshot
- actor IP
- actor user agent
- details JSON
- created timestamp

## Planned Deliverables

1. `docs/dev/2026-04-19-security-abuse-baseline-plan.md`
2. `docs/dev/2026-04-19-security-abuse-baseline-execution.md`
3. backend rate-limit support for the three scoped routes
4. SQLite audit-log table plus state-store helpers
5. auth/admin regression updates
6. release-readiness and dev-archive updates

## Validation Plan

1. verify login route returns `429` after repeated attempts from the same client key
2. verify admin create-user route returns `429` after repeated requests from the same admin
3. verify admin reset-password route returns `429` after repeated requests from the same admin
4. verify successful admin actions write expected audit events
5. run:
   - `node test-auth-history.js`
   - `node test-failures.js`
   - `. 'D:\document\PowerShell\profile.ps1'; node test-regression.js --skip-live --port 18797`

## Known Limits

- rate limits reset on process restart
- rate limits are not shared across multiple server instances
- audit logs are stored, but not yet exposed in the frontend
