const fs = require('fs');
const os = require('os');
const path = require('path');
const { createServer } = require('./server/index');
const { createConfig } = require('./server/config');
const { dispatchRequest } = require('./test-live-utils');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function request(server, requestPath, method, body, headers = {}) {
  return dispatchRequest(server, requestPath, method, body, { headers });
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

async function login(server) {
  const csrf = await request(server, '/api/auth/csrf', 'GET');
  const csrfCookie = cookieHeaderFrom(csrf);
  const loginResponse = await request(server, '/api/auth/login', 'POST', {
    username: 'studio',
    password: 'AIGS2026!'
  }, {
    Cookie: csrfCookie,
    'X-CSRF-Token': csrf.data.csrfToken
  });
  assert(loginResponse.status === 200, `expected login to succeed, got ${loginResponse.status}`);
  return {
    Cookie: [csrfCookie, cookieHeaderFrom(loginResponse)].filter(Boolean).join('; ')
  };
}

async function withServer(fn) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aigs-output-boundary-'));
  const stateDb = path.join(tempRoot, 'app-state.sqlite');
  const outputDir = path.join(tempRoot, 'output');
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, 'sample.txt'), 'private-output');
  fs.writeFileSync(path.join(tempRoot, 'outside.txt'), 'outside-output');

  const server = createServer({
    config: createConfig({
      env: {
        ...process.env,
        PORT: '18817',
        APP_STATE_DB: stateDb,
        OUTPUT_DIR: outputDir,
        APP_USERNAME: 'studio',
        APP_PASSWORD: 'AIGS2026!'
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
    const anonymous = await request(server, '/output/sample.txt', 'GET');
    assert([401, 403].includes(anonymous.status), `expected anonymous output access to be blocked, got ${anonymous.status}`);

    const authHeaders = await login(server);
    const legal = await request(server, '/output/sample.txt', 'GET', null, authHeaders);
    assert(legal.status === 200, `expected authenticated legal output access to return 200, got ${legal.status}`);
    assert(legal.rawBody === 'private-output', 'expected legal output response body to match the file');

    const encodedQuery = await request(server, '/output/sample.txt?download=1', 'GET', null, authHeaders);
    assert(encodedQuery.status === 200, `expected query suffix not to break legal output access, got ${encodedQuery.status}`);

    const traversalPaths = [
      '/output/../outside.txt',
      '/output/%2e%2e/outside.txt',
      '/output/..%5Coutside.txt',
      '/output/%2e%2e%5Coutside.txt'
    ];

    for (const traversalPath of traversalPaths) {
      const response = await request(server, traversalPath, 'GET', null, authHeaders);
      assert([403, 404].includes(response.status), `expected ${traversalPath} to be rejected, got ${response.status}`);
      assert(response.rawBody !== 'outside-output', `expected ${traversalPath} not to expose outside file contents`);
    }
  });

  console.log('Output access boundary tests passed');
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
