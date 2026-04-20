# State Durability And Retention Plan

## Background

- auth/account/admin/user-testing flows are now backed by real SQLite state
- the product now persists:
  - users
  - sessions
  - auth tokens
  - rate-limit events
  - history
  - tasks
  - audit logs
- current docs already call out missing operator safeguards:
  - no backup/restore runbook for the real app state
  - no automated retention/pruning rule for audit logs

## Goal

Close the minimum operator-safety gap by adding one safe local baseline for:

1. backup
2. restore
3. pruning old state
4. documenting the maintenance path

## Scope Decision

This phase stays intentionally narrow.

Include:

- `APP_STATE_DB`
- SQLite side files when present:
  - `-wal`
  - `-shm`
- generated user-facing output under `OUTPUT_DIR`

Exclude:

- `output/runtime`
  - process logs and PID files
- browser screenshots and performance artifacts outside the configured output/state scope
- admin UI for maintenance actions

## Design Choice

Use a split implementation:

1. PowerShell scripts own:
   - path validation
   - file copy / restore
   - local service stop/start coordination
2. Node/state-store owns:
   - resolved config lookup
   - audit-log pruning
   - maintenance summary data usable by scripts and tests

Why:

- PowerShell is the right place for local operator filesystem control
- the existing Node config already knows the true resolved app paths
- testing retention behavior is much easier in JS than in shell

## Execution Order

### Phase 1: Maintenance Contract

1. add one shared maintenance helper path for resolved config and safe path validation
2. define backup directory layout and manifest fields
3. define retention defaults for:
   - audit logs
   - backup folders

Acceptance:

- one stable maintenance contract exists before copy logic is written

### Phase 2: Backup / Restore Scripts

1. add backup script
2. add restore script
3. support optional local managed-service stop/start around copy operations
4. emit clear summary output after each operation

Acceptance:

- backup creates a timestamped payload with manifest
- restore validates payload structure before touching live files

### Phase 3: Retention / Prune Support

1. add state-store audit-log prune helper
2. add prune script for:
   - old backup folders
   - old audit logs
3. add summary output for affected counts

Acceptance:

- audit logs can be pruned intentionally
- old backups can be cleaned without hand deletion

### Phase 4: Regression And Docs

1. add focused maintenance tests
2. run focused regression
3. run release-core regression
4. update runbook, env matrix, and release checklist
5. write execution log

Acceptance:

- the maintenance baseline is documented and regression-backed

## Default Policy For This Phase

- backup root:
  - under the repo data area, outside `OUTPUT_DIR`
- service handling:
  - safe default is stop managed local service before backup/restore
- audit-log retention:
  - day-based retention, operator configurable
- backup retention:
  - day-based retention, operator configurable

## Risks To Watch

1. accidentally restoring outside the repo root
2. recursive backup of the backup directory itself
3. copying runtime logs and PID files as if they were recoverable app state
4. pruning live data more aggressively than intended

## Phase-End Test Cadence

1. after Phase 2:
   - run focused maintenance checks
2. after Phase 3:
   - rerun focused maintenance checks
   - run `node test-auth-history.js`
3. after Phase 4:
   - run `npm run test:regression-core`
   - run `npm run test:release-core`
