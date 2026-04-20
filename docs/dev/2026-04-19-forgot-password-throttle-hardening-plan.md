# Forgot-Password Throttle Hardening Plan

## Mainline

- Active phase: `P13 Forgot-Password Throttle Hardening`

## Goal

Close the last explicitly documented abuse-control gap in the invitation/recovery flow by adding a dedicated rate limit for `POST /api/auth/forgot-password`, then back it with focused regression coverage and archive updates.

## Scope

In scope for this round:

- add a dedicated forgot-password rate-limit rule in server config
- enforce the rule in the public forgot-password route
- return a stable `429` reason and retry metadata
- add focused backend coverage for the new throttle path
- strengthen browser smoke coverage for the forgot-password happy path if the change stays low-cost
- update `docs/dev` archive, readiness notes, and execution log

Out of scope for this round:

- real email or SMS delivery
- CAPTCHA, MFA, or device fingerprinting
- distributed/shared rate-limit storage across multiple processes
- broader auth-flow redesign

## Working Assumptions

1. The minimal safe implementation is to reuse the existing in-memory sliding-window limiter already used by login and sensitive admin actions.
2. The client key should remain request-IP based for this first pass, because username-based keys would be too easy to rotate during enumeration attempts.
3. The frontend does not need a new surface for this change because the existing auth gate already renders backend error messages.

## Granular TODO

1. Re-read the current invitation/recovery docs and confirm the deferred item is still “forgot-password dedicated abuse throttling”.
2. Re-read `server/config.js` and `server/routes/state.js` to locate the existing rate-limit config contract and enforcement points.
3. Add a `forgotPassword` rate-limit config entry with explicit env var names and safe defaults.
4. Wire `POST /api/auth/forgot-password` into the shared sliding-window limiter.
5. Return a stable error contract for throttled forgot-password requests:
   - HTTP `429`
   - reason `forgot_password_rate_limited`
   - user-facing copy
   - `Retry-After`
6. Verify the throttle path does not leak account-existence details beyond the already accepted generic-success model for non-throttled requests.
7. Extend `test-auth-history.js` with focused forgot-password rate-limit assertions.
8. Tighten `test-ui-flow-smoke.js` so forgot-password covers at least one successful submit path instead of navigation-only coverage, if this remains low-risk.
9. Run focused validation:
   - `node test-auth-history.js`
   - `node test-frontend-state.js`
   - `node test-page-markup.js`
   - `node test-ui-flow-smoke.js --port 18797 --launch-server`
10. Run skip-live regression:
    - `. 'D:\\document\\PowerShell\\profile.ps1'; node test-regression.js --skip-live --port 18797`
11. Update:
    - `docs/dev/2026-04-19-release-readiness-checklist.md`
    - `docs/dev/2026-04-19-dev-archive-index.md`
    - this round's execution log
12. Record:
    - new problems surfaced
    - missed earlier assumptions
    - remaining limits still intentionally deferred

## Acceptance

- repeated forgot-password bursts return `429` with a stable reason and retry metadata
- the normal forgot-password response remains generic for both existing and unknown accounts when not throttled
- focused auth tests pass
- browser smoke still passes
- `docs/dev` reflects the new baseline and no longer lists forgot-password throttling as an open gap
