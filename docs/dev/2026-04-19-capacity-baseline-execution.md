# Capacity Baseline Execution Log

## Mainline

- Active phase: `P9 Capacity Baseline`
- Plan:
  - `docs/dev/2026-04-19-capacity-baseline-plan.md`

## Goal

Create one durable performance baseline for the current single-process Node + SQLite product before continuing productization work.

## Implementation

- Added repo-owned benchmark script:
  - `test-capacity-baseline.js`
- Added package entry:
  - `npm run test:capacity-baseline`
- Added ignored artifact path:
  - `test-artifacts/performance`
- Benchmark scope:
  - `POST /api/auth/login`
  - `GET /api/auth/session`
  - `POST /api/admin/users`
  - `GET /api/history/chat`
- Profiles:
  - low: `10` workers, `50` measured requests, `5` warm-up requests
  - medium: `50` workers, `150` measured requests, `10` warm-up requests

## Validation

Executed:

1. `node test-capacity-baseline.js --port 18820`

Artifact:

- `test-artifacts/performance/capacity-baseline-1776605145894.json`

Observed results:

### Low Profile

- login:
  - success: `100%`
  - mean: `553.29ms`
  - p95: `619.44ms`
  - throughput: `17.74/s`
- session:
  - success: `100%`
  - mean: `6.72ms`
  - p95: `9.46ms`
  - throughput: `1459.19/s`
- admin create user:
  - success: `100%`
  - mean: `567.59ms`
  - p95: `574.22ms`
  - throughput: `17.62/s`
- history read:
  - success: `100%`
  - mean: `5.33ms`
  - p95: `5.77ms`
  - throughput: `1844.13/s`

### Medium Profile

- login:
  - success: `100%`
  - mean: `2868.1ms`
  - p95: `2944.64ms`
  - throughput: `17.31/s`
- session:
  - success: `100%`
  - mean: `19.22ms`
  - p95: `22.82ms`
  - throughput: `2534.34/s`
- admin create user:
  - success: `100%`
  - mean: `2861.63ms`
  - p95: `2887.95ms`
  - throughput: `17.47/s`
- history read:
  - success: `100%`
  - mean: `25.39ms`
  - p95: `27.83ms`
  - throughput: `1926.07/s`

## New Problems Surfaced During This Round

- The first benchmark run falsely reported `0%` success for admin create-user because the generated usernames exceeded the existing 32-character validation rule.
- Capacity behavior split sharply between:
  - read/light session routes
  - password-hash/admin-write routes

## Fixes Applied To Newly Surfaced Issues

- Shortened benchmark-generated usernames so the write-path scenario measures real persistence work instead of request validation failures.
- Re-ran the full benchmark after fixing the request generator.

## Missed Earlier Assumptions

- “Current regressions are green” did not say anything about how auth and admin-write flows behave under concurrent pressure.
- The existing index set was already good enough for current read paths; the dominant bottleneck did not come from lookup shape.
- Password-hash heavy flows and read-only flows should not be discussed as one undifferentiated capacity number.

## Remaining Limits

- No additional SQLite index change is justified from this baseline yet.
- Current login and admin-create throughput plateaus around `17 req/s` locally under both low and medium concurrency.
- The shared bottleneck is most likely the synchronous password-hash / credential path:
  - `crypto.scryptSync`
  - synchronous SQLite work in the same event loop
- Read-heavy routes remain fast enough for the current single-node baseline.
- There is still no automated retention/pruning rule for audit logs.
- If this product needs materially higher concurrent auth/admin-write throughput later, the likely follow-up is not “add another index”; it is:
  - async password verification/hashing path
  - separated auth worker/process strategy
  - or a broader auth architecture change
