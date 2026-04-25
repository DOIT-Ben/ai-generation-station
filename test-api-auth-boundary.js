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
    Cookie: [csrfCookie, cookieHeaderFrom(loginResponse)].filter(Boolean).join('; '),
    'X-CSRF-Token': csrf.data.csrfToken
  };
}

async function withServer(fn, options = {}) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aigs-auth-boundary-'));
  const stateDb = path.join(tempRoot, 'app-state.sqlite');
  const outputDir = path.join(tempRoot, 'output');
  fs.mkdirSync(outputDir, { recursive: true });
  const server = createServer({
    config: createConfig({
      env: {
        ...process.env,
        PORT: '18815',
        APP_STATE_DB: stateDb,
        OUTPUT_DIR: outputDir,
        APP_USERNAME: 'studio',
        APP_PASSWORD: 'AIGS2026!',
        MINIMAX_API_KEY: 'test-minimax-key',
        CHAT_API_KEY: 'test-chat-key',
        ...(options.env || {})
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

async function expectAnonymousBlocked(server, requestPath, method, body = null) {
  const response = await request(server, requestPath, method, body);
  assert(response.status === 401, `expected anonymous ${method} ${requestPath} to return 401, got ${response.status}`);
  assert(response.data?.reason, `expected anonymous ${method} ${requestPath} to include an auth reason`);
}

async function main() {
  await withServer(async (server, { outputDir }) => {
    fs.writeFileSync(path.join(outputDir, 'sample.txt'), 'private-output');

    const protectedRequests = [
      ['/api/files', 'GET', null],
      ['/api/upload', 'POST', { filename: 'sample.mp3', data: Buffer.from('audio').toString('base64') }],
      ['/api/chat', 'POST', { messages: [{ role: 'user', content: 'hello' }] }],
      ['/api/chat/models', 'GET', null],
      ['/api/tts', 'POST', { text: 'hello' }],
      ['/api/generate/lyrics', 'POST', { prompt: 'hello' }],
      ['/api/generate/music', 'POST', { prompt: 'hello' }],
      ['/api/generate/cover', 'POST', { prompt: 'hello' }],
      ['/api/generate/voice', 'POST', { prompt: 'hello' }],
      ['/api/music/status', 'POST', { taskId: 'missing' }],
      ['/api/image/status', 'POST', { taskId: 'missing' }],
      ['/api/music-cover/status', 'POST', { taskId: 'missing' }],
      ['/output/sample.txt', 'GET', null]
    ];

    for (const [requestPath, method, body] of protectedRequests) {
      await expectAnonymousBlocked(server, requestPath, method, body);
    }

    const authHeaders = await login(server);
    const files = await request(server, '/api/files', 'GET', null, authHeaders);
    assert(files.status !== 401, 'expected authenticated /api/files request to pass auth boundary');

    const lyrics = await request(server, '/api/generate/lyrics', 'POST', {}, authHeaders);
    assert(lyrics.status !== 401, 'expected authenticated generation request to pass auth boundary');
  });

  console.log('API auth boundary tests passed');
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
