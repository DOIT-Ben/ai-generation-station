# Local Service Auth Contract Guard Plan

## Background

- local service tooling already verifies `/api/health`
- a stale local runtime can still pass `/api/health` while missing newer auth/browser contract routes
- the latest concrete failure was:
  - frontend logout on `http://127.0.0.1:18791/account/`
  - browser error: `CSRF token bootstrap failed`
  - root cause: the running local instance returned `404` for `/api/auth/csrf`

## Goal

Tighten local service operations so auth/browser readiness is not inferred from `/api/health` alone.

## Design Choice

Keep the current health endpoint and add one separate auth-contract readiness probe:

1. `/api/health`
   - backend process and storage readiness
2. `/api/auth/csrf`
   - browser auth contract readiness for CSRF-protected flows

Recommended behavior:

- `check-local-service.ps1` should show both probes
- `start-local-service.ps1` should consider the local service ready only when both pass
- if a managed local service is already running but fails the auth-contract check, start should recycle it instead of pretending it is usable

## Scope

Include:

- PowerShell local service helpers
- local start/check behavior
- runbook updates in `docs/dev`
- execution logging

Exclude:

- changes to production health semantics
- frontend auth logic changes
- replacing direct `node server/index.js` usage everywhere

## Execution Order

### Phase 1: Script Design And Guardrails

1. document the issue and chosen fix
2. inspect current local service script behavior
3. confirm which script outputs are consumed elsewhere

### Phase 2: Auth Contract Probe

1. add one probe for `/api/auth/csrf`
2. validate that it expects:
   - `200`
   - `csrfToken`
   - `headerName`
3. surface probe results alongside existing `/api/health` status

### Phase 3: Startup Self-Healing

1. make startup require both:
   - api health
   - auth contract readiness
2. if the managed process exists but contract readiness fails:
   - stop it
   - relaunch it

### Phase 4: Verification And Docs

1. run local service check on the live dev port
2. run start script against the live dev port
3. update the local runbook
4. record closeout notes

## Risks To Watch

1. changing `healthy` semantics in a way that breaks other maintenance scripts
2. letting contract checks mutate behavior too aggressively for unrelated local workflows
3. hiding the difference between “process healthy” and “browser-auth ready”
