# Production Gateway Hardening Execution Log

## Mainline

- Active phase: `P8 Production Entry / Gateway Hardening`
- Plan:
  - `docs/dev/2026-04-19-production-gateway-hardening-plan.md`

## Goal

Make the current server behave intentionally behind a future reverse proxy instead of relying on permissive defaults.

## Implementation

- Added shared request-security helpers in:
  - `server/lib/request-security.js`
- Added production-facing config support in:
  - `server/config.js`
- Added config-backed rules for:
  - `TRUST_PROXY`
  - `ALLOWED_ORIGINS`
  - `SESSION_COOKIE_SECURE`
  - `SESSION_COOKIE_SAME_SITE`
  - `HEALTHCHECK_PATH`
  - `CONTENT_SECURITY_POLICY`
- Tightened session cookie serialization by adding `Secure` support in:
  - `server/lib/http.js`
- Added canonical health route in:
  - `server/routes/system.js`
  - `server/route-meta.js`
- Hardened the main server entry in:
  - `server/index.js`
- Added:
  - origin-aware credential-safe CORS
  - explicit `origin_not_allowed` rejection for `/api/*`
  - security headers on static and API responses
  - HTTPS-aware `Strict-Transport-Security`
- Updated auth/session routes in:
  - `server/routes/state.js`
- Security-sensitive flows now:
  - use shared client IP parsing
  - respect trusted proxy mode
  - issue secure cookies when configured or when the trusted request protocol is HTTPS
- Updated local service management scripts:
  - `scripts/local-server-common.ps1`
  - `scripts/check-local-service.ps1`
  - `scripts/start-local-service.ps1`
- Local service health now targets:
  - `/api/health`
- Added dedicated gateway regression coverage in:
  - `test-security-gateway.js`
- Updated existing regression coverage in:
  - `test-failures.js`
  - `test-suite.js`
  - `test-regression.js`
- Added runbook/docs:
  - `docs/dev/2026-04-19-reverse-proxy-runbook.md`
  - `docs/dev/2026-04-19-production-env-matrix.md`

## Validation

Passed:

1. `node test-security-gateway.js`
2. `node test-failures.js`
3. `node test-auth-history.js`
4. `. 'D:\document\PowerShell\profile.ps1'; node test-regression.js --skip-live --port 18797`

Observed skip-live regression result:

- `12 / 12` passed
- added group:
  - `SecurityGateway`
- local service script validation passed on temporary port `18808`:
  - start
  - health/status via `/api/health`
  - stop
  - unhealthy-after-stop

## New Problems Surfaced During This Round

- The original `AuthHistory` rate-limit fixture assumed forwarded headers were always trusted.
- Once proxy trust became explicit, that test no longer created distinct client keys and falsely failed.
- The old local service health path only proved “HTML root loads”, not “API readiness is healthy”.

## Fixes Applied To Newly Surfaced Issues

- Updated the rate-limit test fixture to opt into `TRUST_PROXY=true` when it intentionally validates forwarded-IP behavior.
- Moved local service health probing from `/` to `/api/health`.
- Added dedicated gateway regression tests so proxy/security behavior is not left to incidental coverage.

## Missed Earlier Assumptions

- Earlier rounds assumed same-origin local use and did not explicitly separate:
  - browser origin policy
  - proxy trust
  - session cookie transport security
- “Backend is reachable” and “backend is healthy” were previously treated as the same thing.
- The existing Google Fonts dependency had to be reflected in the first CSP baseline instead of pretending the app was already self-contained.

## Remaining Limits

- CSP still allows inline styles because the current frontend uses runtime style mutation
- Google Fonts is still an external dependency
- separate-site frontend deployment is still not fully closed because there is no CSRF token layer yet
- this phase does not add proxy/load-balancer health aggregation across multiple app instances
