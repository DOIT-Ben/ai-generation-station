# P22 Notification Provider Failover Plan

## Mainline

- active phase: `P22 notification provider failover baseline`
- parent TODO:
  - `docs/dev/2026-04-20-next-state-durability-mainline-granular-todo.md`

## Goal

Reduce the current single-provider email-delivery risk without expanding into a second-provider integration or a background queue system.

## Current State

The repo already supports:

- `local_preview`
- `resend`
- `disabled`

Current behavior is intentional but limited:

- invitation issuance fails closed when provider delivery fails
- forgot-password stays generic when provider delivery fails
- there is no bounded operator fallback when the only real provider is down

## Chosen Scope

Choose the smallest bounded failover step:

- add an explicit manual operator fallback mode for provider failure

Implementation boundary:

- new config flag:
  - `NOTIFICATION_FAILOVER_MODE`
- supported values:
  - `none`
  - `local_preview`

## Behavior Contract

### Invitation Issuance

When `NOTIFICATION_DELIVERY_MODE=resend` and provider delivery fails:

- keep the response fail-closed
- keep `reason=notification_delivery_failed`
- if `NOTIFICATION_FAILOVER_MODE=local_preview`, also return:
  - `fallbackMode=local_preview`
  - a local preview URL that the admin can manually hand off

This gives operators a recovery path without pretending email delivery succeeded.

### Forgot Password

When `NOTIFICATION_DELIVERY_MODE=resend` and provider delivery fails:

- keep the public response generic
- do not expose the failover preview URL in the public API response
- preserve the existing anti-enumeration contract

## Explicitly Out Of Scope

- second real provider integration
- queued retries
- async delivery worker
- operator UI redesign
- automatic user-visible fallback from real email to preview mode

## Files

- `server/config.js`
- `server/index.js`
- `server/lib/notifications.js`
- `server/routes/state.js`
- `test-auth-history.js`
- `docs/dev/*`

## Execution Order

1. add failover-mode config parsing
2. extend the notification service with bounded failover metadata
3. expose manual fallback only on admin invitation failure responses
4. keep forgot-password generic even when fallback metadata exists internally
5. add focused regression coverage for the new contract
6. run:
   - `node test-auth-history.js`
   - `npm run test:regression-core`
7. update docs and archive notes

## Acceptance

- provider failure no longer leaves admins without an intentional recovery path
- invitation delivery still fails closed
- forgot-password still does not leak preview URLs during provider failure
- the new failover behavior is regression-covered and documented
