# Forgot-Password Throttle Hardening Execution Log

## Mainline

- Active phase: `P13 Forgot-Password Throttle Hardening`
- Plan:
  - `docs/dev/2026-04-19-forgot-password-throttle-hardening-plan.md`

## Goal

Close the remaining forgot-password abuse-control gap without reopening a broad auth refactor.

## Implementation

- Extended `server/config.js` with a dedicated forgot-password rate-limit contract:
  - `FORGOT_PASSWORD_RATE_LIMIT_MAX`
  - `FORGOT_PASSWORD_RATE_LIMIT_WINDOW_MS`
  - default baseline:
    - `6` requests
    - `10` minutes
- Updated `server/routes/state.js` so `POST /api/auth/forgot-password` now uses the shared sliding-window limiter before issuing or previewing reset links.
- Standardized the new throttle response contract:
  - HTTP `429`
  - reason `forgot_password_rate_limited`
  - message `找回密码请求过于频繁，请稍后再试`
  - `retryAfterSeconds`
  - `Retry-After`
- Extended `test-auth-history.js` with a dedicated forgot-password burst test.
  - confirms the first request succeeds
  - confirms the second request from the same client is throttled
  - confirms the throttle applies even when the second username does not exist, so the rule does not depend on account existence
- Tightened `test-ui-flow-smoke.js`.
  - forgot-password coverage now submits a real request
  - verifies the local preview URL is rendered
  - opens the preview link into the token-auth gate
  - confirms the expected username is shown before returning to the login gate

## Validation

Passed:

1. `node test-auth-history.js`
2. `node test-frontend-state.js`
3. `node test-page-markup.js`
4. `node test-ui-flow-smoke.js --port 18797 --launch-server`
5. `. 'D:\\document\\PowerShell\\profile.ps1'; node test-regression.js --skip-live --port 18797`
6. `. 'D:\\document\\PowerShell\\profile.ps1'; node test-regression.js`

Final result:

- focused validation is green
- skip-live regression is green at `12/12`
- full regression is green at `17/17`

## New Problems Surfaced During This Round

- Forgot-password throttling could not safely key only on username because callers can rotate identities, including unknown usernames, to dilute abuse controls.
- Browser smoke coverage for recovery was still too shallow; it only proved the gate could open and close, not that preview-link generation and token-gate handoff still worked.

## Fixes Applied To Newly Surfaced Issues

- Chose request-IP as the first dedicated forgot-password throttle key so the guard remains effective even when usernames vary.
- Expanded the UI smoke path to cover the real local-preview recovery handoff instead of only gate navigation.

## Missed Earlier Assumptions

- Earlier release closeout treated generic forgot-password success responses as enough for the user-facing baseline.
  - They were not enough because the endpoint still lacked a route-specific burst guard.
- Earlier smoke coverage treated recovery navigation as sufficient.
  - It was not sufficient once the recovery flow became part of the accepted user-facing path.

## Remaining Limits

- invitation and recovery delivery are still `local_preview`, not real email or SMS
- forgot-password throttling is still in-memory and process-local, not shared across multiple instances
- there is still no CAPTCHA, MFA, or email verification layer
