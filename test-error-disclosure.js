const fs = require('fs');
const os = require('os');
const path = require('path');
const { createServer } = require('./server/index');
const { createConfig } = require('./server/config');
const { createSystemRoutes } = require('./server/routes/system');
const { dispatchRequest } = require('./test-live-utils');

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

function cookiePair(cookieLine) {
  return String(cookieLine || '').split(';')[0];
}

function mergeCookies(...cookieLines) {
  return cookieLines
    .map(cookiePair)
    .filter(Boolean)
    .join('; ');
}

async function withServer(fn, options = {}) {
  const stateDb = path.join(os.tmpdir(), `aigs-error-disclosure-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`);
  const server = createServer({
    chatFetch: options.chatFetch,
    config: createConfig({
      env: {
        ...process.env,
        PORT: '18808',
        APP_STATE_DB: stateDb,
        APP_USERNAME: 'studio',
        APP_PASSWORD: 'AIGS2026!',
        CHAT_API_KEY: 'test-chat-key',
        ...(options.env || {})
      }
    })
  });

  try {
    return await fn(server);
  } finally {
    server.appStateStore?.close?.();
    [stateDb, `${stateDb}-shm`, `${stateDb}-wal`].forEach(filePath => {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    });
  }
}

async function login(server) {
  const csrf = await dispatchRequest(server, '/api/auth/csrf', 'GET');
  assert(csrf.status === 200, `Expected CSRF bootstrap to return 200, got ${csrf.status}`);
  const csrfCookie = getSetCookies(csrf)[0];
  assert(Boolean(csrfCookie), 'Expected CSRF bootstrap to set a cookie');
  assert(Boolean(csrf.data.csrfToken), 'Expected CSRF bootstrap to return a token');

  const loginResponse = await dispatchRequest(server, '/api/auth/login', 'POST', {
    username: 'studio',
    password: 'AIGS2026!'
  }, {
    headers: {
      Cookie: cookiePair(csrfCookie),
      'X-CSRF-Token': csrf.data.csrfToken
    }
  });

  assert(loginResponse.status === 200, `Expected login to return 200, got ${loginResponse.status}`);
  const sessionCookie = getSetCookies(loginResponse)[0];
  assert(Boolean(sessionCookie), 'Expected login to set a session cookie');
  return mergeCookies(csrfCookie, sessionCookie);
}

async function testGenericHandlerErrorIsSanitized() {
  const secretMessage = 'INTERNAL_CHAT_MODEL_SECRET_42';
  await withServer(async server => {
    const cookie = await login(server);
    const response = await dispatchRequest(server, '/api/chat/models', 'GET', null, {
      headers: {
        Cookie: cookie
      }
    });

    assert(response.status === 500, `Expected chat models failure to return 500, got ${response.status}`);
    assert(!response.rawBody.includes(secretMessage), 'Expected generic 500 response to hide the internal exception message');
    assert(response.data.reason === 'internal_error', 'Expected generic 500 response to expose a stable reason code');
  }, {
    chatFetch: async () => {
      throw new Error(secretMessage);
    }
  });
}

function createMockResponse() {
  return {
    statusCode: 200,
    headers: {},
    rawBody: '',
    writeHead(statusCode, headers = {}) {
      this.statusCode = statusCode;
      this.headers = { ...this.headers, ...headers };
    },
    end(chunk = '') {
      this.rawBody = String(chunk || '');
      try {
        this.data = JSON.parse(this.rawBody);
      } catch {
        this.data = this.rawBody;
      }
    }
  };
}

async function testHealthSuccessDoesNotExposeAdminCount() {
  const route = createSystemRoutes({
    stateStore: {
      countActiveAdmins() {
        return 7;
      }
    },
    startedAt: Date.now()
  })['/api/health'];

  const payload = await route({}, createMockResponse());
  assert(payload.status === 'ok', 'Expected health success payload to report ok');
  assert(payload.database === 'ready', 'Expected health success payload to report database readiness');
  assert(!Object.prototype.hasOwnProperty.call(payload, 'activeAdminCount'), 'Expected health success payload to hide activeAdminCount');
}

async function testHealthFailureIsSanitized() {
  const secretMessage = 'SQLITE_INTERNAL_PATH_SECRET_42';
  const route = createSystemRoutes({
    stateStore: {
      countActiveAdmins() {
        throw new Error(secretMessage);
      }
    },
    startedAt: Date.now()
  })['/api/health'];

  const response = createMockResponse();
  const result = await route({}, response);
  assert(result === null, 'Expected health failure handler to end the response');
  assert(response.statusCode === 503, `Expected health failure to return 503, got ${response.statusCode}`);
  assert(!response.rawBody.includes(secretMessage), 'Expected health failure response to hide the internal exception message');
  assert(response.data.reason === 'health_check_failed', 'Expected health failure response to expose a stable reason code');
}

async function main() {
  await testGenericHandlerErrorIsSanitized();
  await testHealthSuccessDoesNotExposeAdminCount();
  await testHealthFailureIsSanitized();
  console.log('Error disclosure tests passed');
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
