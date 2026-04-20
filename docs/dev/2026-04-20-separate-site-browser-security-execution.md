# Separate-Site Browser Security Baseline Execution

## Related Plan

- `docs/dev/2026-04-20-separate-site-browser-security-plan.md`

## Goal

Close the same-origin-only browser security gap by adding a deliberate separate-site API + CSRF baseline.

## Execution Log

### Phase 1: Contract And Runtime Wiring

Status:
- completed

Notes:
- confirmed the current frontend still hard-codes same-origin browser requests in:
  - `public/js/app-shell.js`
  - `public/js/app.js`
- confirmed the current backend still documents:
  - same-origin as the default deployment model
  - no dedicated CSRF token layer for separate-site browser apps
- added one shared frontend runtime contract:
  - optional `<meta name="aigs-api-base-url" ...>`
  - shared API request client in `public/js/app-shell.js`
- moved remote persistence and workspace API calls onto:
  - credentialed requests
  - API-base-aware URL resolution
  - CSRF bootstrap support
- normalized output/media URLs so `/output/*` payloads can still load when the API origin differs from the frontend origin

### Phase 2: Server CSRF Baseline

Status:
- completed

Notes:
- added `server/lib/csrf.js`
- added `GET /api/auth/csrf`
- added CSRF config support in:
  - `server/config.js`
  - `server/index.js`
  - `server/routes/state.js`
- unsafe `/api/*` requests now fail closed unless the browser provides:
  - the CSRF seed cookie
  - the matching `X-CSRF-Token` header
- CORS preflight now explicitly allows `X-CSRF-Token`

### Phase 3: Frontend Adoption

Status:
- completed

Notes:
- added `AppShell.createApiClient()` for:
  - API base resolution
  - credentialed fetches
  - CSRF bootstrap and one retry on `csrf_*` failures
- updated:
  - `public/js/app-shell.js`
  - `public/js/app.js`
  - `public/index.html`
  - `public/auth/index.html`
  - `public/account/index.html`
  - `public/admin/index.html`
- kept auth/admin/account pages on the current frontend origin for portal links and preview links
- moved only API/output asset resolution onto the optional external API origin

### Phase 4: Verification And Docs

Status:
- completed

Notes:
- updated:
  - reverse proxy runbook
  - production env matrix
  - release readiness checklist
  - dev archive index
- passed focused checks:
  - `node test-frontend-state.js`
  - `node test-page-markup.js`
  - `node test-security-gateway.js`
- passed phase-end regression:
  - `npm run test:regression-core`
  - `npm run test:release-core`

## Single-Task Closeout Review

### New Problems Found

- `CSRF_SECRET` initially referenced `APP_STATE_DB` before that path was initialized in `server/config.js`
- regression helpers and benchmark helpers still behaved like legacy non-CSRF browser clients

### Missed Edge Cases

- release-core capacity and smoke tooling also needed the new CSRF bootstrap path, not just product code
- standalone/local test helpers must avoid sending an `undefined` CSRF header when talking to an older still-running server process
- output/media URLs needed API-origin resolution separately from auth preview links

### Fixes Applied

- moved `CSRF_SECRET` initialization below `APP_STATE_DB`
- upgraded shared and file-local test request helpers to bootstrap CSRF before unsafe requests
- made test helpers tolerant of targets that do not return a CSRF token yet, instead of failing during header construction
- resolved backend-generated `/output/*` URLs against the configured API origin without rewriting frontend-owned `/auth/*` links
