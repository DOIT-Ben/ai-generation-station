const fs = require('fs');
const path = require('path');
const os = require('os');
const { createServer } = require('./server/index');
const { createConfig } = require('./server/config');
const { dispatchRequest } = require('./test-live-utils');

function request(server, requestPath, method, body, headers = {}) {
  return dispatchRequest(server, requestPath, method, body, { headers });
}

async function withServer(fn, options = {}) {
  const stateDb = path.join(os.tmpdir(), `aigs-gateway-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`);
  const server = createServer({
    config: createConfig({
      env: {
        ...process.env,
        PORT: '18805',
        APP_STATE_DB: stateDb,
        APP_USERNAME: 'studio',
        APP_PASSWORD: 'AIGS2026!',
        ...(options.env || {})
      }
    })
  });

  try {
    return await fn(server);
  } finally {
    server.appStateStore?.close?.();
    if (fs.existsSync(stateDb)) fs.unlinkSync(stateDb);
    if (fs.existsSync(`${stateDb}-shm`)) fs.unlinkSync(`${stateDb}-shm`);
    if (fs.existsSync(`${stateDb}-wal`)) fs.unlinkSync(`${stateDb}-wal`);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function testHealthAndSecurityHeaders() {
  await withServer(async server => {
    const health = await request(server, '/api/health', 'GET');
    assert(health.status === 200, `Expected /api/health to return 200, got ${health.status}`);
    assert(health.data.status === 'ok', 'Expected health payload status=ok');
    assert(health.data.database === 'ready', 'Expected health payload to report a ready database');

    const home = await request(server, '/', 'GET');
    assert(home.status === 200, `Expected homepage to return 200, got ${home.status}`);
    assert(home.headers['x-frame-options'] === 'SAMEORIGIN', 'Expected X-Frame-Options on static HTML');
    assert(home.headers['x-content-type-options'] === 'nosniff', 'Expected X-Content-Type-Options on static HTML');
    assert(home.headers['referrer-policy'] === 'strict-origin-when-cross-origin', 'Expected Referrer-Policy on static HTML');
    assert(home.headers['permissions-policy'] === 'camera=(), microphone=(), geolocation=()', 'Expected Permissions-Policy on static HTML');
    assert(
      String(home.headers['content-security-policy'] || '').includes("default-src 'self'"),
      'Expected Content-Security-Policy on static HTML'
    );
    assert(
      String(home.headers['content-security-policy'] || '').includes('https://fonts.googleapis.com'),
      'Expected CSP to allow the current Google Fonts stylesheet origin'
    );
  });
}

async function testSameOriginAndAllowedCors() {
  await withServer(async server => {
    const sameOriginHeaders = {
      Host: 'localhost:18805',
      Origin: 'http://localhost:18805'
    };
    const sameOrigin = await request(server, '/api/health', 'GET', null, sameOriginHeaders);
    assert(sameOrigin.status === 200, `Expected same-origin API request to return 200, got ${sameOrigin.status}`);
    assert(
      sameOrigin.headers['access-control-allow-origin'] === 'http://localhost:18805',
      'Expected same-origin API request to echo the allowed origin'
    );
    assert(
      sameOrigin.headers['access-control-allow-credentials'] === 'true',
      'Expected credential-safe CORS headers on same-origin API request'
    );

    const preflight = await request(server, '/api/health', 'OPTIONS', null, {
      Host: 'localhost:18805',
      Origin: 'https://studio.example.com',
      'Access-Control-Request-Method': 'GET'
    });
    assert(preflight.status === 403, `Expected disallowed OPTIONS request to return 403, got ${preflight.status}`);
  }, {
    env: {
      PORT: '18805'
    }
  });

  await withServer(async server => {
    const allowedOrigin = await request(server, '/api/health', 'GET', null, {
      Host: 'localhost:18806',
      Origin: 'https://studio.example.com'
    });
    assert(allowedOrigin.status === 200, `Expected allowed origin API request to return 200, got ${allowedOrigin.status}`);
    assert(
      allowedOrigin.headers['access-control-allow-origin'] === 'https://studio.example.com',
      'Expected configured external origin to be allowed explicitly'
    );
    assert(String(allowedOrigin.headers['vary'] || '').includes('Origin'), 'Expected Vary: Origin when CORS is evaluated');

    const preflight = await request(server, '/api/health', 'OPTIONS', null, {
      Host: 'localhost:18806',
      Origin: 'https://studio.example.com',
      'Access-Control-Request-Method': 'GET'
    });
    assert(preflight.status === 204, `Expected allowed preflight to return 204, got ${preflight.status}`);
    assert(
      preflight.headers['access-control-allow-origin'] === 'https://studio.example.com',
      'Expected allowed preflight to return explicit Access-Control-Allow-Origin'
    );
  }, {
    env: {
      PORT: '18806',
      ALLOWED_ORIGINS: 'https://studio.example.com'
    }
  });
}

async function testDisallowedOriginAndSecureCookie() {
  await withServer(async server => {
    const disallowed = await request(server, '/api/health', 'GET', null, {
      Host: 'localhost:18807',
      Origin: 'https://evil.example.com'
    });
    assert(disallowed.status === 403, `Expected disallowed API origin to return 403, got ${disallowed.status}`);
    assert(disallowed.data.reason === 'origin_not_allowed', 'Expected explicit origin_not_allowed reason');

    const proxiedLogin = await request(server, '/api/auth/login', 'POST', {
      username: 'studio',
      password: 'AIGS2026!'
    }, {
      Host: 'studio.example.com',
      Origin: 'https://studio.example.com',
      'X-Forwarded-Proto': 'https',
      'X-Forwarded-For': '198.51.100.10'
    });
    assert(proxiedLogin.status === 200, `Expected proxied login to succeed, got ${proxiedLogin.status}`);
    const rawCookieHeader = proxiedLogin.headers['set-cookie'];
    const cookieHeader = Array.isArray(rawCookieHeader) ? rawCookieHeader[0] : rawCookieHeader;
    assert(Boolean(cookieHeader), 'Expected proxied login to return a session cookie');
    assert(String(cookieHeader).includes('Secure'), 'Expected proxied HTTPS login to set a Secure cookie');
    assert(String(cookieHeader).includes('HttpOnly'), 'Expected proxied login cookie to remain HttpOnly');
    assert(String(cookieHeader).includes('SameSite=None'), 'Expected configured SameSite=None to be preserved');
    assert(
      proxiedLogin.headers['strict-transport-security'] === 'max-age=31536000; includeSubDomains',
      'Expected HTTPS-aware requests to receive Strict-Transport-Security'
    );
  }, {
    env: {
      PORT: '18807',
      TRUST_PROXY: 'true',
      ALLOWED_ORIGINS: 'https://studio.example.com',
      SESSION_COOKIE_SECURE: 'true',
      SESSION_COOKIE_SAME_SITE: 'None'
    }
  });
}

async function main() {
  await testHealthAndSecurityHeaders();
  await testSameOriginAndAllowedCors();
  await testDisallowedOriginAndSecureCookie();
  console.log('Security gateway tests passed');
}

if (require.main === module) {
  main().catch(error => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = {
  main
};
