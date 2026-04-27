const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
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

async function withListeningServer(fn, options = {}) {
  await withServer(async server => {
    const port = Number((options.env && options.env.PORT) || 18820);
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, '127.0.0.1', () => {
        server.off('error', reject);
        resolve();
      });
    });

    try {
      return await fn(server, port);
    } finally {
      await new Promise(resolve => server.close(() => resolve()));
    }
  }, options);
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

function getPreviewToken(previewUrl, key) {
  const url = new URL(String(previewUrl || ''), 'http://localhost');
  return String(url.searchParams.get(key) || '').trim();
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

function requestOverNetwork(port, requestPath, method, body, headers = {}, options = {}) {
  return new Promise((resolve, reject) => {
    const payload = options.raw
      ? String(body || '')
      : body == null
        ? null
        : JSON.stringify(body);
    const normalizedHeaders = Object.entries(headers).reduce((acc, [name, value]) => {
      acc[String(name)] = value;
      return acc;
    }, {});

    if (payload && !normalizedHeaders['Content-Type']) {
      normalizedHeaders['Content-Type'] = 'application/json';
    }
    if (payload && !normalizedHeaders['Content-Length']) {
      normalizedHeaders['Content-Length'] = String(Buffer.byteLength(payload));
    }

    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path: requestPath,
      method,
      headers: normalizedHeaders
    }, res => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        let data = raw;
        try {
          data = JSON.parse(raw);
        } catch {}
        resolve({
          status: res.statusCode,
          data,
          headers: Object.fromEntries(Object.entries(res.headers).map(([name, value]) => [String(name).toLowerCase(), value])),
          rawBody: raw
        });
      });
    });

    req.on('error', reject);
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
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

