# State Durability And Retention Execution

## Related Plan

- `docs/dev/2026-04-20-state-durability-retention-plan.md`

## Goal

Add one safe operator baseline for app-state backup, restore, and retention/pruning.

## Execution Log

### Phase 1: Maintenance Contract

Status:
- completed

Notes:
- added resolved maintenance config support in:
  - `server/config.js`
- added defaults for:
  - `STATE_BACKUP_DIR`
  - `AUDIT_LOG_RETENTION_DAYS`
  - `STATE_BACKUP_RETENTION_DAYS`
- split responsibilities intentionally:
  - PowerShell scripts own copy/restore/path safety
  - Node/state-store owns config lookup, maintenance summary, and audit-log prune behavior

### Phase 2: Backup / Restore Scripts

Status:
- completed

Notes:
- added:
  - `scripts/state-maintenance.js`
  - `scripts/state-maintenance-common.ps1`
  - `scripts/backup-app-state.ps1`
  - `scripts/restore-app-state.ps1`
- backup baseline now:
  - writes a timestamped backup folder under `STATE_BACKUP_DIR`
  - creates `manifest.json`
  - copies `APP_STATE_DB`
  - copies SQLite side files when present
  - copies `OUTPUT_DIR` entries except `output\runtime`
- restore baseline now:
  - validates backup manifest presence
  - restores state DB payload
  - restores backed-up output entries
  - preserves `output\runtime`
- validated backup/restore with an isolated verification state under:
  - `data\p19-verify`
  - `output\p19-verify-output`
- verified restore actually rolled back:
  - audit-log count
  - output file content

### Phase 3: Retention / Prune Support

Status:
- completed

Notes:
- added `stateStore.pruneAuditLogs()`
- added `stateStore.getMaintenanceSummary()`
- added:
  - `scripts/prune-app-state.ps1`
- prune baseline now supports:
  - audit-log pruning by retention days
  - backup-folder pruning by retention days
- validated prune in the isolated verification state by:
  - removing one old audit log
  - removing one aged backup folder

### Phase 4: Regression And Docs

Status:
- completed

Notes:
- added:
  - `test-state-maintenance.js`
  - `npm run test:state-maintenance`
- passed:
  - `npm run test:state-maintenance`
  - `node test-auth-history.js`
  - `npm run test:regression-core`
  - `npm run test:release-core`
- updated:
  - local-service runbook
  - production env matrix
  - release readiness checklist
  - dev archive index

## Single-Task Closeout Review

### New Problems Found

- `ConvertFrom-Json -Depth` was not portable across the active PowerShell runtime
- the config/bootstrap layer can emit non-JSON tip lines before JSON payloads, which broke naive shell parsing

### Missed Edge Cases

- PowerShell-side JSON parsing could not assume a clean stdout channel
- Windows PowerShell compatibility still matters even when the repo is often run from newer PowerShell sessions
- restore rehearsal needed an isolated state path because using the live managed service/state would be too risky for a first validation pass

### Fixes Applied

- removed the non-portable `ConvertFrom-Json -Depth` usage
- made shell JSON extraction robust to leading non-JSON lines
- verified the maintenance scripts against an isolated state/output sandbox before trusting them against the live repo state

## Final Closeout Verification

- reran `npm run test:state-maintenance`
- confirmed the managed local service is still healthy on port `18791`
- verified the working tree only contains the intended P19 code/docs/script changes before commit
