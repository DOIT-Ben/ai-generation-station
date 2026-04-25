const fs = require('fs');
const os = require('os');
const path = require('path');
const { createServer } = require('./server/index');
const { createConfig } = require('./server/config');
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
  const mergedCookie = [headers.Cookie || headers.cookie, csrfCookie].filter(Boolean).join('; ');
  return dispatchRequest(server, requestPath, method, body, {
    headers: {
      ...headers,
      ...(mergedCookie ? { Cookie: mergedCookie } : {}),
      ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {})
    }
  });
}

async function login(server) {
  const login = await request(server, '/api/auth/login', 'POST', {
    username: 'studio',
    password: 'AIGS2026!'
  });
  assert(login.status === 200, `Expected login to return 200, got ${login.status}`);
  const cookie = extractCookieHeader(login.headers?.['set-cookie']);
  assert(Boolean(cookie), 'Expected login to return a session cookie');
  return { Cookie: cookie };
}

async function withServer(fn) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aigs-upload-magic-'));
  const stateDb = path.join(tempRoot, 'app-state.sqlite');
  const outputDir = path.join(tempRoot, 'output');
  fs.mkdirSync(outputDir, { recursive: true });
  const server = createServer({
    config: createConfig({
      env: {
        ...process.env,
        PORT: '18810',
        APP_STATE_DB: stateDb,
        OUTPUT_DIR: outputDir,
        APP_USERNAME: 'studio',
        APP_PASSWORD: 'AIGS2026!'
      }
    })
  });

  try {
    return await fn(server, { outputDir });
  } finally {
    server.appStateStore?.close?.();
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

function asBase64(buffer) {
  return Buffer.from(buffer).toString('base64');
}

function pngBuffer() {
  return Buffer.from([
    0x89, 0x50, 0x4e, 0x47,
    0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x00
  ]);
}

async function testRejectsTextDisguisedAsMp3() {
  await withServer(async server => {
    const authHeaders = await login(server);
    const response = await request(server, '/api/upload', 'POST', {
      filename: 'fake.mp3',
      data: asBase64(Buffer.from('not really an audio file'))
    }, authHeaders);

    assert(response.status === 200, `Expected upload validation response to use 200 envelope, got ${response.status}`);
    assert(response.data.success !== true, 'Expected fake mp3 upload to be rejected');
    assert(response.data.reason === 'invalid_file_content', 'Expected fake mp3 rejection to use invalid_file_content');
  });
}

async function testRejectsContentExtensionMismatch() {
  await withServer(async server => {
    const authHeaders = await login(server);
    const response = await request(server, '/api/upload', 'POST', {
      filename: 'image-renamed.mp3',
      data: asBase64(pngBuffer())
    }, authHeaders);

    assert(response.status === 200, `Expected upload validation response to use 200 envelope, got ${response.status}`);
    assert(response.data.success !== true, 'Expected mismatched upload to be rejected');
    assert(response.data.reason === 'invalid_file_content', 'Expected mismatched upload to use invalid_file_content');
  });
}

async function testAllowsMatchingPngUpload() {
  await withServer(async (server, { outputDir }) => {
    const authHeaders = await login(server);
    const response = await request(server, '/api/upload', 'POST', {
      filename: 'valid.png',
      data: asBase64(pngBuffer())
    }, authHeaders);

    assert(response.status === 200, `Expected valid png upload to return 200, got ${response.status}`);
    assert(response.data.success === true, 'Expected valid png upload to succeed');
    assert(response.data.filename.endsWith('.png'), 'Expected uploaded file to keep png extension');
    assert(fs.existsSync(path.join(outputDir, response.data.filename)), 'Expected valid upload to be written to output dir');
  });
}

async function main() {
  await testRejectsTextDisguisedAsMp3();
  await testRejectsContentExtensionMismatch();
  await testAllowsMatchingPngUpload();
  console.log('Upload magic byte tests passed');
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
