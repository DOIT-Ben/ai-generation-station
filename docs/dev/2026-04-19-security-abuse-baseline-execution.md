# Security Abuse-Control Baseline Execution Log

## Mainline

- Active phase: `P7 Security / Abuse-Control Baseline`
- Plan:
  - `docs/dev/2026-04-19-security-abuse-baseline-plan.md`

## Goal

Close the minimum remaining security gap before broader user-facing testing by adding abuse throttling and durable admin-action traceability.

## Implementation

- Added configurable route-level rate limits in:
  - `server/config.js`
  - `server/index.js`
  - `server/routes/state.js`
- Added a sliding-window limiter for:
  - `POST /api/auth/login`
  - `POST /api/admin/users`
  - `POST /api/admin/users/:id/password`
- Current default budgets:
  - login: `30 / 5 minutes / client IP`
  - admin create user: `6 / 10 minutes / admin user`
  - admin password reset: `10 / 10 minutes / admin user`
- Added explicit `429` responses with:
  - localized error copy
  - `reason`
  - `retryAfterSeconds`
  - `Retry-After` header
- Added SQLite-backed audit storage in:
  - `server/state-store.js`
- Added audit events for:
  - `user_create`
  - `user_disable`
  - `user_role_change`
  - `user_password_reset`
- Added transactional audit persistence so successful admin mutations and their audit entries commit together inside the state store.
- Extended `test-auth-history.js` to cover:
  - audit-log persistence assertions
  - login rate limiting
  - admin create-user rate limiting
  - admin password-reset rate limiting

## Validation

Passed:

1. `node test-auth-history.js`
2. `node test-failures.js`
3. `. 'D:\document\PowerShell\profile.ps1'; node test-regression.js --skip-live --port 18797`

Observed regression result:

- `11 / 11` passed in skip-live mode

## New Problems Surfaced During This Round

- The first limiter draft stored `windowMs` on an array object, which worked but was too implicit and easy to misread.
- A tighter default login limit would have falsely failed the existing account-lifecycle regression because that suite intentionally performs many login transitions in one run.
- Audit logging added a new consistency risk: if logging happened after the mutation outside a transaction, the system could succeed functionally but lose traceability on partial failure.

## Fixes Applied To Newly Surfaced Issues

- Refactored the limiter bucket shape to an explicit object with `windowMs` and `timestamps`.
- Widened the default login request budget while keeping focused low-threshold override coverage in tests.
- Moved audit persistence into state-store transactions for create-user, update-user, and reset-password flows.

## Missed Earlier Assumptions

- Earlier account hardening work covered credential rotation and account lockout, but it still lacked request-rate controls for burst abuse.
- “We already lock failed logins per account” was not enough, because that does not protect admin routes or broad IP-based request floods.
- Admin actions were functionally safe, but not yet operationally traceable.

## Remaining Limits

- request-rate limits are still in-process only and reset on server restart
- multi-instance/shared-store rate limiting is not solved in this phase
- there is still no frontend audit-log viewer
- broader production hardening is still deferred:
  - CSP/security headers
  - forgot-password flow
  - invitation onboarding
  - external proxy/WAF rate limiting
