# User-Facing Auth Rules

## Purpose

Define the account and session behavior that the product must follow for the current user-facing baseline.

This document exists because the current auth flow already supports login and persistence, but several important states were still implicit in the code instead of explicitly defined as product behavior.

## User States

## Identity Rules

- `username` remains the primary login identifier for the current baseline
- `email` is now a first-class account attribute for admin-managed users
- email may still be empty in this phase
- when email is provided it must:
  - be normalized to lowercase
  - pass format validation
  - remain unique across active users

### 1. Anonymous

Meaning:

- the browser has no valid session
- user has not logged in yet

Backend:

- `GET /api/auth/session` returns `401`
- payload includes `authenticated: false`
- reason is `anonymous`

Frontend:

- auth gate is visible
- main app is locked behind the gate
- top-right area shows only the login button

### 2. Authenticated User

Meaning:

- valid session
- non-admin account
- account is not waiting on temporary-password rotation

Backend:

- `GET /api/auth/session` returns `200`
- payload includes `mustResetPassword: false`

Frontend:

- auth gate hidden
- top-right shows username, role, plan, and logout utility action
- admin panel remains hidden

### 3. Authenticated Admin

Meaning:

- valid session
- admin role
- account is not waiting on temporary-password rotation

Backend:

- `GET /api/auth/session` returns `200`
- admin routes remain accessible
- payload includes `mustResetPassword: false`

Frontend:

- auth gate hidden
- admin panel visible
- admin user actions visible

### 4. Password Reset Required

Meaning:

- user has authenticated successfully
- current password is still a temporary password
- the account must rotate credentials before normal product access resumes

Backend:

- `POST /api/auth/login` may return `200` with:
  - `mustResetPassword: true`
- `GET /api/auth/session` may return `200` with:
  - `mustResetPassword: true`
- protected app routes return `403`
- payload reason is `password_reset_required`
- message is `请先修改临时密码后再继续使用`

Frontend:

- auth gate stays hidden because the session is valid
- forced-reset overlay gate becomes visible
- normal workspace interactions stay blocked until password change succeeds

### 5. Disabled User

Meaning:

- account exists
- account status is `disabled`

Backend:

- login attempt returns `403`
- payload reason is `user_disabled`
- message is `账号已被禁用，请联系管理员`

Frontend:

- auth gate stays visible
- form error shows the backend message
- app does not partially unlock

### 6. Temporarily Locked Login

Meaning:

- repeated failed login attempts triggered a temporary lock

Backend:

- login attempt returns `423`
- payload reason is `login_locked`
- message is `账号已被临时锁定，请 15 分钟后重试`

Frontend:

- auth gate stays visible
- form error shows the backend message
- app does not partially unlock

### 7. Expired Or Invalid Session

Meaning:

- browser still has a stale cookie or invalid token
- the backend no longer accepts it as a valid session

Backend:

- authenticated routes return `401`
- payload reason is `session_expired`
- message is `登录状态已失效，请重新登录`
- stale cookie should be cleared when practical

Frontend:

- local authenticated state is cleared immediately
- auth gate becomes visible again
- top-right area reverts to login state
- user sees a clear message instead of a silent failure

### 8. Disabled Session Owner

Meaning:

- the user had a session, but the account is no longer active

Backend:

- authenticated routes return `401`
- payload reason is `user_disabled`
- message is `账号已被禁用，请联系管理员`

Frontend:

- local authenticated state is cleared
- auth gate becomes visible
- user sees the backend message

## Login Rules

### Bad Credentials

- return `401`
- keep the message generic:
  - `账号或密码不正确`

### Disabled Account

- return `403`
- return an explicit user-disabled message

### Temporary Lockout

- return `423`
- return an explicit temporary-lock message
- the lockout threshold for the current baseline is five consecutive failures

### Login Request Rate Limit

- return `429`
- reason:
  - `login_rate_limited`
- message:
  - `登录尝试过于频繁，请稍后再试`
