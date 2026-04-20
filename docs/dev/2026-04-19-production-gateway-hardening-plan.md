# Production Gateway Hardening Plan

## Mainline

- Active phase: `P8 Production Entry / Gateway Hardening`
- Source queue:
  - `docs/dev/2026-04-19-post-p0-p2-next-granular-todo.md`
  - approved follow-up TODO sequence after `P7`

## Goal

Harden the current local-first Node server so it can sit behind a reverse proxy and behave intentionally for:

1. real client IP attribution
2. origin handling and credentialed requests
3. security response headers
4. cookie security
5. health checks and operational runbooks

## Current Gaps

- CORS is still effectively `origin || *`
- there is no explicit reverse-proxy trust rule
- client IP logic exists in auth routes, but not as a shared server-wide rule
- there is no dedicated `/api/health` endpoint
- the local service scripts still probe `/`
- there is no productized CSP baseline yet

## Chosen Approach

### Reverse Proxy Trust

Add one explicit config switch for trusting reverse-proxy headers.

Reason:

- forwarded headers should not be trusted blindly in local/direct mode
- production behind Nginx/Caddy needs a deliberate opt-in

### Origin Policy

Apply route-level API origin checks and credential-safe CORS behavior.

Baseline rules:

- same-origin requests should work without configuration
- optional extra origins can be whitelisted by config
- disallowed API origins should fail explicitly
- `Access-Control-Allow-Origin` should never be `*` when credentials are enabled

### Security Headers

Add a baseline product CSP and standard hardening headers.

Initial CSP target:

- scripts only from self
- styles from self plus Google Fonts stylesheet origin
- fonts from self plus Google Fonts asset origin
- images/media from self and safe local URL schemes already used by the product
- no object embedding
- self-only forms/base URI

### Health Check

Add `/api/health` as the canonical readiness endpoint and move local service tooling to it.

## Planned Deliverables

1. proxy/origin/security config additions
2. shared request-security helper
3. `/api/health` route
4. stricter cookie serialization
5. local-service script health path update
6. security-focused regression coverage
7. runbook and release doc updates

## Validation Plan

1. direct local health endpoint returns `200`
2. same-origin API requests still work
3. disallowed origin requests are rejected
4. allowed cross-origin requests receive origin-specific CORS headers
5. security headers are present on HTML and API responses
6. local service scripts report health via `/api/health`
7. run focused tests:
   - `node test-security-gateway.js`
   - `node test-failures.js`
8. run skip-live regression:
   - `. 'D:\document\PowerShell\profile.ps1'; node test-regression.js --skip-live --port 18797`

## Known Limits

- CSP will still allow `unsafe-inline` styles because the current frontend uses runtime inline styles
- this phase does not yet add CSRF tokens
- this phase does not yet move fonts off external Google origins
