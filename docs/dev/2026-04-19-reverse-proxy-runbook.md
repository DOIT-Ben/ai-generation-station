# Reverse Proxy Runbook

## Purpose

Provide one canonical proxy baseline for exposing the current Node server safely behind a user-facing entry layer.

## Current Backend Assumptions

- backend app port:
  - `18791`
- canonical backend health endpoint:
  - `/api/health`
- same-origin frontend and API are still the default deployment model
- separate-site browser deployments now require an explicit frontend/API contract:
  - frontend pages set `<meta name="aigs-api-base-url" content="https://api.example.com">`
  - backend allowlists the frontend origin through `ALLOWED_ORIGINS`
  - browser clients bootstrap `GET /api/auth/csrf` before unsafe requests

## Required Backend Environment

- `TRUST_PROXY=true`
- `SESSION_COOKIE_SECURE=true`
- `SESSION_COOKIE_SAME_SITE=Lax`

Optional:

- `ALLOWED_ORIGINS=https://your-domain.example`
  - only needed if a deliberate extra browser origin must call the API
- `CSRF_SECRET=stable-random-secret`
  - strongly recommended whenever the browser frontend is hosted on a separate origin

If the browser frontend is hosted on a different origin than the API:

- set `ALLOWED_ORIGINS=https://app.example.com`
- set `SESSION_COOKIE_SAME_SITE=None`
- keep `SESSION_COOKIE_SECURE=true`
- set `CSRF_SECRET` explicitly instead of relying on the fallback secret

## Caddy Example

```caddyfile
your-domain.example {
    encode gzip zstd

    reverse_proxy 127.0.0.1:18791 {
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
        header_up X-Real-IP {remote_host}
    }

    @health path /api/health
    handle @health {
        reverse_proxy 127.0.0.1:18791
    }
}
```

## Nginx Example

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.example;

    location / {
        proxy_pass http://127.0.0.1:18791;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location = /api/health {
        proxy_pass http://127.0.0.1:18791/api/health;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Verification

1. open `/api/health` through the proxy and confirm `200`
2. log in once and confirm the returned session cookie includes `Secure`
3. confirm backend audit logs record the client IP rather than only loopback/proxy IP
4. confirm browser responses include:
   - `Content-Security-Policy`
   - `X-Frame-Options`
   - `X-Content-Type-Options`
   - `Referrer-Policy`
5. confirm a disallowed `Origin` on `/api/*` returns `403`
6. if using a separate-site frontend:
   - confirm `GET /api/auth/csrf` returns `200` for the allowed frontend origin
   - confirm the response sets an HttpOnly CSRF seed cookie
   - confirm the browser preflight allows `X-CSRF-Token`
   - confirm an unsafe request without the CSRF header fails with `403`

## Known Limits

- current baseline still assumes one backend process
- there is not yet a WebSocket-specific proxy path
- the frontend deployment still depends on one small runtime page setting:
  - `<meta name="aigs-api-base-url" ...>`
