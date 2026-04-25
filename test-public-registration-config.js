const fs = require('fs');
const os = require('os');
const path = require('path');
const { createConfig } = require('./server/config');
const { createServer } = require('./server/index');
const { dispatchRequest } = require('./test-live-utils');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function extractCookieHeader(rawSetCookieHeader) {
  if (!rawSetCookieHeader) return '';
  const items = Array.isArray(rawSetCookieHeader) ? rawSetCookieHeader : [rawSetCookieHeader];
  return items
    .map(item => String(item || '').split(';')[0].trim())
    .filter(Boolean)
    .join('; ');
}

async function request(server, requestPath, method, body, headers = {}) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(String(method || 'GET').toUpperCase())) {
    return dispatchRequest(server, requestPath, method, body, { headers });
  }

  const csrfBootstrap = await dispatchRequest(server, '/api/auth/csrf', 'GET', null, { headers });
  const csrfToken = csrfBootstrap.data?.csrfToken;
  const csrfCookie = extractCookieHeader(csrfBootstrap.headers?.['set-cookie']);
  return dispatchRequest(server, requestPath, method, body, {
    headers: {
      ...headers,
      ...(csrfCookie ? { Cookie: csrfCookie } : {}),
      ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {})
    }
  });
}

async function withServer(env, fn) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aigs-public-register-'));
  const stateDb = path.join(tempRoot, 'app-state.sqlite');
  const server = createServer({
    config: createConfig({
      env: {
        ...process.env,
        PORT: '18809',
        APP_STATE_DB: stateDb,
        APP_USERNAME: 'studio',
        APP_PASSWORD: 'AIGS2026!',
        ...env
      }
    })
  });

  try {
    return await fn(server);
  } finally {
    server.appStateStore?.close?.();
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

function testConfigDefaultsClosed() {
  const config = createConfig({
    env: {
      ...process.env,
      PUBLIC_REGISTRATION_ENABLED: undefined
    }
  });
  assert(config.PUBLIC_REGISTRATION_ENABLED === false, 'PUBLIC_REGISTRATION_ENABLED should default to false');
}

function testConfigExplicitlyEnablesRegistration() {
  const config = createConfig({
    env: {
      ...process.env,
      PUBLIC_REGISTRATION_ENABLED: 'true'
    }
  });
  assert(config.PUBLIC_REGISTRATION_ENABLED === true, 'PUBLIC_REGISTRATION_ENABLED=true should explicitly enable registration');
}

async function testDefaultApiRejectsPublicRegistration() {
  await withServer({ PUBLIC_REGISTRATION_ENABLED: undefined }, async server => {
    const response = await request(server, '/api/auth/register', 'POST', {
      username: 'public-user',
      email: 'public-user@example.com',
      password: 'PublicUser2026!'
    });

    assert(response.status === 403, `Expected default public registration to return 403, got ${response.status}`);
    assert(response.data.reason === 'public_registration_disabled', 'Expected default public registration to be disabled');
  });
}

async function testExplicitApiAllowsPublicRegistration() {
  await withServer({ PUBLIC_REGISTRATION_ENABLED: 'true' }, async server => {
    const response = await request(server, '/api/auth/register', 'POST', {
      username: 'public-user',
      email: 'public-user@example.com',
      password: 'PublicUser2026!'
    });

    assert(response.status === 200, `Expected explicitly enabled public registration to return 200, got ${response.status}`);
    assert(response.data.success === true, 'Expected explicitly enabled public registration to succeed');
    assert(response.data.user?.username === 'public-user', 'Expected registered user payload to be returned');
    assert(server.appStateStore.getUserByUsername('public-user'), 'Expected registered user to be persisted');
  });
}

async function main() {
  testConfigDefaultsClosed();
  testConfigExplicitlyEnablesRegistration();
  await testDefaultApiRejectsPublicRegistration();
  await testExplicitApiAllowsPublicRegistration();
  console.log('Public registration config tests passed');
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
