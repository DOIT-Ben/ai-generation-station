const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const { createServer } = require('./server/index');
const { createConfig } = require('./server/config');

function request(port, requestPath, method, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : '';
    const req = http.request({
      hostname: 'localhost',
      port,
      path: requestPath,
      method,
      headers: {
        ...(payload ? {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        } : {}),
        ...headers
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let parsed = data;
        try {
          parsed = JSON.parse(data);
        } catch {}
        resolve({
          status: res.statusCode,
          data: parsed,
          headers: res.headers
        });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function withServer(fn) {
  const port = 18802;
  const stateDb = path.join(os.tmpdir(), `aigs-state-${Date.now()}.sqlite`);
  const server = createServer({
    config: createConfig({
      env: {
        ...process.env,
        PORT: String(port),
        APP_STATE_DB: stateDb,
        APP_USERNAME: 'studio',
        APP_PASSWORD: 'AIGS2026!'
      }
    })
  });

  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, resolve);
    });
    return await fn(port, stateDb, server);
  } finally {
    await new Promise(resolve => server.close(resolve));
    server.appStateStore?.close?.();
    if (fs.existsSync(stateDb)) {
      fs.unlinkSync(stateDb);
    }
    if (fs.existsSync(`${stateDb}-shm`)) fs.unlinkSync(`${stateDb}-shm`);
    if (fs.existsSync(`${stateDb}-wal`)) fs.unlinkSync(`${stateDb}-wal`);
  }
}

async function main() {
  await withServer(async (port, stateDb, server) => {
    const anonymous = await request(port, '/api/auth/session', 'GET');
    if (anonymous.status !== 401) throw new Error(`Expected 401 before login, got ${anonymous.status}`);

    const badLogin = await request(port, '/api/auth/login', 'POST', { username: 'studio', password: 'bad' });
    if (badLogin.status !== 401) throw new Error(`Expected 401 for bad login, got ${badLogin.status}`);

    const login = await request(port, '/api/auth/login', 'POST', { username: 'studio', password: 'AIGS2026!' });
    if (login.status !== 200) throw new Error(`Expected 200 for login, got ${login.status}`);

    const cookieHeader = login.headers['set-cookie']?.[0] || login.headers['set-cookie'];
    if (!cookieHeader) throw new Error('Expected session cookie after login');
    const cookie = String(cookieHeader).split(';')[0];

    const session = await request(port, '/api/auth/session', 'GET', null, { Cookie: cookie });
    if (session.status !== 200 || session.data.user?.username !== 'studio' || !session.data.user?.id) {
      throw new Error('Expected authenticated session after login');
    }
    const userId = session.data.user.id;

    const preferences = await request(port, '/api/preferences', 'GET', null, { Cookie: cookie });
    if (preferences.status !== 200 || preferences.data.preferences?.theme !== 'dark') {
      throw new Error('Expected default preferences to be returned');
    }

    const updatedPreferences = await request(port, '/api/preferences', 'POST', {
      theme: 'light',
      defaultModelChat: 'MiniMax-M2.7-highspeed',
      defaultVoice: 'female-tianmei',
      defaultMusicStyle: 'rock',
      defaultCoverRatio: '16:9'
    }, { Cookie: cookie });
    if (updatedPreferences.status !== 200 || updatedPreferences.data.preferences?.theme !== 'light') {
      throw new Error('Expected preferences update to persist');
    }

    const usageBefore = await request(port, '/api/usage/today', 'GET', null, { Cookie: cookie });
    if (usageBefore.status !== 200 || usageBefore.data.usage?.chatCount !== 0) {
      throw new Error('Expected zero usage before increment');
    }

    const save = await request(port, '/api/history/chat', 'POST', {
      entry: {
        title: '测试标题',
        summary: '测试摘要',
        timestamp: Date.now(),
        state: { messages: [{ role: 'user', content: 'hello' }] }
      }
    }, { Cookie: cookie });
    if (save.status !== 200 || !Array.isArray(save.data.items) || save.data.items.length !== 1) {
      throw new Error('Expected history append to succeed');
    }

    const history = await request(port, '/api/history/chat', 'GET', null, { Cookie: cookie });
    if (history.status !== 200 || history.data.items?.[0]?.title !== '测试标题') {
      throw new Error('Expected history retrieval to return saved entry');
    }

    server.appStateStore.incrementUsageDaily(userId, 'chat');
    const usageAfter = await request(port, '/api/usage/today', 'GET', null, { Cookie: cookie });
    if (usageAfter.status !== 200 || usageAfter.data.usage?.chatCount !== 1) {
      throw new Error('Expected usage increment to be visible');
    }

    const logout = await request(port, '/api/auth/logout', 'POST', {}, { Cookie: cookie });
    if (logout.status !== 200) throw new Error(`Expected 200 for logout, got ${logout.status}`);

    const afterLogout = await request(port, '/api/auth/session', 'GET', null, { Cookie: cookie });
    if (afterLogout.status !== 401) throw new Error(`Expected 401 after logout, got ${afterLogout.status}`);
  });

  console.log('✅ Auth/history tests passed');
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
