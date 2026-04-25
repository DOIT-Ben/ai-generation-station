const fs = require('fs');
const os = require('os');
const path = require('path');
const { createServer } = require('./server/index');
const { createConfig } = require('./server/config');
const { dispatchRequest } = require('./test-live-utils');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function request(server, requestPath, method, body, options = {}) {
  return dispatchRequest(server, requestPath, method, body, options);
}

function getSetCookies(response) {
  const raw = response.headers['set-cookie'];
  if (!raw) return [];
  return Array.isArray(raw) ? raw : [raw];
}

function cookieHeaderFrom(response) {
  return getSetCookies(response)
    .map(cookie => String(cookie || '').split(';')[0])
    .filter(Boolean)
    .join('; ');
}

async function withServer(fn, options = {}) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aigs-body-limit-'));
  const stateDb = path.join(tempRoot, 'app-state.sqlite');
  const server = createServer({
    config: createConfig({
      env: {
        ...process.env,
        PORT: '18816',
        APP_STATE_DB: stateDb,
        MAX_JSON_BODY_BYTES: '256',
        MAX_UPLOAD_BYTES: '64',
        ...(options.env || {})
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

async function main() {
  await withServer(async server => {
    const csrf = await request(server, '/api/auth/csrf', 'GET');
    const csrfHeaders = {
      Cookie: cookieHeaderFrom(csrf),
      'X-CSRF-Token': csrf.data.csrfToken
    };

    const invalidJson = await request(server, '/api/auth/login', 'POST', '{"broken":', {
      raw: true,
      headers: { ...csrfHeaders, 'Content-Type': 'application/json' }
    });
    assert(invalidJson.status === 400, `expected invalid JSON to return 400, got ${invalidJson.status}`);

    const oversized = await request(server, '/api/auth/login', 'POST', {
      username: 'studio',
      password: 'x'.repeat(512)
    }, { headers: csrfHeaders });
    assert(oversized.status === 413, `expected oversized JSON to return 413, got ${oversized.status}`);
    assert(oversized.data?.reason === 'body_too_large', 'expected oversized JSON response reason body_too_large');

    const health = await request(server, '/api/health', 'GET');
    assert(health.status === 200, `expected health check after oversized body to return 200, got ${health.status}`);
  });

  console.log('HTTP body limit tests passed');
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
