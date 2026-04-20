# Persistent Auth Rate-Limit Plan

## Mainline

- Active phase: `P14 Persistent Auth Rate-Limit Storage`

## Goal

Upgrade the current sensitive-route rate limiting from process-memory buckets to SQLite-backed storage so the guard survives server restarts and stays consistent with the rest of the product state model.

## Why This Phase Next

- real invitation/recovery delivery still needs external provider decisions and credentials
- the current user-facing auth baseline already depends on abuse controls
- the main remaining gap after `P13` is that the limiter still resets with process lifetime

## Scope

In scope for this round:

- add SQLite-backed rate-limit event storage
- move the existing sensitive auth/admin routes onto the persistent limiter
- keep the existing response contract unchanged
- add at least one restart-persistence automated test
- update `docs/dev` planning, execution, and archive documents

Out of scope for this round:

- real email/SMS delivery
- CAPTCHA or bot-detection products
- cross-machine distributed rate limiting
- frontend visual changes

## Selected Approach

Chosen approach:

- add a `rate_limit_events` table inside `server/state-store.js`
- expose one generic `consumeRateLimit(ruleName, bucketKey, config)` helper
- have `server/routes/state.js` call that helper for:
  - login
  - forgot-password
  - admin create-user
  - admin password reset

Rejected alternatives:

1. keep the in-memory limiter
   - too weak because restart clears the guard immediately
2. add a standalone JSON/file limiter
   - lower quality than SQLite
   - introduces separate concurrency and corruption risk

## Granular TODO

1. Re-read `server/routes/state.js` and list every route that currently uses the in-memory limiter.
2. Re-read `server/state-store.js` transaction helpers and decide the smallest consistent storage schema.
3. Add a new SQLite table for rate-limit events with cleanup-friendly indexes.
4. Add prepared statements for:
   - cleanup expired events
   - query active events for one rule/key/window
   - insert one event
5. Add one generic `stateStore.consumeRateLimit()` method.
6. Make the helper return the existing response shape:
   - `allowed`
   - `retryAfterSeconds`
7. Replace the in-memory limiter usage in `server/routes/state.js` with the state-store helper.
8. Remove any dead in-memory limiter code that becomes obsolete.
9. Extend `test-auth-history.js` so at least one sensitive route proves the limit survives a server restart when the same SQLite file is reused.
10. Re-run focused suites:
    - `node test-auth-history.js`
    - `node test-frontend-state.js`
    - `node test-page-markup.js`
11. Re-run browser smoke:
    - `node test-ui-flow-smoke.js --port 18797 --launch-server`
12. Re-run skip-live regression:
    - `. 'D:\\document\\PowerShell\\profile.ps1'; node test-regression.js --skip-live --port 18797`
13. If stable, re-run full regression:
    - `. 'D:\\document\\PowerShell\\profile.ps1'; node test-regression.js`
14. Update:
    - `docs/dev/2026-04-19-release-readiness-checklist.md`
    - `docs/dev/2026-04-19-user-facing-auth-rules.md`
    - `docs/dev/2026-04-19-dev-archive-index.md`
    - this round's execution log
15. Record:
    - new problems surfaced
    - missed earlier assumptions
    - remaining limits still deferred

## Acceptance

- sensitive auth/admin rate limits survive server restart when the same state DB is reused
- route-level 429 contracts stay unchanged
- focused auth tests and smoke tests stay green
- docs/dev clearly records the storage-model change and the remaining non-goals