- response must also include:
  - `retryAfterSeconds`
  - `Retry-After` header
- this is a request-burst guard, separate from the per-account failed-password lockout

## Rate-Limit Storage Model

- sensitive request-burst guards are SQLite-backed for the current baseline
- this includes:
  - login
  - forgot-password
  - admin create-user
  - admin password reset
- these guards should survive server restart when the same `APP_STATE_DB` is reused
- the current design is still not a cross-machine distributed limiter

## Session Rules

### Creation

- successful login creates a cookie-backed session
- the current server TTL remains the configured `SESSION_TTL_MS`
- successful login and session reload both expose `mustResetPassword`

### Expiry

- expired or invalid sessions must not leave the frontend half-authenticated
- the frontend must reset local auth state when a protected request returns `401`

### Logout

- logout clears the server session when possible
- logout also clears local authenticated state even if the logout request itself fails

### Temporary-Password Enforcement

- protected routes must reject access while `mustResetPassword` is still true
- the password-change endpoint must remain available during this state
- forced-reset users are authenticated, but not yet ready for normal workspace access

## Recovery Rules

### Invitation Activation

- `GET /api/auth/invitation` validates a one-time invitation token
- invalid, expired, or consumed invitation tokens return:
  - `404`
  - reason `token_invalid`
- `POST /api/auth/invitation/activate` must:
  - accept a real new password
  - clear `mustResetPassword`
  - invalidate old sessions for the target account
  - establish one fresh authenticated session

### Forgot-Password Request

- `POST /api/auth/forgot-password` remains a public route
- when the request is not throttled, the response must stay generic for both:
  - existing accounts
  - unknown accounts
- the delivery surface now supports:
  - `local_preview`
  - `resend`
  - `disabled`
- only `local_preview` returns a preview link on the public surface
- `resend` returns the same generic success contract without exposing preview URLs
- when provider delivery fails in `resend` mode:
  - the server logs the failure
  - the public response still stays generic

Rate-limit response:

- `429`
- reason:
  - `forgot_password_rate_limited`
- message:
  - `找回密码请求过于频繁，请稍后再试`
- response should also include:
  - `retryAfterSeconds`
  - `Retry-After` header

### Password-Reset Completion

- `GET /api/auth/password-reset` validates a one-time reset token
- invalid, expired, or consumed reset tokens return:
  - `404`
  - reason `token_invalid`
- `POST /api/auth/password-reset/complete` must:
  - accept a real new password
  - clear `mustResetPassword`
  - invalidate prior sessions for the target account
  - establish one fresh authenticated session

## Notification Delivery Rules

### Invitation Delivery

- invitation issuance may run in:
  - `local_preview`
  - `resend`
  - `disabled`
- `local_preview` returns a usable preview URL
- `resend` must send a real email when the target user has an email address
- `disabled` must reject invitation sending explicitly
- when real delivery is enabled but the target account has no email:
  - return `409`
  - message:
    - `目标账号未设置邮箱地址`
- when the provider returns an error while issuing an invitation:
  - fail closed
  - return `notification_delivery_failed`

### Forgot-Password Delivery

- forgot-password keeps the public success response generic across all modes
- `local_preview` may return a preview URL for local operator testing
- `resend` should attempt real email delivery when the target account has an email address
- when real delivery fails during forgot-password:
  - keep the public success response generic
  - log the delivery failure server-side

## Invitation Operator Rules

### Issue Invitation

- admins may issue an invitation for an active account
- successful issuance creates exactly one active invitation token for that user
- issuing a new invitation invalidates any older unused invitation token

### Resend Invitation

- admins may resend only when a user currently has an active invitation
- resend must mint a fresh token
- resend must invalidate the previous active invitation token immediately
- resend must use the same delivery-mode rules as normal invitation issuance

Recommended no-active-invite response:

- `409`
- message:
  - `当前账号没有可重发的邀请链接，请先签发邀请`

### Revoke Invitation

