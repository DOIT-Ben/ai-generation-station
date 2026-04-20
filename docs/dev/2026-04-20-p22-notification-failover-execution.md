# P22 Notification Provider Failover Execution

## Related Plan

- `docs/dev/2026-04-20-p22-notification-failover-plan.md`

## Goal

Add one bounded manual fallback path for notification-provider failure without diluting the existing invitation and forgot-password safety contracts.

## Execution Log

### Phase 1: Scope Lock

Status:
- completed

Notes:
- rejected second-provider integration for this round
- chose a manual operator fallback baseline instead

### Phase 2: Notification Failover Contract

Status:
- completed

Notes:
- added `NOTIFICATION_FAILOVER_MODE`
- supported values:
  - `none`
  - `local_preview`
- invitation delivery failures in `resend` mode can now return bounded fallback metadata for admins
- forgot-password keeps fallback metadata internal and stays generic on the public surface

### Phase 3: Focused Validation

Status:
- completed

Notes:
- passed:
  - `node test-auth-history.js`
  - `npm run test:regression-core`
- verified the new contract:
  - invitation delivery in `resend` mode still fails closed
  - `NOTIFICATION_FAILOVER_MODE=local_preview` adds a manual preview fallback for admin invitation failure responses
  - forgot-password stays generic and does not leak preview URLs during provider failure

## Single-Task Closeout Review

### New Problems Found

- the first implementation accidentally leaked the reset failover preview URL through the public forgot-password response
- baseline refresh alone was not enough to close the visual-regression carry-forward item; retired PNGs also needed explicit removal

### Missed Edge Cases

- notification-service fallback metadata can be safe for admin flows but unsafe for public flows, so route-level filtering still matters
- visual-regression artifact cleanup needed to be treated as a separate task from screenshot refresh

### Fixes Applied

- restricted the forgot-password route so it only exposes preview URLs when the effective delivery mode itself is `local_preview`
- added focused auth-history coverage for provider failure with `NOTIFICATION_FAILOVER_MODE=local_preview`
- closed the visual-regression carry-forward item by refreshing, validating, and pruning the baseline set
