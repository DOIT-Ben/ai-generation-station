# Reverse Proxy Runbook

## Purpose

Provide one canonical proxy baseline for exposing the current Node server safely behind a user-facing entry layer.

## Current Backend Assumptions

- backend app port:
  - `18791`
- canonical backend health endpoint:
  - `/api/health`
- same-origin frontend and API are still the default deployment model

## Required Backend Environment

- `TRUST_PROXY=true`
- `SESSION_COOKIE_SECURE=true`
- `SESSION_COOKIE_SAME_SITE=Lax`

Optional:

- `ALLOWED_ORIGINS=https://your-domain.example`
  - only needed if a deliberate extra browser origin must call the API

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

## Known Limits

- current baseline still assumes one backend process
- there is not yet a WebSocket-specific proxy path
- there is not yet a dedicated CSRF token layer for separate-site browser apps
