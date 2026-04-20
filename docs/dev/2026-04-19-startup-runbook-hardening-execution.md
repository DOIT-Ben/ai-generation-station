# Startup Runbook Hardening Execution Log

## Mainline

- Active phase: `P6 Startup / Deployment / Runbook Hardening`
- Plan:
  - `docs/dev/2026-04-19-startup-runbook-hardening-plan.md`

## Goal

Replace fragile one-off startup memory with a repo-owned, repeatable local service management path.

## Implementation

- Added shared runtime helper:
  - `scripts/local-server-common.ps1`
- Added canonical local commands:
  - `scripts/start-local-service.ps1`
  - `scripts/stop-local-service.ps1`
  - `scripts/check-local-service.ps1`
- Standardized runtime artifact locations under:
  - `output/runtime`
- Standardized managed files:
  - `local-server-18791.pid`
  - `local-server-18791.stdout.log`
  - `local-server-18791.stderr.log`

## Validation

Confirmed in sequence:

1. existing local instance on `18791` could be recognized by the wrapper
2. `check-local-service.ps1` reported:
   - healthy listener
   - managed PID
   - current log paths
3. `start-local-service.ps1` correctly detected the already-running healthy instance and did not launch a duplicate
4. `stop-local-service.ps1` stopped the managed service
5. `check-local-service.ps1` then reported:
   - no listener
   - unhealthy
6. `start-local-service.ps1` successfully launched the service again
7. `check-local-service.ps1 -Json` then reported:
   - healthy `200`
   - managed PID restored

## New Problems Surfaced During This Round

- PowerShell parameter and local-variable names that used `Pid` collided with the built-in read-only `$PID` variable.
- The first managed-PID strategy accidentally stored the wrapper `powershell.exe` PID instead of the real listening `node.exe` PID.
- Running `stop` and `check`, or `start` and `check`, in parallel created false negatives because the state read raced ahead of the process transition.

## Fixes Applied To Newly Surfaced Issues

- Renamed script parameters and locals from `Pid` to `ProcessId`.
- Changed status resolution to prefer the real listener PID over the wrapper PID.
- Stopped writing the wrapper PID during launch.
- Let `check` heal stale PID files by reconciling them against the active listener.
- Switched validation to serial stop/check/start/check execution instead of parallel process races.

## Missed Earlier Assumptions

- A detached wrapper process is not the same thing as the managed service process.
- PID-file correctness matters as much as “HTTP returns 200”; otherwise stop/status drift apart.
- Earlier startup notes lived outside the active `docs/dev` path and were still too historical to function as a clean runbook.

## Remaining Limits

- the wrapper is Windows/PowerShell-specific in this phase
- there is still no OS service registration yet
- deployment reuse is still a documented possibility, not a closed deployment pipeline
