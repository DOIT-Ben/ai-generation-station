# Release Readiness Checklist

## Purpose

Provide one checklist for deciding whether the current build is ready for user-facing testing.

## Startup And Runbook

Current local frontend address:

- `http://localhost:18791`

Known startup notes:

- canonical local start:
  - `powershell -ExecutionPolicy Bypass -File .\scripts\start-local-service.ps1 -Port 18791`
- canonical local stop:
  - `powershell -ExecutionPolicy Bypass -File .\scripts\stop-local-service.ps1 -Port 18791`
- canonical local health:
  - `powershell -ExecutionPolicy Bypass -File .\scripts\check-local-service.ps1 -Port 18791`
- local runbook:
  - `docs/dev/2026-04-19-local-service-runbook.md`

## Required Test Gates

Run these before calling the build ready:

### Release-Core Gates

Use this as the default phase-end gate when browser automation is intentionally deferred or blocked by the current environment:

1. `npm run test:regression-core`
2. `npm run test:release-core`

### Full Browser-Assisted Gates

Run these in addition to the release-core lane before calling the build fully ready for user-facing testing:

1. `node test-style-contract.js`
2. `node test-page-markup.js`
3. `node test-frontend-state.js`
4. `node test-auth-history.js`
5. `node test-ui-flow-smoke.js --port 18797 --launch-server`
6. `node test-ui-visual.js --port 18797 --launch-server`
7. `node test-failures.js`
8. `node test-security-gateway.js`
9. `node test-capacity-baseline.js`
10. `. 'D:\document\PowerShell\profile.ps1'; node test-regression.js --skip-live --port 18797`
11. `. 'D:\document\PowerShell\profile.ps1'; node test-regression.js`

## Manual Review Gates

1. Run the checks in `docs/dev/2026-04-19-frontend-acceptance-matrix.md`
2. Verify anonymous, authenticated, and admin states
3. Verify light theme and dark theme
4. Verify session-expired recovery returns the UI to the auth gate
5. Verify admin create-user issues a temporary password and first-login forced reset
6. Verify self-service password change keeps the current session and invalidates stale credentials
7. Verify invitation issuance returns a usable local-preview link in local mode or a real delivery result in `resend` mode, and activation lands the user directly in the workspace
8. Verify invitation resend invalidates the older invitation token and returns a fresh delivery result
9. Verify invitation revoke invalidates the latest active invitation token and clears the admin user-list active-invitation state
10. Verify forgot-password request returns a generic success response and the reset link completes successfully
11. Verify admin create-user and admin update-user both enforce valid unique email values when email is provided
12. Verify repeated forgot-password bursts return `429` with `forgot_password_rate_limited`
13. Verify sensitive burst guards still apply after local service restart when the same `APP_STATE_DB` is reused
14. Verify the admin audit panel loads, filters, paginates, and shows an intentional empty state or the expected populated state after admin actions
15. Review any intentional visual-baseline refresh before accepting changed screenshots
16. Verify repeated login bursts return `429` with `login_rate_limited`
17. Verify repeated admin create-user bursts return `429` with `admin_user_create_rate_limited`
18. Verify repeated admin password-reset bursts return `429` with `admin_password_reset_rate_limited`
19. Verify successful admin create/disable/role-change/password-reset/invite/resend/revoke actions write audit records in SQLite and surface in the admin audit panel
20. Verify `/api/health` returns `200` locally and through the chosen proxy path
21. Verify proxy-facing responses include the baseline security headers and CSP
22. Verify disallowed API origins return `403` with `origin_not_allowed`
23. If a separate-site frontend is enabled, verify `GET /api/auth/csrf` succeeds only for the allowed frontend origin and sets an HttpOnly CSRF seed cookie
24. If a separate-site frontend is enabled, verify unsafe `/api/*` requests without `X-CSRF-Token` fail with `403` and a `csrf_*` reason
25. If a separate-site frontend is enabled, verify the frontend pages point at the intended API origin through the `aigs-api-base-url` meta setting
26. Review the latest capacity-baseline artifact and confirm the current auth/admin-write throughput is acceptable for the next user-testing round
27. Verify one backup can be created with `backup-app-state.ps1` and the manifest records the intended state/output scope
28. Verify one restore dry-run path or isolated restore rehearsal succeeds before calling the environment operationally safe
29. Verify prune policy removes old audit logs and old backup folders intentionally without touching `output\runtime`

