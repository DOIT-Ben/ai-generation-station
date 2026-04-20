# Production Environment Matrix

## Purpose

List the backend environment variables that matter for the current release candidate so later sessions do not rediscover deployment assumptions.

## Required

| Variable | Meaning | Recommended Production Value |
|---|---|---|
| `PORT` | backend listen port | internal service port, e.g. `18791` |
| `MINIMAX_API_KEY` | provider API key | real production key |
| `APP_USERNAME` | bootstrap admin username | non-default bootstrap admin |
| `APP_PASSWORD` | bootstrap admin password | strong non-default bootstrap admin password |
| `APP_STATE_DB` | SQLite state DB path | stable absolute path outside temp dirs |
| `TRUST_PROXY` | trust forwarded proxy headers | `true` |
| `SESSION_COOKIE_SECURE` | force `Secure` session cookies | `true` |
| `SESSION_COOKIE_SAME_SITE` | session cookie same-site policy | `Lax` |

## Strongly Recommended

| Variable | Meaning | Recommended Value |
|---|---|---|
| `ALLOWED_ORIGINS` | extra browser origins allowed to call `/api/*` | empty by default, or explicit comma-separated origins |
| `SESSION_TTL_MS` | session lifetime | keep current default unless product policy changes |
| `OUTPUT_DIR` | generated output path | stable mounted path |
| `HEALTHCHECK_PATH` | readiness endpoint | `/api/health` |
| `NOTIFICATION_DELIVERY_MODE` | invitation/recovery delivery mode | `resend` in real operator environments, `local_preview` only for local/dev |

## Optional Rate-Limit Overrides

| Variable | Meaning | Current Default |
|---|---|---|
| `LOGIN_RATE_LIMIT_MAX` | login burst budget | `30` |
| `LOGIN_RATE_LIMIT_WINDOW_MS` | login burst window | `300000` |
| `ADMIN_CREATE_USER_RATE_LIMIT_MAX` | admin create-user burst budget | `6` |
| `ADMIN_CREATE_USER_RATE_LIMIT_WINDOW_MS` | admin create-user burst window | `600000` |
| `ADMIN_PASSWORD_RESET_RATE_LIMIT_MAX` | admin password-reset burst budget | `10` |
| `ADMIN_PASSWORD_RESET_RATE_LIMIT_WINDOW_MS` | admin password-reset burst window | `600000` |

## Notification Delivery Variables

| Variable | Meaning | Recommended Value |
|---|---|---|
| `NOTIFICATION_DELIVERY_MODE` | delivery mode for invitation and password-reset flows | `resend` for real delivery, `local_preview` for local verification, `disabled` only for controlled fallback |
| `NOTIFICATION_FROM_EMAIL` | sender address used by the mail transport | stable product sender, e.g. `noreply@example.com` |
| `RESEND_API_KEY` | API key for the first real email provider | real provider key in production secrets |

## Current Delivery Recommendation

1. use `local_preview` for local debugging and browser automation
2. use `resend` for real operator and user-testing environments
3. avoid `disabled` except when email delivery is intentionally unavailable and operators understand the limitation

## Current CSP Baseline

Server default policy allows:

- scripts from self
- styles from self plus `https://fonts.googleapis.com`
- fonts from self plus `https://fonts.gstatic.com`
- images/media from self plus local `data:` / `blob:` usage already present in the app

## Do Not Forget

1. do not leave bootstrap defaults in any public-facing environment
2. do not enable `TRUST_PROXY=true` unless a real reverse proxy is actually supplying trusted forwarded headers
3. do not add extra origins unless there is a real browser entry point that requires them
4. if `SESSION_COOKIE_SAME_SITE=None` is ever chosen, keep `SESSION_COOKIE_SECURE=true`
5. do not enable `NOTIFICATION_DELIVERY_MODE=resend` without configuring both `NOTIFICATION_FROM_EMAIL` and `RESEND_API_KEY`
