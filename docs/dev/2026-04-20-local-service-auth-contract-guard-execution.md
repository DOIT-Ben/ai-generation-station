# Local Service Auth Contract Guard Execution

## Related Plan

- `docs/dev/2026-04-20-local-service-auth-contract-guard-plan.md`

## Goal

Prevent stale local runtimes from silently passing health while failing browser auth flows.

## Execution Log

### Phase 1: Script Design And Guardrails

Status:
- completed

Notes:
- confirmed the concrete failure came from `/api/auth/csrf` returning `404` on the live local port while `/api/health` was still effectively usable
- confirmed the existing local service tooling only checks `/api/health`
- confirmed the local service scripts are the right place to add the next guard

### Phase 2: Auth Contract Probe

Status:
- completed

Notes:
- added one dedicated auth-contract probe in `scripts/local-server-common.ps1`
- the new probe targets:
  - `/api/auth/csrf`
- readiness now validates:
  - `200`
  - `csrfToken`
  - `headerName`
- surfaced the new probe in `Get-AigsServerStatus()` and `check-local-service.ps1`

### Phase 3: Startup Self-Healing

Status:
- completed

Notes:
- updated `scripts/start-local-service.ps1` so a managed local process that fails readiness is recycled instead of being treated as usable
- local service readiness now requires both:
  - `/api/health`
  - `/api/auth/csrf`
- preserved the existing refusal behavior for unknown foreign listeners occupying the port

### Phase 4: Verification And Docs

Status:
- completed

Notes:
- updated:
  - `docs/dev/2026-04-19-local-service-runbook.md`
  - `docs/dev/2026-04-19-dev-archive-index.md`
- passed targeted verification:
  - `powershell -ExecutionPolicy Bypass -File .\scripts\check-local-service.ps1 -Port 18791`
  - `powershell -ExecutionPolicy Bypass -File .\scripts\start-local-service.ps1 -Port 18791`
  - browser logout smoke against `http://127.0.0.1:18791/account/`

## Single-Task Closeout Review

### New Problems Found

- the previous local-service “healthy” signal was too weak for browser-auth regressions because it only proved backend readiness, not browser contract readiness
- a stale local runtime can silently survive code changes long enough to mislead frontend debugging if operators start the app outside the repo-owned service wrapper

### Missed Edge Cases

- local operational tooling had not been updated when `/api/auth/csrf` became a hard dependency for unsafe browser requests
- this round verifies the positive path and the real live-failure symptom, but does not include an automated harness that spins up an intentionally stale older managed server build

### Fixes Applied

- added a separate auth-contract probe for `/api/auth/csrf`
- made local readiness require both backend health and browser auth-contract readiness
- taught the start wrapper to recycle a managed but non-ready local server
- updated the runbook so operators can distinguish:
  - backend healthy
  - auth/browser ready
