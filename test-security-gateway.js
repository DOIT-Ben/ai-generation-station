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

function getSetCookies(response) {
  const raw = response.headers['set-cookie'];
  if (!raw) return [];
  return Array.isArray(raw) ? raw : [raw];
}

function getCookieHeader(cookieLine) {
  return String(cookieLine || '').split(';')[0];
}

function findCookie(response, cookieName) {
  return getSetCookies(response).find(cookie => String(cookie).startsWith(`${cookieName}=`)) || null;
}

function mergeCookieHeaders(...cookieHeaders) {
  const cookieMap = new Map();
  cookieHeaders
    .map(value => String(value || '').trim())
    .filter(Boolean)
    .forEach(headerValue => {
      headerValue.split(';').map(part => part.trim()).filter(Boolean).forEach(part => {
        const [name, ...rest] = part.split('=');
        if (!name || rest.length === 0) return;
        cookieMap.set(name.trim(), rest.join('=').trim());
      });
    });

  return Array.from(cookieMap.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

async function bootstrapCsrf(server, headers = {}) {
  const response = await request(server, '/api/auth/csrf', 'GET', null, headers);
  const csrfCookie = findCookie(response, 'aigs_csrf');
  return {
    response,
    csrfToken: response.data?.csrfToken || null,
    csrfCookieHeader: getCookieHeader(csrfCookie)
  };
}

async function loginWithCsrf(server, credentials, headers = {}) {
  const csrf = await bootstrapCsrf(server, headers);
  assert(csrf.response.status === 200, `Expected CSRF bootstrap before login to return 200, got ${csrf.response.status}`);
  assert(Boolean(csrf.csrfToken), 'Expected CSRF bootstrap before login to include a token');
  const response = await request(server, '/api/auth/login', 'POST', credentials, {
    ...headers,
    Cookie: mergeCookieHeaders(headers.Cookie, csrf.csrfCookieHeader),
    'X-CSRF-Token': csrf.csrfToken
  });
  const sessionCookie = findCookie(response, 'aigs_session');
  return {
    response,
    csrfToken: csrf.csrfToken,
    csrfCookieHeader: csrf.csrfCookieHeader,
    sessionCookieHeader: getCookieHeader(sessionCookie)
  };
}

async function registerWithCsrf(server, payload, headers = {}) {
  const csrf = await bootstrapCsrf(server, headers);
  assert(csrf.response.status === 200, `Expected CSRF bootstrap before register to return 200, got ${csrf.response.status}`);
  const response = await request(server, '/api/auth/register', 'POST', payload, {
    ...headers,
    Cookie: mergeCookieHeaders(headers.Cookie, csrf.csrfCookieHeader),
    'X-CSRF-Token': csrf.csrfToken
  });
  const sessionCookie = findCookie(response, 'aigs_session');
  return {
    response,
    csrfToken: csrf.csrfToken,
    csrfCookieHeader: csrf.csrfCookieHeader,
    sessionCookieHeader: getCookieHeader(sessionCookie)
  };
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

    const preflight = await request(server, '/api/auth/login', 'OPTIONS', null, {
      Host: 'localhost:18806',
      Origin: 'https://studio.example.com',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'Content-Type, X-CSRF-Token'
    });
    assert(preflight.status === 204, `Expected allowed preflight to return 204, got ${preflight.status}`);
    assert(
      preflight.headers['access-control-allow-origin'] === 'https://studio.example.com',
      'Expected allowed preflight to return explicit Access-Control-Allow-Origin'
    );
    assert(
      String(preflight.headers['access-control-allow-headers'] || '').includes('X-CSRF-Token'),
      'Expected allowed preflight to include the CSRF request header'
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
    const disallowed = await request(server, '/api/auth/csrf', 'GET', null, {
      Host: 'localhost:18807',
      Origin: 'https://evil.example.com'
    });
    assert(disallowed.status === 403, `Expected disallowed API origin to return 403, got ${disallowed.status}`);
    assert(disallowed.data.reason === 'origin_not_allowed', 'Expected explicit origin_not_allowed reason');

    const baseHeaders = {
      Host: 'studio.example.com',
      Origin: 'https://studio.example.com',
      'X-Forwarded-Proto': 'https',
      'X-Forwarded-For': '198.51.100.10'
    };

    const missingSeedLogin = await request(server, '/api/auth/login', 'POST', {
      username: 'studio',
      password: 'AIGS2026!'
    }, baseHeaders);
    assert(missingSeedLogin.status === 403, `Expected login without CSRF seed to return 403, got ${missingSeedLogin.status}`);
    assert(missingSeedLogin.data.reason === 'csrf_seed_missing', 'Expected login without CSRF seed to fail with csrf_seed_missing');

    const csrfBootstrap = await request(server, '/api/auth/csrf', 'GET', null, baseHeaders);
    assert(csrfBootstrap.status === 200, `Expected CSRF bootstrap to return 200, got ${csrfBootstrap.status}`);
    assert(Boolean(csrfBootstrap.data.csrfToken), 'Expected CSRF bootstrap payload to include a token');
    assert(csrfBootstrap.data.headerName === 'X-CSRF-Token', 'Expected CSRF bootstrap payload to expose the header name');

    const csrfCookie = findCookie(csrfBootstrap, 'aigs_csrf');
    assert(Boolean(csrfCookie), 'Expected CSRF bootstrap to set the CSRF seed cookie');
    assert(String(csrfCookie).includes('Secure'), 'Expected CSRF seed cookie to be secure behind HTTPS');
    assert(String(csrfCookie).includes('HttpOnly'), 'Expected CSRF seed cookie to remain HttpOnly');
    assert(String(csrfCookie).includes('SameSite=None'), 'Expected configured SameSite=None to be preserved on the CSRF seed cookie');

    const missingHeaderLogin = await request(server, '/api/auth/login', 'POST', {
      username: 'studio',
      password: 'AIGS2026!'
    }, {
      ...baseHeaders,
      Cookie: getCookieHeader(csrfCookie)
    });
    assert(missingHeaderLogin.status === 403, `Expected login without CSRF header to return 403, got ${missingHeaderLogin.status}`);
    assert(missingHeaderLogin.data.reason === 'csrf_required', 'Expected login without CSRF header to fail with csrf_required');

    const proxiedLogin = await request(server, '/api/auth/login', 'POST', {
      username: 'studio',
      password: 'AIGS2026!'
    }, {
      ...baseHeaders,
      Cookie: getCookieHeader(csrfCookie),
      'X-CSRF-Token': csrfBootstrap.data.csrfToken
    });
    assert(proxiedLogin.status === 200, `Expected proxied login to succeed, got ${proxiedLogin.status}`);
    const cookieHeader = findCookie(proxiedLogin, 'aigs_session');
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

async function testMalformedCookieAndOutputPathHandling() {
  await withServer(async server => {
    const malformedCookie = await request(server, '/api/health', 'GET', null, {
      Cookie: 'bad=%E0%A4%A'
    });
    assert(malformedCookie.status === 200, `Expected malformed cookie request to remain safe, got ${malformedCookie.status}`);
    assert(malformedCookie.data.status === 'ok', 'Expected malformed cookie request to still reach the health handler');

    const csrfBootstrap = await request(server, '/api/auth/csrf', 'GET');
    assert(csrfBootstrap.status === 200, `Expected CSRF bootstrap to return 200, got ${csrfBootstrap.status}`);
    const csrfCookie = findCookie(csrfBootstrap, 'aigs_csrf');
    assert(Boolean(csrfCookie), 'Expected CSRF bootstrap to set the CSRF cookie');
    const login = await request(server, '/api/auth/login', 'POST', {
      username: 'studio',
      password: 'AIGS2026!'
    }, {
      Cookie: getCookieHeader(csrfCookie),
      'X-CSRF-Token': csrfBootstrap.data.csrfToken
    });
    assert(login.status === 200, `Expected login before malformed output-path test to succeed, got ${login.status}`);
    const sessionCookie = findCookie(login, 'aigs_session');
    assert(Boolean(sessionCookie), 'Expected login to return the session cookie');

    const malformedOutputPath = await request(server, '/output/%E0%A4%A', 'GET', null, {
      Cookie: getCookieHeader(sessionCookie)
    });
    assert(malformedOutputPath.status === 400, `Expected malformed output path to return 400, got ${malformedOutputPath.status}`);
    assert(malformedOutputPath.data.reason === 'invalid_path_encoding', 'Expected malformed output path to fail with invalid_path_encoding');
  });
}

async function testAdminAccessBoundaries() {
  await withServer(async server => {
    const anonymousAdminUsers = await request(server, '/api/admin/users', 'GET');
    assert(anonymousAdminUsers.status === 401, `Expected anonymous admin users request to return 401, got ${anonymousAdminUsers.status}`);
    assert(anonymousAdminUsers.data.reason === 'anonymous', 'Expected anonymous admin users request to fail as anonymous');

    const uniqueSuffix = `${Date.now()}${Math.random().toString(16).slice(2, 8)}`;
    const regularUser = await registerWithCsrf(server, {
      username: `member_${uniqueSuffix}`,
      email: `member_${uniqueSuffix}@example.com`,
      password: 'MemberPass123!',
      displayName: 'Member User'
    });
    assert(regularUser.response.status === 200, `Expected public registration test user to succeed, got ${regularUser.response.status}`);
    assert(Boolean(regularUser.sessionCookieHeader), 'Expected registered member to receive a session cookie');

    const nonAdminUsers = await request(server, '/api/admin/users', 'GET', null, {
      Cookie: regularUser.sessionCookieHeader
    });
    assert(nonAdminUsers.status === 403, `Expected non-admin users request to return 403, got ${nonAdminUsers.status}`);
    assert(nonAdminUsers.data.error === '需要管理员权限', 'Expected non-admin users request to fail with admin-only message');

    const adminLogin = await loginWithCsrf(server, {
      username: 'studio',
      password: 'AIGS2026!'
    });
    assert(adminLogin.response.status === 200, `Expected admin login to succeed, got ${adminLogin.response.status}`);
    const adminCookies = mergeCookieHeaders(adminLogin.csrfCookieHeader, adminLogin.sessionCookieHeader);

    const adminUsers = await request(server, '/api/admin/users', 'GET', null, {
      Cookie: adminLogin.sessionCookieHeader
    });
    assert(adminUsers.status === 200, `Expected admin users request to succeed, got ${adminUsers.status}`);
    const adminUser = Array.isArray(adminUsers.data?.users)
      ? adminUsers.data.users.find(item => item.username === 'studio')
      : null;
    assert(Boolean(adminUser?.id), 'Expected admin users payload to include the default admin user');

    const selfDemotion = await request(server, `/api/admin/users/${adminUser.id}`, 'POST', {
      role: 'user'
    }, {
      Cookie: adminCookies,
      'X-CSRF-Token': adminLogin.csrfToken
    });
    assert(selfDemotion.status === 400, `Expected self-demotion guard to return 400, got ${selfDemotion.status}`);
    assert(selfDemotion.data.error === '不能降级当前登录管理员', 'Expected self-demotion guard to block downgrading the active admin');

    const createUser = await request(server, '/api/admin/users', 'POST', {
      username: `audit_${uniqueSuffix}`,
      email: `audit_${uniqueSuffix}@example.com`,
      password: 'AuditPass123!',
      displayName: 'Audit Target',
      role: 'user',
      planCode: 'free'
    }, {
      Cookie: adminCookies,
      'X-CSRF-Token': adminLogin.csrfToken
    });
    assert(createUser.status === 200, `Expected admin create-user request to succeed, got ${createUser.status}`);

    const auditLogs = await request(
      server,
      `/api/admin/audit-logs?action=user_create&targetUsername=${encodeURIComponent(`audit_${uniqueSuffix}`)}`,
      'GET',
      null,
      { Cookie: adminLogin.sessionCookieHeader }
    );
    assert(auditLogs.status === 200, `Expected admin audit-log query to succeed, got ${auditLogs.status}`);
    const matchedAuditEntry = Array.isArray(auditLogs.data?.items)
      ? auditLogs.data.items.find(item => item.action === 'user_create' && item.targetUsername === `audit_${uniqueSuffix}`)
      : null;
    assert(Boolean(matchedAuditEntry), 'Expected audit logs to contain the admin create-user record');
  }, {
    env: {
      PORT: '18808',
      PUBLIC_REGISTRATION_ENABLED: 'true'
    }
  });
}

async function testUploadInputGuards() {
  await withServer(async server => {
    const anonymousUpload = await request(server, '/api/upload', 'POST', {
      filename: 'sample.mp3',
      data: Buffer.from([0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00]).toString('base64')
    });
    assert(anonymousUpload.status === 401, `Expected anonymous upload to return 401, got ${anonymousUpload.status}`);
    assert(anonymousUpload.data.reason === 'anonymous', 'Expected anonymous upload to fail as anonymous');

    const adminLogin = await loginWithCsrf(server, {
      username: 'studio',
      password: 'AIGS2026!'
    });
    assert(adminLogin.response.status === 200, `Expected admin login before upload tests to succeed, got ${adminLogin.response.status}`);
    const uploadCookies = mergeCookieHeaders(adminLogin.csrfCookieHeader, adminLogin.sessionCookieHeader);

    const unsupportedExtension = await request(server, '/api/upload', 'POST', {
      filename: 'notes.txt',
      data: Buffer.from('plain text').toString('base64')
    }, {
      Cookie: uploadCookies,
      'X-CSRF-Token': adminLogin.csrfToken
    });
    assert(unsupportedExtension.status === 200, `Expected unsupported extension upload to return 200 payload error, got ${unsupportedExtension.status}`);
    assert(unsupportedExtension.data.reason === 'unsupported_file_type', 'Expected unsupported extension upload to fail with unsupported_file_type');

    const mismatchedContent = await request(server, '/api/upload', 'POST', {
      filename: 'clip.mp3',
      data: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).toString('base64')
    }, {
      Cookie: uploadCookies,
      'X-CSRF-Token': adminLogin.csrfToken
    });
    assert(mismatchedContent.status === 200, `Expected mismatched upload content to return 200 payload error, got ${mismatchedContent.status}`);
    assert(mismatchedContent.data.reason === 'invalid_file_content', 'Expected mismatched upload content to fail with invalid_file_content');

    const oversizedUpload = await request(server, '/api/upload', 'POST', {
      filename: 'clip.mp3',
      data: 'A'.repeat(128)
    }, {
      Cookie: uploadCookies,
      'X-CSRF-Token': adminLogin.csrfToken
    });
    assert(oversizedUpload.status === 413, `Expected oversized upload to return 413, got ${oversizedUpload.status}`);
    assert(oversizedUpload.data.reason === 'upload_too_large', 'Expected oversized upload to fail with upload_too_large');
  }, {
    env: {
      PORT: '18809',
      MAX_UPLOAD_BYTES: '32'
    }
  });
}

async function main() {
  await testHealthAndSecurityHeaders();
  await testSameOriginAndAllowedCors();
  await testDisallowedOriginAndSecureCookie();
  await testMalformedCookieAndOutputPathHandling();
  await testAdminAccessBoundaries();
  await testUploadInputGuards();
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
