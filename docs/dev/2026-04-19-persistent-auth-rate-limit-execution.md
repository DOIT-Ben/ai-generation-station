# Persistent Auth Rate-Limit Execution Log

## Mainline

- Active phase: `P14 Persistent Auth Rate-Limit Storage`
- Plan:
  - `docs/dev/2026-04-19-persistent-auth-rate-limit-plan.md`

## Goal

Move sensitive-route rate limiting off process memory and into the shared SQLite state layer so the guard survives restart and matches the product's existing persistence model.

## Implementation

- Added SQLite-backed rate-limit storage in `server/state-store.js`.
  - new `rate_limit_events` table
  - cleanup index by expiry
  - lookup index by `rule_name + bucket_key + created_at`
- Added a generic `stateStore.consumeRateLimit(ruleName, bucketKey, config)` helper.
  - returns the same route-facing contract as before:
    - `allowed`
    - `retryAfterSeconds`
  - deletes expired events before each check
  - inserts a new event only when the current request is allowed
- Removed the in-memory sliding-window limiter from `server/routes/state.js`.
- Switched these routes to the persistent helper:
  - login
  - forgot-password
  - admin create-user
  - admin password reset
- Extended `test-auth-history.js` with a restart-persistence assertion.
  - first server instance writes a forgot-password rate-limit event
  - second server instance reuses the same SQLite file
  - second request is still throttled after restart

## Validation

Passed:

1. `node test-auth-history.js`
2. `node test-frontend-state.js`
3. `node test-page-markup.js`
4. `node test-ui-flow-smoke.js --port 18797 --launch-server`
5. `. 'D:\\document\\PowerShell\\profile.ps1'; node test-regression.js --skip-live --port 18797`
6. `node test-capacity-baseline.js --port 18820`
7. `. 'D:\\document\\PowerShell\\profile.ps1'; node test-regression.js`

Final result:

- focused validation is green
- skip-live regression is green at `12/12`
- full regression is green at `17/17`
- latest capacity artifact:
  - `test-artifacts/performance/capacity-baseline-1776611645831.json`
- latest capacity snapshot:
  - login throughput remains around `16.8-16.98/s`
  - admin create-user throughput remains around `17.05-17.41/s`
  - session/history read throughput remains in the high-hundreds to low-thousands per second

## New Problems Surfaced During This Round

- The old in-memory limiter was not just process-local; it also duplicated data-lifecycle logic already solved elsewhere in `state-store`.
- Once rate limiting became SQLite-backed, auth/admin write throughput needed an explicit recheck because every allowed burst-guarded request now adds one DB write.

## Fixes Applied To Newly Surfaced Issues

- Consolidated sensitive-route burst limiting into the existing SQLite state model instead of adding a second persistence mechanism.
- Re-ran the capacity baseline to confirm the new write path stayed in the previously accepted throughput band.

## Missed Earlier Assumptions

- Earlier security hardening implicitly assumed “route-level 429 behavior exists” was enough.
  - It was not enough because restart immediately cleared the protection window.
- Earlier forgot-password hardening closed the route-specific gap but still inherited the old process-lifetime storage model.
  - That left recovery abuse controls weaker than the rest of the persisted auth state.

## Remaining Limits

- invitation and recovery delivery are still `local_preview`, not real email or SMS
- rate-limit sharing now works across restarts and processes only when they reuse the same SQLite state DB
- there is still no cross-machine distributed limiter, CAPTCHA, MFA, or email verification layer
