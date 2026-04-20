# Separate-Site Browser Security Baseline Plan

## Background

- dedicated auth, account, and admin pages already exist
- same-origin frontend + API is still the current default deployment model
- the backend already has:
  - proxy-aware origin allowlisting
  - secure cookie controls
  - baseline security headers
- the current product still lacks one deliberate CSRF model for separate-site browser deployments
- the current frontend still assumes API requests are same-origin:
  - remote persistence uses `credentials: 'same-origin'`
  - workspace scripts still call `/api/*` directly

## Goal

Close the next documented release gap by making the browser/API boundary deliberate for an external frontend origin:

1. frontend can target an explicit API base URL
2. credentialed cross-origin browser requests can work intentionally
3. unsafe API requests require a CSRF token baseline
4. proxy/env/release docs describe the deployment contract clearly

## Scope Decision

Include:

- one runtime-configurable frontend API base path/origin
- one CSRF bootstrap endpoint for browser clients
- one CSRF validation path for unsafe `/api/*` requests
- CORS updates required for the CSRF header
- focused security and regression coverage

Exclude:

- MFA
- OAuth / SSO
- JWT migration
- multi-tenant domain routing
- replacing the cookie-backed session model

## Design Choice

Use one stateless browser CSRF seed model:

1. server issues an HttpOnly CSRF seed cookie
2. server exposes `GET /api/auth/csrf` to return a derived token for allowed browser origins
3. frontend caches the returned token and sends it through `X-CSRF-Token` on unsafe requests
4. server recomputes and validates the token from the seed cookie

Why this approach:

- it works for same-origin and separate-site browser deployments
- it does not require exposing a readable cookie to frontend JavaScript
- it avoids adding another persisted table for this phase
- it fits the current low-dependency Node server structure

## Execution Order

### Phase 1: Contract And Runtime Wiring

1. define the separate-site deployment contract:
   - optional frontend API base URL
   - CSRF header name
   - CSRF bootstrap route
2. add frontend runtime API URL resolution shared by portal/workspace scripts
3. switch remote/browser fetches from same-origin-only assumptions to a deliberate credentialed request helper

Acceptance:

- the frontend can point at a different API origin without hard-coded same-origin fetch calls

### Phase 2: Server CSRF Baseline

1. add CSRF seed cookie issuance and token derivation helpers
2. add `GET /api/auth/csrf`
3. require CSRF validation on unsafe `/api/*` requests
4. allow `X-CSRF-Token` through CORS preflight

Acceptance:

- unsafe API requests fail closed without a valid CSRF token
- safe `GET` requests remain unaffected

### Phase 3: Frontend Adoption

1. teach remote persistence to bootstrap and cache the CSRF token
2. retry once on token refresh after a CSRF mismatch
3. migrate workspace direct fetches onto the shared API request helpers where needed

Acceptance:

- auth, account, admin, and workspace write flows still work under the new contract

### Phase 4: Verification And Docs

1. add focused security tests for:
   - token bootstrap
   - missing token rejection
   - allowed-origin credentialed success
2. run `npm run test:regression-core`
3. run `npm run test:release-core`
4. update:
   - reverse proxy runbook
   - production env matrix
   - release readiness checklist
   - dev archive index
5. write the execution log

Acceptance:

- separate-site browser security behavior is documented, tested, and regression-backed

## Risks To Watch

1. breaking same-origin local behavior while enabling separate-site support
2. missing one frontend write path that still posts without the CSRF header
3. allowing the CSRF bootstrap endpoint to become readable by disallowed origins
4. turning CORS into a broad wildcard while adding the custom header

## Phase-End Test Cadence

1. after Phase 2:
   - run focused security tests
2. after Phase 3:
   - rerun focused security tests
   - run frontend/auth flows that exercise writes
3. after Phase 4:
   - run `npm run test:regression-core`
   - run `npm run test:release-core`
