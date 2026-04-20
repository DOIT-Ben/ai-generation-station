# Local Service Runbook

## Canonical Commands

Run from the repo root:

### Start

`powershell -ExecutionPolicy Bypass -File .\scripts\start-local-service.ps1 -Port 18791`

### Stop

`powershell -ExecutionPolicy Bypass -File .\scripts\stop-local-service.ps1 -Port 18791`

### Health / Status

`powershell -ExecutionPolicy Bypass -File .\scripts\check-local-service.ps1 -Port 18791`

JSON status:

`powershell -ExecutionPolicy Bypass -File .\scripts\check-local-service.ps1 -Port 18791 -Json`

### Restart

Run:

1. `powershell -ExecutionPolicy Bypass -File .\scripts\stop-local-service.ps1 -Port 18791`
2. `powershell -ExecutionPolicy Bypass -File .\scripts\start-local-service.ps1 -Port 18791`

## State Maintenance Commands

Run from the repo root:

### Summary

`node .\scripts\state-maintenance.js summary`

JSON summary:

`node .\scripts\state-maintenance.js summary --json`

### Backup

`powershell -ExecutionPolicy Bypass -File .\scripts\backup-app-state.ps1 -Port 18791`

Notes:

- safe default backup scope includes:
  - `APP_STATE_DB`
  - SQLite side files when present
  - `OUTPUT_DIR`
- excludes:
  - `output\runtime`
- if the managed local service is running on the selected port, the backup script stops it first unless `-NoServiceStop` is used

### Restore

`powershell -ExecutionPolicy Bypass -File .\scripts\restore-app-state.ps1 -BackupId <timestamp> -Port 18791`

Notes:

- restore expects a backup created under `STATE_BACKUP_DIR`
- restore replaces:
  - live state DB files
  - backed-up output entries
- restore keeps:
  - `output\runtime`

### Prune

`powershell -ExecutionPolicy Bypass -File .\scripts\prune-app-state.ps1`

Optional overrides:

- `-AuditLogRetentionDays <days>`
- `-BackupRetentionDays <days>`

## Address

- local frontend:
  - `http://localhost:18791`
- local health endpoint:
  - `http://localhost:18791/api/health`

## Runtime Files

Stored under:

- `output/runtime`

Files:

- PID file:
  - `output/runtime/local-server-18791.pid`
- stdout log:
  - `output/runtime/local-server-18791.stdout.log`
- stderr log:
  - `output/runtime/local-server-18791.stderr.log`

## Notification Modes

The local service currently supports three notification modes for invitation and password-reset flows:

- `local_preview`
  - default local development mode
  - invitation and forgot-password responses can expose preview links for direct browser testing
- `resend`
  - real email delivery mode
  - requires:
    - `NOTIFICATION_FROM_EMAIL`
    - `RESEND_API_KEY`
- `disabled`
  - intentional no-send mode
  - invite sends fail closed
  - forgot-password stays generic but does not deliver a usable link

Local recommendation:

- keep `NOTIFICATION_DELIVERY_MODE=local_preview` when running the repo-owned start scripts unless you are explicitly testing provider delivery

If testing real delivery locally:

1. set `NOTIFICATION_DELIVERY_MODE=resend`
2. set `NOTIFICATION_FROM_EMAIL`
3. set `RESEND_API_KEY`
4. restart the local service
5. verify the health endpoint again before testing auth flows

## Expected Healthy State

- `check-local-service.ps1` reports:
  - `healthy: true`
  - `statusCode: 200`
  - `healthUrl` points to:
    - `http://127.0.0.1:18791/api/health`
  - the same PID for:
    - `managedPid`
    - `listenerPid`

## Common Failure Modes

### Port Already Occupied By Another Process

Symptom:

- start refuses to launch
- message says the port is in use by an unknown PID

Meaning:

- something else is already listening on `18791`
- the wrapper intentionally refuses to kill a process it does not recognize as this repo server

### PID File Stale

Symptom:

- status initially sees a PID file but no matching process

Handling:

- `check-local-service.ps1` reconciles against the live listener and rewrites/removes stale PID state when possible

### Health Fails After Start

Symptom:

- start throws that the local service failed to become healthy

Check:

1. `output/runtime/local-server-18791.stdout.log`
2. `output/runtime/local-server-18791.stderr.log`
3. `powershell -ExecutionPolicy Bypass -File .\scripts\check-local-service.ps1 -Port 18791 -Json`

### Environment Bootstrap Issues

Current handling:

- the start wrapper explicitly sources:
  - `D:\document\PowerShell\profile.ps1`

Reason:

- this remains the current local fix for the Codex/PowerShell environment bootstrap issue recorded in historical docs

## State Maintenance Defaults

- backup root:
  - `data\backups`
- default audit-log retention:
  - `90` days
- default backup retention:
  - `14` days

Current recommendation:

1. run a state backup before destructive local cleanup or large auth/admin test rounds
2. keep restore targeted to known backup IDs instead of guessing “latest”
3. keep maintenance CLI/script usage local and operator-driven for this phase