- admins may revoke an active invitation intentionally
- revocation must invalidate the latest active invitation token immediately
- once revoked, the user should show no active invitation state in the admin surface

Recommended no-active-invite response:

- `409`
- message:
  - `当前账号没有可撤销的邀请链接`

## Admin Safety Rules

### Self-Protection

The currently logged-in admin may not:

- disable self
- demote self from `admin` to `user`

Reason:

- UI affordances are not enough; backend must prevent these cases

### Last Active Admin Protection

The backend must reject any admin mutation that would leave the system without at least one active admin.

This includes:

- disabling the last active admin
- demoting the last active admin to `user`

Recommended response:

- `409`
- message:
  - `至少保留一个启用中的管理员`

## Admin Account Operations

### Create User

- only admins may create users
- the first real user path is admin-created accounts only
- duplicate usernames must be rejected explicitly
- duplicate emails must also be rejected explicitly
- new users are created active by default unless a later phase adds a different onboarding path
- admin-created users enter the system with `mustResetPassword: true`
- the issued password is an initial temporary credential, not the final steady-state password

Recommended duplicate response:

- `409`
- message:
  - `用户名已存在`
  - `邮箱已存在`

Rate-limit response:

- `429`
- reason:
  - `admin_user_create_rate_limited`
- message:
  - `创建用户操作过于频繁，请稍后再试`
- response should also include:
  - `retryAfterSeconds`
  - `Retry-After` header

### Reset Password

- only admins may reset a user's password
- reset password must require a real new password payload
- reset password must invalidate the target user's prior sessions intentionally
- if the current admin resets their own password from the active admin session, the current session may remain valid for continuity while other sessions are cleared
- resetting another user's password must put that target back into `mustResetPassword: true`

Recommended validation response:

- `400`
- message:
  - `密码至少需要 8 位`

Rate-limit response:

- `429`
- reason:
  - `admin_password_reset_rate_limited`
- message:
  - `重置密码操作过于频繁，请稍后再试`
- response should also include:
  - `retryAfterSeconds`
  - `Retry-After` header

### Email Maintenance

- admins may set or clear a user's email through the normal admin user patch route
- invalid email payloads should return:
  - `400`
  - `请输入有效邮箱地址`
- duplicate email payloads should return:
  - `409`
  - `邮箱已存在`

## Admin Audit Rules

The backend must durably record the following successful admin actions:

- create user
- disable user
- role change
- password reset
- invite issue
- invite resend
- invite revoke

Each audit record should capture:

- actor user id / username / role snapshot
- target user id / username / role snapshot
- actor IP and user-agent snapshot when available
- action-specific details JSON
- creation timestamp

For the current baseline, audit data is SQLite-backed and stored server-side even though there is not yet a dedicated frontend viewer.

### Self-Service Password Change

- logged-in users may change their own password through `POST /api/auth/change-password`
- current password is required
- new password must satisfy the same minimum-length rule
- the current session may remain valid
- other sessions for that user should be invalidated
- a successful self-change clears `mustResetPassword`

## Bootstrap Account Rule

For the current baseline, the seeded `studio` account remains acceptable only as a bootstrap/admin setup account for local or controlled environments.

It must not be described like a normal production credential set.

Frontend copy should treat it as:

- bootstrap account
- guide/demo entry
- local setup credential
- initialization-only admin credential

Not as:

- permanent default public account

## Frontend Rendering Rules

1. Auth gate copy must stay understandable and short.
2. Disabled and locked states must display backend-provided messages directly.
3. Session-expired recovery must happen automatically when a protected request returns `401`.
4. Top-right account state must never remain visible after the session is invalidated.
5. Password-reset-required sessions must lock the workspace with a dedicated overlay instead of silently failing.

## Implementation Targets

The following files must align with this ruleset:

- `server/state-store.js`
- `server/routes/state.js`
- `public/js/app-shell.js`
- `public/js/app.js`
- `test-auth-history.js`