## Support/Triage Notes

- sensitive request-burst guards are SQLite-backed for the current baseline
- they should survive restart when the same `APP_STATE_DB` is reused locally
- they are not yet a cross-machine distributed limiter

### Login Problems

- bad credentials:
  - expect `401`
  - user-facing copy: `账号或密码不正确`
- disabled account:
  - expect `403`
  - user-facing copy: `账号已被禁用，请联系管理员`
- temporary lockout:
  - expect `423`
  - user-facing copy: `账号已被临时锁定，请 15 分钟后重试`
- rate-limited login burst:
  - expect `429`
  - reason: `login_rate_limited`
  - user-facing copy: `登录尝试过于频繁，请稍后再试`
- rate-limited forgot-password burst:
  - expect `429`
  - reason: `forgot_password_rate_limited`
  - user-facing copy: `找回密码请求过于频繁，请稍后再试`

### Session Problems

- expired or invalid session:
  - expect `401`
  - reason: `session_expired`
  - user-facing copy: `登录状态已失效，请重新登录`
- password reset required:
  - expect `403`
  - reason: `password_reset_required`
  - user-facing copy: `请先修改临时密码后再继续使用`
- invalid invitation or reset link:
  - expect `404`
  - reason: `token_invalid`
  - user-facing copy:
    - `邀请链接无效或已失效`
    - `重置链接无效或已失效`
- disallowed API origin:
  - expect `403`
  - reason: `origin_not_allowed`
  - user-facing copy: `当前来源不被允许访问该接口`
- missing or stale CSRF bootstrap:
  - expect `403`
  - reason:
    - `csrf_seed_missing`
    - `csrf_required`
    - `csrf_invalid`
  - user-facing copy:
    - `安全校验已失效，请刷新页面后重试`
    - `请求缺少安全校验，请刷新页面后重试`
    - `安全校验失败，请刷新页面后重试`

### Admin Problems

- self-disable should be rejected
- self-demotion should be rejected
- last active admin removal should be rejected
- duplicate username creation should be rejected explicitly
- duplicate email creation or update should be rejected explicitly
- password reset should invalidate stale sessions for the target account
- admin-created users should enter the system with forced first-login password rotation
- invitation-issued users should be able to activate from a one-time link
- invitation resend should invalidate the previous active token
- invitation revoke should invalidate the latest active token immediately
- forgot-password preview links should fail cleanly once consumed or expired
- repeated forgot-password bursts should return `429`
- repeated create-user bursts should return `429`
- repeated password-reset bursts should return `429`
- successful create/disable/role-change/password-reset/invite/resend/revoke actions should be auditable
- audit-log retention should now be judged intentionally instead of assuming logs grow forever
- secure cookie behavior should be verified behind the real proxy
- audit logs should capture the real client IP when `TRUST_PROXY=true`
- auth/admin-write throughput is currently much lower than read-route throughput and should be judged explicitly

### Provider/API Problems

- if `MINIMAX_API_KEY` is missing, generation routes should return the existing configuration error
- this does not invalidate local UI structure tests, but it blocks real generation acceptance
- if `NOTIFICATION_DELIVERY_MODE=resend` but `NOTIFICATION_FROM_EMAIL` or `RESEND_API_KEY` is missing:
  - invitation sends should fail closed
  - forgot-password should keep the public response generic while delivery fails server-side

## Deferred Items

These are intentionally not part of this mainline:

- payment/billing
- SMS delivery
- cross-machine distributed rate-limit storage
- feature expansion beyond current tabs

## Ready / Not Ready Rule

Ready for user-facing testing only if:

1. required tests are green
2. manual acceptance matrix is complete
3. local startup path is known
4. auth/session/admin edge cases behave intentionally
5. temporary-password rotation behaves intentionally
6. abuse throttling and admin audit logging behave intentionally
7. gateway/origin/security-header behavior behaves intentionally
8. state backup/restore/prune behavior is documented and manually sanity-checked
9. separate-site browser CSRF behavior is intentional when cross-origin deployment is enabled

If any of these fail, the round is not ready.