async function registerWithCsrfOverNetwork(port, payload, headers = {}) {
  const csrf = await requestOverNetwork(port, '/api/auth/csrf', 'GET', null, headers);
  assert(csrf.status === 200, `Expected network CSRF bootstrap before register to return 200, got ${csrf.status}`);
  const csrfCookie = findCookie(csrf, 'aigs_csrf');
  const response = await requestOverNetwork(port, '/api/auth/register', 'POST', payload, {
    ...headers,
    Cookie: mergeCookieHeaders(headers.Cookie, getCookieHeader(csrfCookie)),
    'X-CSRF-Token': csrf.data?.csrfToken
  });
  return {
    response,
    csrfToken: csrf.data?.csrfToken || null,
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

async function testRateLimitsAndAuditTrails() {
  await withServer(async server => {
    const uniqueSuffix = `${Date.now()}${Math.random().toString(16).slice(2, 8)}`;
    const targetUsername = `invite_${uniqueSuffix}`;
    const targetEmail = `${targetUsername}@example.com`;

    const adminLogin = await loginWithCsrf(server, {
      username: 'studio',
      password: 'AIGS2026!'
    });
    assert(adminLogin.response.status === 200, `Expected admin login before rate-limit tests to succeed, got ${adminLogin.response.status}`);
    const adminCookies = mergeCookieHeaders(adminLogin.csrfCookieHeader, adminLogin.sessionCookieHeader);

    const createUser = await request(server, '/api/admin/users', 'POST', {
      username: targetUsername,
      email: targetEmail,
      password: 'InvitePass123!',
      displayName: 'Invite Target',
      role: 'user',
      planCode: 'free'
    }, {
      Cookie: adminCookies,
      'X-CSRF-Token': adminLogin.csrfToken
    });
    assert(createUser.status === 200, `Expected admin create-user before invite tests to succeed, got ${createUser.status}`);
    const targetUserId = createUser.data?.user?.id;
    assert(Boolean(targetUserId), 'Expected admin create-user response to include target user id');

    const inviteIssue = await request(server, `/api/admin/users/${targetUserId}/invite`, 'POST', {}, {
      Cookie: adminCookies,
      'X-CSRF-Token': adminLogin.csrfToken
    });
    assert(inviteIssue.status === 200, `Expected invite issue to succeed, got ${inviteIssue.status}`);

    const inviteResend = await request(server, `/api/admin/users/${targetUserId}/invite-resend`, 'POST', {}, {
      Cookie: adminCookies,
      'X-CSRF-Token': adminLogin.csrfToken
    });
    assert(inviteResend.status === 200, `Expected invite resend to succeed, got ${inviteResend.status}`);

    const inviteRevoke = await request(server, `/api/admin/users/${targetUserId}/invite-revoke`, 'POST', {}, {
      Cookie: adminCookies,
      'X-CSRF-Token': adminLogin.csrfToken
    });
    assert(inviteRevoke.status === 200, `Expected invite revoke to succeed, got ${inviteRevoke.status}`);

    const inviteIssueLogs = await request(
      server,
      `/api/admin/audit-logs?action=user_invite_issue&targetUsername=${encodeURIComponent(targetUsername)}`,
      'GET',
      null,
      { Cookie: adminLogin.sessionCookieHeader }
    );
    assert(inviteIssueLogs.status === 200, `Expected invite issue audit-log query to succeed, got ${inviteIssueLogs.status}`);
    const inviteIssueEntry = Array.isArray(inviteIssueLogs.data?.items)
      ? inviteIssueLogs.data.items.find(item => item.action === 'user_invite_issue' && item.targetUsername === targetUsername)
      : null;
    assert(Boolean(inviteIssueEntry), 'Expected invite issue audit log entry to exist');
    assert(inviteIssueEntry.details?.recipientEmail === targetEmail, 'Expected invite issue audit log to capture recipientEmail');

    const inviteResendLogs = await request(
      server,
      `/api/admin/audit-logs?action=user_invite_resend&targetUsername=${encodeURIComponent(targetUsername)}`,
      'GET',
      null,
      { Cookie: adminLogin.sessionCookieHeader }
    );
    assert(inviteResendLogs.status === 200, `Expected invite resend audit-log query to succeed, got ${inviteResendLogs.status}`);
    const inviteResendEntry = Array.isArray(inviteResendLogs.data?.items)
      ? inviteResendLogs.data.items.find(item => item.action === 'user_invite_resend' && item.targetUsername === targetUsername)
      : null;
    assert(Boolean(inviteResendEntry), 'Expected invite resend audit log entry to exist');
    assert(inviteResendEntry.details?.recipientEmail === targetEmail, 'Expected invite resend audit log to capture recipientEmail');

    const inviteRevokeLogs = await request(
      server,
      `/api/admin/audit-logs?action=user_invite_revoke&targetUsername=${encodeURIComponent(targetUsername)}`,
      'GET',
      null,
      { Cookie: adminLogin.sessionCookieHeader }
    );
    assert(inviteRevokeLogs.status === 200, `Expected invite revoke audit-log query to succeed, got ${inviteRevokeLogs.status}`);
    const inviteRevokeEntry = Array.isArray(inviteRevokeLogs.data?.items)
      ? inviteRevokeLogs.data.items.find(item => item.action === 'user_invite_revoke' && item.targetUsername === targetUsername)
      : null;
    assert(Boolean(inviteRevokeEntry), 'Expected invite revoke audit log entry to exist');
    assert(Number(inviteRevokeEntry.details?.revokedCount || 0) >= 1, 'Expected invite revoke audit log to capture revokedCount');

    const resetPassword = await request(server, `/api/admin/users/${targetUserId}/password`, 'POST', {
      password: 'InvitePass456!'
    }, {
      Cookie: adminCookies,
      'X-CSRF-Token': adminLogin.csrfToken
    });
    assert(resetPassword.status === 200, `Expected admin password reset to succeed, got ${resetPassword.status}`);
    assert(resetPassword.data?.sessionRetained === false, 'Expected admin reset of another user to not retain the admin session on target');

    const resetPasswordLogs = await request(
      server,
      `/api/admin/audit-logs?action=user_password_reset&targetUsername=${encodeURIComponent(targetUsername)}`,
      'GET',
      null,
      { Cookie: adminLogin.sessionCookieHeader }
    );
    assert(resetPasswordLogs.status === 200, `Expected password reset audit-log query to succeed, got ${resetPasswordLogs.status}`);
    const resetPasswordEntry = Array.isArray(resetPasswordLogs.data?.items)
      ? resetPasswordLogs.data.items.find(item => item.action === 'user_password_reset' && item.targetUsername === targetUsername)
      : null;
    assert(Boolean(resetPasswordEntry), 'Expected password reset audit log entry to exist');
    assert(resetPasswordEntry.details?.requirePasswordChange === true, 'Expected password reset audit log to mark requirePasswordChange');
    assert(resetPasswordEntry.details?.sessionRetained === false, 'Expected password reset audit log to capture sessionRetained=false');

    const secondResetPassword = await request(server, `/api/admin/users/${targetUserId}/password`, 'POST', {
      password: 'InvitePass789!'
    }, {
      Cookie: adminCookies,
      'X-CSRF-Token': adminLogin.csrfToken
    });
    assert(secondResetPassword.status === 429, `Expected second admin password reset to be rate-limited, got ${secondResetPassword.status}`);
    assert(secondResetPassword.data?.reason === 'admin_password_reset_rate_limited', 'Expected second admin password reset to hit admin_password_reset_rate_limited');

    const forgotPasswordCsrf = await bootstrapCsrf(server);
    assert(forgotPasswordCsrf.response.status === 200, `Expected CSRF bootstrap before forgot-password tests to return 200, got ${forgotPasswordCsrf.response.status}`);
    const forgotPasswordHeaders = {
      Cookie: forgotPasswordCsrf.csrfCookieHeader,
      'X-CSRF-Token': forgotPasswordCsrf.csrfToken
    };

    const firstForgotPassword = await request(server, '/api/auth/forgot-password', 'POST', {
      username: targetUsername
    }, forgotPasswordHeaders);
    assert(firstForgotPassword.status === 200, `Expected first forgot-password request to succeed, got ${firstForgotPassword.status}`);

    const secondForgotPassword = await request(server, '/api/auth/forgot-password', 'POST', {
      username: targetUsername
    }, forgotPasswordHeaders);
    assert(secondForgotPassword.status === 429, `Expected second forgot-password request to be rate-limited, got ${secondForgotPassword.status}`);
    assert(secondForgotPassword.data?.reason === 'forgot_password_rate_limited', 'Expected second forgot-password request to hit forgot_password_rate_limited');
  }, {
    env: {
      PORT: '18810',
      FORGOT_PASSWORD_RATE_LIMIT_MAX: '1',
      ADMIN_PASSWORD_RESET_RATE_LIMIT_MAX: '1'
    }
  });
}

async function testProxyHeaderTrustBoundaries() {
  await withServer(async server => {
    const forgotPasswordCsrf = await bootstrapCsrf(server);
    assert(forgotPasswordCsrf.response.status === 200, `Expected CSRF bootstrap before proxy X-Forwarded-For tests to return 200, got ${forgotPasswordCsrf.response.status}`);

    const baseHeaders = {
      Cookie: forgotPasswordCsrf.csrfCookieHeader,
      'X-CSRF-Token': forgotPasswordCsrf.csrfToken
    };

    const firstForwardedFor = await request(server, '/api/auth/forgot-password', 'POST', {
      username: 'studio'
    }, {
      ...baseHeaders,
      'X-Forwarded-For': 'garbage-one, 198.51.100.10'
    });
    assert(firstForwardedFor.status === 200, `Expected first forwarded-for forgot-password request to succeed, got ${firstForwardedFor.status}`);

    const secondForwardedFor = await request(server, '/api/auth/forgot-password', 'POST', {
      username: 'studio'
    }, {
      ...baseHeaders,
      'X-Forwarded-For': 'garbage-two, 198.51.100.10'
    });
    assert(secondForwardedFor.status === 429, `Expected second forwarded-for forgot-password request to be rate-limited, got ${secondForwardedFor.status}`);
    assert(secondForwardedFor.data?.reason === 'forgot_password_rate_limited', 'Expected second forwarded-for forgot-password request to hit forgot_password_rate_limited');
  }, {
    env: {
      PORT: '18813',
      TRUST_PROXY: 'true',
      FORGOT_PASSWORD_RATE_LIMIT_MAX: '1'
    }
  });

  await withServer(async server => {
    const forgotPasswordCsrf = await bootstrapCsrf(server);
    assert(forgotPasswordCsrf.response.status === 200, `Expected CSRF bootstrap before proxy X-Real-IP tests to return 200, got ${forgotPasswordCsrf.response.status}`);

    const baseHeaders = {
      Cookie: forgotPasswordCsrf.csrfCookieHeader,
      'X-CSRF-Token': forgotPasswordCsrf.csrfToken
    };

    const firstRealIp = await request(server, '/api/auth/forgot-password', 'POST', {
      username: 'studio'
    }, {
      ...baseHeaders,
      'X-Real-IP': 'garbage-real-one'
    });
    assert(firstRealIp.status === 200, `Expected first real-ip forgot-password request to succeed, got ${firstRealIp.status}`);

    const secondRealIp = await request(server, '/api/auth/forgot-password', 'POST', {
      username: 'studio'
    }, {
      ...baseHeaders,
      'X-Real-IP': 'garbage-real-two'
    });
    assert(secondRealIp.status === 429, `Expected second real-ip forgot-password request to be rate-limited, got ${secondRealIp.status}`);
    assert(secondRealIp.data?.reason === 'forgot_password_rate_limited', 'Expected second real-ip forgot-password request to hit forgot_password_rate_limited');
  }, {
    env: {
      PORT: '18814',
      TRUST_PROXY: 'true',
      FORGOT_PASSWORD_RATE_LIMIT_MAX: '1'
    }
  });

  await withServer(async server => {
    const spoofedCsrfBootstrap = await request(server, '/api/auth/csrf', 'GET', null, {
      Host: 'localhost:18815',
      'X-Forwarded-Proto': 'https'
    });
    assert(spoofedCsrfBootstrap.status === 200, `Expected spoofed proto CSRF bootstrap to return 200, got ${spoofedCsrfBootstrap.status}`);
    assert(
      spoofedCsrfBootstrap.headers['strict-transport-security'] === undefined,
      'Expected untrusted forwarded proto to not enable Strict-Transport-Security'
    );
    const spoofedCsrfCookie = findCookie(spoofedCsrfBootstrap, 'aigs_csrf');
    assert(Boolean(spoofedCsrfCookie), 'Expected spoofed proto CSRF bootstrap to set the CSRF cookie');
    assert(!String(spoofedCsrfCookie).includes('Secure'), 'Expected untrusted forwarded proto to not mark the CSRF cookie as Secure');
  }, {
    env: {
      PORT: '18815'
    }
  });
}

async function testOriginAndProxyProtocolBoundaries() {
  await withServer(async server => {
    const hostMismatch = await request(server, '/api/health', 'GET', null, {
      Host: 'localhost:18818',
      Origin: 'http://localhost:29999'
    });
    assert(hostMismatch.status === 403, `Expected host/origin mismatch request to return 403, got ${hostMismatch.status}`);
    assert(hostMismatch.data?.reason === 'origin_not_allowed', 'Expected host/origin mismatch request to fail with origin_not_allowed');
    assert(hostMismatch.headers['access-control-allow-origin'] === undefined, 'Expected host/origin mismatch request to not echo Access-Control-Allow-Origin');

    const malformedOrigin = await request(server, '/api/health', 'GET', null, {
      Host: 'localhost:18818',
      Origin: 'https://studio.example.com, https://evil.example.com'
    });
    assert(malformedOrigin.status === 403, `Expected malformed origin request to return 403, got ${malformedOrigin.status}`);
    assert(malformedOrigin.data?.reason === 'origin_not_allowed', 'Expected malformed origin request to fail with origin_not_allowed');
    assert(String(malformedOrigin.headers['vary'] || '').includes('Origin'), 'Expected malformed origin request to include Vary: Origin');
  }, {
    env: {
      PORT: '18818'
    }
  });

  await withServer(async server => {
    const proxiedHttpBootstrap = await request(server, '/api/auth/csrf', 'GET', null, {
      Host: 'studio.example.com',
      Origin: 'https://studio.example.com',
      'X-Forwarded-Proto': 'garbage, http, https'
    });
    assert(proxiedHttpBootstrap.status === 200, `Expected proxied http-first CSRF bootstrap to return 200, got ${proxiedHttpBootstrap.status}`);
    assert(
      proxiedHttpBootstrap.headers['strict-transport-security'] === undefined,
      'Expected http-first forwarded proto chain to not enable Strict-Transport-Security'
    );
    const proxiedHttpCookie = findCookie(proxiedHttpBootstrap, 'aigs_csrf');
    assert(Boolean(proxiedHttpCookie), 'Expected http-first forwarded proto chain to set the CSRF cookie');
    assert(!String(proxiedHttpCookie).includes('Secure'), 'Expected http-first forwarded proto chain to keep CSRF cookie non-secure');

    const proxiedHttpsBootstrap = await request(server, '/api/auth/csrf', 'GET', null, {
      Host: 'studio.example.com',
      Origin: 'https://studio.example.com',
      'X-Forwarded-Proto': 'garbage, https, http'
    });
    assert(proxiedHttpsBootstrap.status === 200, `Expected proxied https-first CSRF bootstrap to return 200, got ${proxiedHttpsBootstrap.status}`);
    assert(
      proxiedHttpsBootstrap.headers['strict-transport-security'] === 'max-age=31536000; includeSubDomains',
      'Expected https-first forwarded proto chain to enable Strict-Transport-Security'
    );
    const proxiedHttpsCookie = findCookie(proxiedHttpsBootstrap, 'aigs_csrf');
    assert(Boolean(proxiedHttpsCookie), 'Expected https-first forwarded proto chain to set the CSRF cookie');
    assert(String(proxiedHttpsCookie).includes('Secure'), 'Expected https-first forwarded proto chain to mark the CSRF cookie as Secure');
  }, {
    env: {
      PORT: '18819',
      TRUST_PROXY: 'true',
      ALLOWED_ORIGINS: 'https://studio.example.com'
    }
  });
}

async function testPublicRegistrationRateLimitAndAudit() {
  await withServer(async server => {
    const uniqueSuffix = `${Date.now()}${Math.random().toString(16).slice(2, 8)}`;
    const firstUsername = `register_${uniqueSuffix}_a`;
    const firstEmail = `${firstUsername}@example.com`;
    const secondUsername = `register_${uniqueSuffix}_b`;
    const secondEmail = `${secondUsername}@example.com`;

    const firstRegistration = await registerWithCsrf(server, {
      username: firstUsername,
      email: firstEmail,
      password: 'RegisterPass123!',
      displayName: 'Register One'
    });
    assert(firstRegistration.response.status === 200, `Expected first public registration to succeed, got ${firstRegistration.response.status}`);

    const secondRegistration = await registerWithCsrf(server, {
      username: secondUsername,
      email: secondEmail,
      password: 'RegisterPass456!',
      displayName: 'Register Two'
    });
    assert(secondRegistration.response.status === 429, `Expected second public registration to be rate-limited, got ${secondRegistration.response.status}`);
    assert(secondRegistration.response.data?.reason === 'public_register_rate_limited', 'Expected second public registration to hit public_register_rate_limited');

    const adminLogin = await loginWithCsrf(server, {
      username: 'studio',
      password: 'AIGS2026!'
    });
    assert(adminLogin.response.status === 200, `Expected admin login after public registration to succeed, got ${adminLogin.response.status}`);

    const auditLogs = await request(
      server,
      `/api/admin/audit-logs?action=user_public_register&targetUsername=${encodeURIComponent(firstUsername)}`,
      'GET',
      null,
      { Cookie: adminLogin.sessionCookieHeader }
    );
    assert(auditLogs.status === 200, `Expected public-register audit-log query to succeed, got ${auditLogs.status}`);
    const registerEntry = Array.isArray(auditLogs.data?.items)
      ? auditLogs.data.items.find(item => item.action === 'user_public_register' && item.targetUsername === firstUsername)
      : null;
    assert(Boolean(registerEntry), 'Expected audit logs to contain the public registration record');
    assert(registerEntry.details?.email === firstEmail, 'Expected public registration audit log to capture email');
    assert(registerEntry.details?.source === 'public_registration', 'Expected public registration audit log to capture source');
  }, {
    env: {
      PORT: '18811',
      PUBLIC_REGISTRATION_ENABLED: 'true',
      PUBLIC_REGISTER_RATE_LIMIT_MAX: '1'
    }
  });
}

async function testAuditActorIpBoundaries() {
  await withServer(async server => {
    const uniqueSuffix = `${Date.now()}${Math.random().toString(16).slice(2, 8)}`;
    const forwardedUsername = `aif_${uniqueSuffix}`;
    const forwardedHeaders = {
      'X-Forwarded-For': 'garbage-forwarded, 198.51.100.20'
    };

    const forwardedRegistration = await registerWithCsrf(server, {
      username: forwardedUsername,
      email: `${forwardedUsername}@example.com`,
      password: 'AuditIpPass123!',
      displayName: 'Audit Forwarded'
    }, forwardedHeaders);
    assert(forwardedRegistration.response.status === 200, `Expected forwarded-for registration to succeed, got ${forwardedRegistration.response.status}`);

    const adminLogin = await loginWithCsrf(server, {
      username: 'studio',
      password: 'AIGS2026!'
    });
    assert(adminLogin.response.status === 200, `Expected admin login before forwarded-for audit lookup to succeed, got ${adminLogin.response.status}`);

    const forwardedAuditLogs = await request(
      server,
      `/api/admin/audit-logs?action=user_public_register&targetUsername=${encodeURIComponent(forwardedUsername)}`,
      'GET',
      null,
      { Cookie: adminLogin.sessionCookieHeader }
    );
    assert(forwardedAuditLogs.status === 200, `Expected forwarded-for audit-log query to succeed, got ${forwardedAuditLogs.status}`);
    const forwardedEntry = Array.isArray(forwardedAuditLogs.data?.items)
      ? forwardedAuditLogs.data.items.find(item => item.action === 'user_public_register' && item.targetUsername === forwardedUsername)
      : null;
    assert(Boolean(forwardedEntry), 'Expected forwarded-for audit entry to exist');
    assert(forwardedEntry.actorIp === '198.51.100.20', `Expected forwarded-for audit actorIp to resolve to 198.51.100.20, got ${forwardedEntry.actorIp}`);
  }, {
    env: {
      PORT: '18816',
      TRUST_PROXY: 'true',
      PUBLIC_REGISTRATION_ENABLED: 'true'
    }
  });

  await withServer(async server => {
    const uniqueSuffix = `${Date.now()}${Math.random().toString(16).slice(2, 8)}`;
    const realIpUsername = `air_${uniqueSuffix}`;
    const invalidRealIpHeaders = {
      'X-Real-IP': 'garbage-real-ip'
    };

    const realIpRegistration = await registerWithCsrf(server, {
      username: realIpUsername,
      email: `${realIpUsername}@example.com`,
      password: 'AuditIpPass456!',
      displayName: 'Audit RealIp'
    }, invalidRealIpHeaders);
    assert(realIpRegistration.response.status === 200, `Expected invalid real-ip registration to succeed, got ${realIpRegistration.response.status}`);

    const adminLogin = await loginWithCsrf(server, {
      username: 'studio',
      password: 'AIGS2026!'
    });
    assert(adminLogin.response.status === 200, `Expected admin login before invalid real-ip audit lookup to succeed, got ${adminLogin.response.status}`);

    const realIpAuditLogs = await request(
      server,
      `/api/admin/audit-logs?action=user_public_register&targetUsername=${encodeURIComponent(realIpUsername)}`,
      'GET',
      null,
      { Cookie: adminLogin.sessionCookieHeader }
    );
    assert(realIpAuditLogs.status === 200, `Expected invalid real-ip audit-log query to succeed, got ${realIpAuditLogs.status}`);
    const realIpEntry = Array.isArray(realIpAuditLogs.data?.items)
      ? realIpAuditLogs.data.items.find(item => item.action === 'user_public_register' && item.targetUsername === realIpUsername)
      : null;
    assert(Boolean(realIpEntry), 'Expected invalid real-ip audit entry to exist');
    assert(realIpEntry.actorIp === 'unknown', `Expected invalid real-ip audit actorIp to fall back to unknown in the mock transport, got ${realIpEntry.actorIp}`);
  }, {
    env: {
      PORT: '18817',
      TRUST_PROXY: 'true',
      PUBLIC_REGISTRATION_ENABLED: 'true'
    }
  });
}

async function testNetworkRemoteAddressFallbackBoundaries() {
  await withListeningServer(async (server, port) => {
    const uniqueSuffix = `${Date.now()}${Math.random().toString(16).slice(2, 8)}`;
    const username = `nra_${uniqueSuffix}`;

    const registration = await registerWithCsrfOverNetwork(port, {
      username,
      email: `${username}@example.com`,
      password: 'NetAuditPass123!',
      displayName: 'Network Fallback'
    }, {
      'X-Real-IP': 'garbage-real-ip'
    });
    assert(registration.response.status === 200, `Expected network invalid real-ip registration to succeed, got ${registration.response.status}`);

    const adminLogin = await loginWithCsrf(server, {
      username: 'studio',
      password: 'AIGS2026!'
    });
    assert(adminLogin.response.status === 200, `Expected admin login before network invalid real-ip audit lookup to succeed, got ${adminLogin.response.status}`);

    const auditLogs = await request(
      server,
      `/api/admin/audit-logs?action=user_public_register&targetUsername=${encodeURIComponent(username)}`,
      'GET',
      null,
      { Cookie: adminLogin.sessionCookieHeader }
    );
    assert(auditLogs.status === 200, `Expected network invalid real-ip audit-log query to succeed, got ${auditLogs.status}`);
    const entry = Array.isArray(auditLogs.data?.items)
      ? auditLogs.data.items.find(item => item.action === 'user_public_register' && item.targetUsername === username)
      : null;
    assert(Boolean(entry), 'Expected network invalid real-ip audit entry to exist');
    assert(entry.actorIp === '127.0.0.1', `Expected network invalid real-ip audit actorIp to fall back to 127.0.0.1, got ${entry.actorIp}`);
  }, {
    env: {
      PORT: '18820',
      TRUST_PROXY: 'true',
      PUBLIC_REGISTRATION_ENABLED: 'true'
    }
  });

  await withListeningServer(async (server, port) => {
    const uniqueSuffix = `${Date.now()}${Math.random().toString(16).slice(2, 8)}`;
    const username = `nrb_${uniqueSuffix}`;

    const registration = await registerWithCsrfOverNetwork(port, {
      username,
      email: `${username}@example.com`,
      password: 'NetAuditPass456!',
      displayName: 'Network Ignore Proxy'
    }, {
      'X-Forwarded-For': '198.51.100.30',
      'X-Real-IP': '198.51.100.31'
    });
    assert(registration.response.status === 200, `Expected network spoofed proxy registration to succeed, got ${registration.response.status}`);

    const adminLogin = await loginWithCsrf(server, {
      username: 'studio',
      password: 'AIGS2026!'
    });
    assert(adminLogin.response.status === 200, `Expected admin login before network spoofed proxy audit lookup to succeed, got ${adminLogin.response.status}`);

    const auditLogs = await request(
      server,
      `/api/admin/audit-logs?action=user_public_register&targetUsername=${encodeURIComponent(username)}`,
      'GET',
      null,
      { Cookie: adminLogin.sessionCookieHeader }
    );
    assert(auditLogs.status === 200, `Expected network spoofed proxy audit-log query to succeed, got ${auditLogs.status}`);
    const entry = Array.isArray(auditLogs.data?.items)
      ? auditLogs.data.items.find(item => item.action === 'user_public_register' && item.targetUsername === username)
      : null;
    assert(Boolean(entry), 'Expected network spoofed proxy audit entry to exist');
    assert(entry.actorIp === '127.0.0.1', `Expected network spoofed proxy audit actorIp to ignore proxy headers and stay 127.0.0.1, got ${entry.actorIp}`);
  }, {
    env: {
      PORT: '18821',
      TRUST_PROXY: 'false',
      PUBLIC_REGISTRATION_ENABLED: 'true'
    }
  });
}

async function testTokenLifecycleBoundaries() {
  await withServer(async server => {
    const uniqueSuffix = `${Date.now()}${Math.random().toString(16).slice(2, 8)}`;
    const targetUsername = `token_${uniqueSuffix}`;
    const targetEmail = `${targetUsername}@example.com`;
    const overlongToken = 'x'.repeat(4096);

    const adminLogin = await loginWithCsrf(server, {
      username: 'studio',
      password: 'AIGS2026!'
    });
    assert(adminLogin.response.status === 200, `Expected admin login before token lifecycle tests to succeed, got ${adminLogin.response.status}`);
    const adminCookies = mergeCookieHeaders(adminLogin.csrfCookieHeader, adminLogin.sessionCookieHeader);

    const createUser = await request(server, '/api/admin/users', 'POST', {
      username: targetUsername,
      email: targetEmail,
      password: 'TokenPass123!',
      displayName: 'Token Target',
      role: 'user',
      planCode: 'free'
    }, {
      Cookie: adminCookies,
      'X-CSRF-Token': adminLogin.csrfToken
    });
    assert(createUser.status === 200, `Expected admin create-user before token lifecycle tests to succeed, got ${createUser.status}`);
    const targetUserId = createUser.data?.user?.id;
    assert(Boolean(targetUserId), 'Expected token lifecycle test user id to exist');

    const missingInviteToken = await request(server, '/api/auth/invitation', 'GET');
    assert(missingInviteToken.status === 400, `Expected missing invitation token to return 400, got ${missingInviteToken.status}`);

    const issueInvite = await request(server, `/api/admin/users/${targetUserId}/invite`, 'POST', {}, {
      Cookie: adminCookies,
      'X-CSRF-Token': adminLogin.csrfToken
    });
    assert(issueInvite.status === 200, `Expected invite issue before lifecycle checks to succeed, got ${issueInvite.status}`);
    const inviteToken = getPreviewToken(issueInvite.data?.previewUrl, 'invite');
    assert(Boolean(inviteToken), 'Expected invite issue response to expose a preview invite token');

    const validInvite = await request(server, `/api/auth/invitation?token=${encodeURIComponent(inviteToken)}`, 'GET');
    assert(validInvite.status === 200, `Expected issued invite token to be queryable, got ${validInvite.status}`);

    const activateInvite = await request(server, '/api/auth/invitation/activate', 'POST', {
      token: inviteToken,
      password: 'TokenPass456!'
    }, {
      Cookie: adminCookies,
      'X-CSRF-Token': adminLogin.csrfToken
    });
    assert(activateInvite.status === 200, `Expected invite activation to succeed, got ${activateInvite.status}`);

    const reusedInviteGet = await request(server, `/api/auth/invitation?token=${encodeURIComponent(inviteToken)}`, 'GET');
    assert(reusedInviteGet.status === 404, `Expected consumed invite token lookup to return 404, got ${reusedInviteGet.status}`);
    assert(reusedInviteGet.data?.reason === 'token_invalid', 'Expected consumed invite token lookup to fail with token_invalid');

    const reusedInvitePost = await request(server, '/api/auth/invitation/activate', 'POST', {
      token: inviteToken,
      password: 'TokenPass789!'
    }, {
      Cookie: adminCookies,
      'X-CSRF-Token': adminLogin.csrfToken
    });
    assert(reusedInvitePost.status === 404, `Expected consumed invite token reuse to return 404, got ${reusedInvitePost.status}`);
    assert(reusedInvitePost.data?.reason === 'token_invalid', 'Expected consumed invite token reuse to fail with token_invalid');

    const missingResetToken = await request(server, '/api/auth/password-reset', 'GET');
    assert(missingResetToken.status === 400, `Expected missing password-reset token to return 400, got ${missingResetToken.status}`);

    const forgotPasswordCsrf = await bootstrapCsrf(server);
    assert(forgotPasswordCsrf.response.status === 200, `Expected CSRF bootstrap before password-reset lifecycle tests to return 200, got ${forgotPasswordCsrf.response.status}`);
    const forgotPassword = await request(server, '/api/auth/forgot-password', 'POST', {
      username: targetUsername
    }, {
      Cookie: forgotPasswordCsrf.csrfCookieHeader,
      'X-CSRF-Token': forgotPasswordCsrf.csrfToken
    });
    assert(forgotPassword.status === 200, `Expected forgot-password request to succeed, got ${forgotPassword.status}`);
    const resetToken = getPreviewToken(forgotPassword.data?.previewUrl, 'reset');
    assert(Boolean(resetToken), 'Expected forgot-password preview to expose a reset token');

    const validReset = await request(server, `/api/auth/password-reset?token=${encodeURIComponent(resetToken)}`, 'GET');
    assert(validReset.status === 200, `Expected issued password-reset token to be queryable, got ${validReset.status}`);

    const completeReset = await request(server, '/api/auth/password-reset/complete', 'POST', {
      token: resetToken,
      password: 'ResetPass123!'
    }, {
      Cookie: forgotPasswordCsrf.csrfCookieHeader,
      'X-CSRF-Token': forgotPasswordCsrf.csrfToken
    });
    assert(completeReset.status === 200, `Expected password-reset completion to succeed, got ${completeReset.status}`);

    const reusedResetGet = await request(server, `/api/auth/password-reset?token=${encodeURIComponent(resetToken)}`, 'GET');
    assert(reusedResetGet.status === 404, `Expected consumed password-reset token lookup to return 404, got ${reusedResetGet.status}`);
    assert(reusedResetGet.data?.reason === 'token_invalid', 'Expected consumed password-reset token lookup to fail with token_invalid');

    const reusedResetPost = await request(server, '/api/auth/password-reset/complete', 'POST', {
      token: resetToken,
      password: 'ResetPass456!'
    }, {
      Cookie: forgotPasswordCsrf.csrfCookieHeader,
      'X-CSRF-Token': forgotPasswordCsrf.csrfToken
    });
    assert(reusedResetPost.status === 404, `Expected consumed password-reset token reuse to return 404, got ${reusedResetPost.status}`);
    assert(reusedResetPost.data?.reason === 'token_invalid', 'Expected consumed password-reset token reuse to fail with token_invalid');

    const expiredReset = server.appStateStore.issueUserToken(targetUserId, 'password_reset', {
      ttlMs: 1,
      requestedIdentity: targetUsername,
      metadata: { source: 'test_expired_reset' }
    });
    assert(Boolean(expiredReset?.token), 'Expected direct expired-reset token issue to succeed');
    const originalDateNow = Date.now;
    let expiredResetLookup = null;
    try {
      Date.now = () => originalDateNow() + (2 * 60 * 1000);
      expiredResetLookup = await request(server, `/api/auth/password-reset?token=${encodeURIComponent(expiredReset.token)}`, 'GET');
    } finally {
      Date.now = originalDateNow;
    }
    assert(expiredResetLookup.status === 404, `Expected expired password-reset token lookup to return 404, got ${expiredResetLookup.status}`);
    assert(expiredResetLookup.data?.reason === 'token_invalid', 'Expected expired password-reset token lookup to fail with token_invalid');

    const expiredInvite = server.appStateStore.issueUserToken(targetUserId, 'invite_activation', {
      ttlMs: 1,
      requestedIdentity: targetUsername,
      metadata: { source: 'test_expired_invite' }
    });
    assert(Boolean(expiredInvite?.token), 'Expected direct expired-invite token issue to succeed');
    const originalDateNowForInvite = Date.now;
    let expiredInviteLookup = null;
    let expiredInviteActivate = null;
    try {
      Date.now = () => originalDateNowForInvite() + (2 * 60 * 1000);
      expiredInviteLookup = await request(server, `/api/auth/invitation?token=${encodeURIComponent(expiredInvite.token)}`, 'GET');
      expiredInviteActivate = await request(server, '/api/auth/invitation/activate', 'POST', {
        token: expiredInvite.token,
        password: 'TokenPass999!'
      }, {
        Cookie: adminCookies,
        'X-CSRF-Token': adminLogin.csrfToken
      });
    } finally {
      Date.now = originalDateNowForInvite;
    }
    assert(expiredInviteLookup.status === 404, `Expected expired invitation token lookup to return 404, got ${expiredInviteLookup.status}`);
    assert(expiredInviteLookup.data?.reason === 'token_invalid', 'Expected expired invitation token lookup to fail with token_invalid');
    assert(expiredInviteActivate.status === 404, `Expected expired invitation token activation to return 404, got ${expiredInviteActivate.status}`);
    assert(expiredInviteActivate.data?.reason === 'token_invalid', 'Expected expired invitation token activation to fail with token_invalid');

    const overlongInviteLookup = await request(server, `/api/auth/invitation?token=${overlongToken}`, 'GET');
    assert(overlongInviteLookup.status === 404, `Expected overlong invitation token lookup to return 404, got ${overlongInviteLookup.status}`);
    assert(overlongInviteLookup.data?.reason === 'token_invalid', 'Expected overlong invitation token lookup to fail with token_invalid');

    const malformedInviteLookup = await request(server, '/api/auth/invitation?token=%E0%A4%A', 'GET');
    assert(malformedInviteLookup.status === 404, `Expected malformed invitation token lookup to return 404, got ${malformedInviteLookup.status}`);
    assert(malformedInviteLookup.data?.reason === 'token_invalid', 'Expected malformed invitation token lookup to fail with token_invalid');

    const overlongInviteActivate = await request(server, '/api/auth/invitation/activate', 'POST', {
      token: overlongToken,
      password: 'TokenPass321!'
    }, {
      Cookie: adminCookies,
      'X-CSRF-Token': adminLogin.csrfToken
    });
    assert(overlongInviteActivate.status === 404, `Expected overlong invitation token activation to return 404, got ${overlongInviteActivate.status}`);
    assert(overlongInviteActivate.data?.reason === 'token_invalid', 'Expected overlong invitation token activation to fail with token_invalid');

    const malformedResetLookup = await request(server, '/api/auth/password-reset?token=%E0%A4%A', 'GET');
    assert(malformedResetLookup.status === 404, `Expected malformed password-reset token lookup to return 404, got ${malformedResetLookup.status}`);
    assert(malformedResetLookup.data?.reason === 'token_invalid', 'Expected malformed password-reset token lookup to fail with token_invalid');

    const overlongResetComplete = await request(server, '/api/auth/password-reset/complete', 'POST', {
      token: overlongToken,
      password: 'ResetPass789!'
    }, {
      Cookie: forgotPasswordCsrf.csrfCookieHeader,
      'X-CSRF-Token': forgotPasswordCsrf.csrfToken
    });
    assert(overlongResetComplete.status === 404, `Expected overlong password-reset completion to return 404, got ${overlongResetComplete.status}`);
    assert(overlongResetComplete.data?.reason === 'token_invalid', 'Expected overlong password-reset completion to fail with token_invalid');

    const malformedSessionCookie = await request(server, '/api/auth/session', 'GET', null, {
      Cookie: 'bad=%E0%A4%A; aigs_session=%E0%A4%A'
    });
    assert(malformedSessionCookie.status === 401, `Expected malformed session cookie request to return 401, got ${malformedSessionCookie.status}`);
    assert(malformedSessionCookie.data?.reason === 'session_expired', 'Expected malformed session cookie request to fail with session_expired');
    const clearedSessionCookie = findCookie(malformedSessionCookie, 'aigs_session');
    assert(Boolean(clearedSessionCookie), 'Expected malformed session cookie request to clear the broken session cookie');
    assert(String(clearedSessionCookie).includes('Max-Age=0'), 'Expected malformed session cookie response to expire the session cookie');
  }, {
    env: {
      PORT: '18812',
      PUBLIC_REGISTRATION_ENABLED: 'true',
      NOTIFICATION_DELIVERY_MODE: 'local_preview'
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
  await testRateLimitsAndAuditTrails();
  await testProxyHeaderTrustBoundaries();
  await testOriginAndProxyProtocolBoundaries();
  await testPublicRegistrationRateLimitAndAudit();
  await testAuditActorIpBoundaries();
  await testNetworkRemoteAddressFallbackBoundaries();
  await testTokenLifecycleBoundaries();
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
