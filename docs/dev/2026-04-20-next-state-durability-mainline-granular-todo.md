# Next State Durability Mainline Granular TODO

## Purpose

Define the next recommended mainline after the auth/account/admin split, release-core normalization, email delivery, invitation lifecycle controls, and end-to-end browser flow hardening were all closed in the real repo.

This document is for direct execution order, not more open-ended strategy drift.

## Current Product Position

Already closed:

- dedicated auth/account/admin surfaces
- self-service password change
- invitation activation
- forgot/reset password recovery
- email identity baseline
- real email delivery baseline
- invitation resend/revoke operator controls
- browser smoke and release-core regression gates

Current state of the product:

- user/account/auth flows are now real enough to generate durable operational data
- SQLite is now carrying:
  - users
  - credentials
  - sessions
  - auth tokens
  - rate-limit events
  - history
  - tasks
  - audit logs
- the repo has startup/health scripts and a proxy baseline
- the repo does not yet have one deliberate operator baseline for:
  - backup
  - restore
  - retention/pruning
  - maintenance verification

## Recommendation

If only one next mainline is chosen, choose:

## P19 State Durability And Retention Baseline

Reason:

- the app has crossed from “feature prototype” into “real local/user-testing state”
- losing or bloating `APP_STATE_DB` is now a more immediate risk than adding another delivery feature
- current docs explicitly note:
  - no automated retention/pruning rule for audit logs
  - no backup/restore runbook for the real SQLite state
- SMS and provider failover are lower-value than recoverability and operator safety at the current maturity level

## Priority Order

1. `P19` state durability and retention baseline
2. `P20` separate-site browser security baseline
3. `P21` auth/write-path scaling and multi-node readiness
4. `P22` notification provider failover baseline

## Scope Guard

Keep these out of the next mainline unless the goal changes:

- SMS delivery
- MFA
- billing or payment
- full distributed microservice decomposition
- cross-region failover

---

## P19 TODO: State Durability And Retention Baseline

### Goal

Make the current single-node Node + SQLite product recoverable and maintainable instead of assuming the database and generated state live forever without operator care.

### Likely Files

- `server/state-store.js`
- `server/config.js`
- create `scripts/backup-app-state.ps1`
- create `scripts/restore-app-state.ps1`
- create `scripts/prune-app-state.ps1`
- maybe create `scripts/export-app-state-summary.ps1`
- maybe create `test-state-maintenance.js`
- `docs/dev/2026-04-19-local-service-runbook.md`
- `docs/dev/2026-04-19-production-env-matrix.md`
- `docs/dev/2026-04-19-release-readiness-checklist.md`
- `docs/dev/*`

### Granular TODO

1. Re-read `server/state-store.js` schema and cleanup helpers.
2. Inventory what already auto-cleans:
   - expired sessions
   - expired/used auth tokens
   - expired rate-limit events
3. Confirm the still-open maintenance gaps:
   - audit-log retention
   - operator backup
   - operator restore
   - backup pruning
   - generated-output retention policy
4. Decide the minimum P19 backup scope:
   - `APP_STATE_DB`
   - SQLite side files if present (`-wal`, `-shm`)
   - generated output directory if it is part of user-facing recovery scope
5. Decide whether backup requires the managed service to be stopped for this baseline.
6. Prefer an intentionally safe baseline over a “hot copy” guess if SQLite copy semantics would be ambiguous.
7. Define one backup directory contract:
   - timestamped folder
   - manifest file
   - source paths recorded
   - app version / commit recorded when available
8. Create a PowerShell backup script that validates all resolved paths before copying.
9. Create a restore script that:
   - validates the selected backup payload
   - refuses dangerous target paths
   - restores only the intended files
   - optionally restarts the local managed service
10. Decide the smallest acceptable retention baseline for audit logs.
11. Add one state-store maintenance helper for pruning audit logs older than a chosen age.
12. Decide whether the same maintenance command should also prune old backup folders.
13. Create a prune script for:
   - old backup folders
   - old audit logs
   - any intentionally prunable generated artifacts
14. Decide whether maintenance remains CLI-only in this phase.
15. Keep admin UI out of scope unless the operator burden proves too high.
16. Add focused tests for audit-log pruning behavior.
17. Add focused tests for maintenance helper safety and summary output where practical.
18. Add one operator-facing verification command or summary output after backup/restore/prune.
19. Run focused validation:
   - `node test-auth-history.js`
   - `node test-state-maintenance.js` if created
   - `npm run test:regression-core`
20. Run `npm run test:release-core` after any state-store change lands.
21. Update docs:
   - local-service runbook
   - production env matrix
   - release readiness checklist
   - execution log
22. Record:
   - what is still manual
   - what is intentionally not backed up
   - what retention windows were chosen and why

### Acceptance

- one safe backup command exists
- one safe restore command exists
- audit logs have an intentional prune path
- operator steps are documented and repeatable
- maintenance changes are regression-covered enough to trust for local/user-testing operations

---

## P20 TODO: Separate-Site Browser Security Baseline

### Goal

Close the explicitly documented “same-origin by default” security gap before supporting a separate-site frontend/API deployment model.

### Why It Comes After P19

- current local/user-testing risk is data durability, not separate-origin browser deployment
- gateway docs already call out the gap clearly:
  - no CSRF token layer yet for separate-site browser apps

### Minimum Scope

1. define whether separate-site browser deployment is actually required now
2. if yes, add a deliberate CSRF defense model
3. validate cookie/origin/CSRF behavior together
4. refresh proxy and release docs

---

## P21 TODO: Auth/Write-Path Scaling And Multi-Node Readiness

### Goal

Address the already-documented auth/admin-write throughput plateau only after durability and security baselines are intentional.

### Why It Comes After P20

- current throughput is acceptable for the present user-testing baseline
- the next scaling move is architectural, not a quick index tweak

### Minimum Scope

1. confirm whether the current throughput is actually insufficient
2. evaluate:
   - async password hashing/verification
   - auth worker isolation
   - external/shared state for multi-node rate limiting and sessions
3. choose one bounded scaling step instead of starting a broad rewrite

---

## P22 TODO: Notification Provider Failover Baseline

### Goal

Reduce single-provider email-delivery risk only after state durability, browser security posture, and auth-write scaling priorities are clarified.

### Why It Is Not Next

- current delivery already has:
  - `local_preview`
  - `resend`
  - `disabled`
- that is enough for the current user-testing phase
- failover is valuable, but it is not the tightest current risk

### Minimum Scope

1. define whether failover means:
   - second provider
   - queued retry
   - manual operator fallback
2. keep invitation fail-closed behavior explicit
3. keep forgot-password public response generic during provider failure

---

## Suggested Execution Order

If execution starts immediately on the next round, do this first:

1. write a dedicated `P19` plan in `docs/dev`
2. lock the minimal backup/restore/prune scope before touching code
3. implement backup safety first
4. implement restore safety second
5. implement audit-log retention/pruning third
6. run focused regression
7. update operator docs and close the phase with one execution log

## Current Recommendation In One Sentence

The next mainline should be `P19 State Durability And Retention Baseline`, because the product now has real operational data and still lacks a deliberate backup/restore/retention path.
