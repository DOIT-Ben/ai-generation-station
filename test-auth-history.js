const fs = require('fs');
const path = require('path');
const os = require('os');
const { createServer } = require('./server/index');
const { createConfig } = require('./server/config');
const { dispatchRequest } = require('./test-live-utils');

function request(server, requestPath, method, body, headers = {}) {
  return dispatchRequest(server, requestPath, method, body, { headers });
}

async function withServer(fn) {
  const stateDb = path.join(os.tmpdir(), `aigs-state-${Date.now()}.sqlite`);
  const server = createServer({
    config: createConfig({
      env: {
        ...process.env,
        PORT: '18802',
        APP_STATE_DB: stateDb,
        APP_USERNAME: 'studio',
        APP_PASSWORD: 'AIGS2026!'
      }
    })
  });

  try {
    return await fn(stateDb, server);
  } finally {
    server.appStateStore?.close?.();
    if (fs.existsSync(stateDb)) {
      fs.unlinkSync(stateDb);
    }
    if (fs.existsSync(`${stateDb}-shm`)) fs.unlinkSync(`${stateDb}-shm`);
    if (fs.existsSync(`${stateDb}-wal`)) fs.unlinkSync(`${stateDb}-wal`);
  }
}

async function main() {
  await withServer(async (_stateDb, server) => {
    const anonymous = await request(server, '/api/auth/session', 'GET');
    if (anonymous.status !== 401) throw new Error(`Expected 401 before login, got ${anonymous.status}`);

    const anonymousAdmin = await request(server, '/api/admin/users', 'GET');
    if (anonymousAdmin.status !== 401) throw new Error(`Expected 401 for anonymous admin users, got ${anonymousAdmin.status}`);

    const badLogin = await request(server, '/api/auth/login', 'POST', { username: 'studio', password: 'bad' });
    if (badLogin.status !== 401) throw new Error(`Expected 401 for bad login, got ${badLogin.status}`);

    const login = await request(server, '/api/auth/login', 'POST', { username: 'studio', password: 'AIGS2026!' });
    if (login.status !== 200) throw new Error(`Expected 200 for login, got ${login.status}`);

    const rawCookieHeader = login.headers['set-cookie'];
    const cookieHeader = Array.isArray(rawCookieHeader) ? rawCookieHeader[0] : rawCookieHeader;
    if (!cookieHeader) throw new Error('Expected session cookie after login');
    const cookie = String(cookieHeader).split(';')[0];

    const session = await request(server, '/api/auth/session', 'GET', null, { Cookie: cookie });
    if (session.status !== 200 || session.data.user?.username !== 'studio' || !session.data.user?.id) {
      throw new Error('Expected authenticated session after login');
    }
    const userId = session.data.user.id;

    const reviewer = server.appStateStore.createUser({
      username: 'reviewer',
      password: 'Review2026!',
      displayName: 'Reviewer',
      role: 'user',
      planCode: 'free'
    });

    const preferences = await request(server, '/api/preferences', 'GET', null, { Cookie: cookie });
    if (preferences.status !== 200 || preferences.data.preferences?.theme !== 'dark') {
      throw new Error('Expected default preferences to be returned');
    }

    const updatedPreferences = await request(server, '/api/preferences', 'POST', {
      theme: 'light',
      defaultModelChat: 'MiniMax-M2.7-highspeed',
      defaultVoice: 'female-tianmei',
      defaultMusicStyle: 'rock',
      defaultCoverRatio: '16:9'
    }, { Cookie: cookie });
    if (updatedPreferences.status !== 200 || updatedPreferences.data.preferences?.theme !== 'light') {
      throw new Error('Expected preferences update to persist');
    }

    const usageBefore = await request(server, '/api/usage/today', 'GET', null, { Cookie: cookie });
    if (usageBefore.status !== 200 || usageBefore.data.usage?.chatCount !== 0) {
      throw new Error('Expected zero usage before increment');
    }

    const save = await request(server, '/api/history/chat', 'POST', {
      entry: {
        title: 'Test Title',
        summary: 'Test Summary',
        timestamp: Date.now(),
        state: { messages: [{ role: 'user', content: 'hello' }] }
      }
    }, { Cookie: cookie });
    if (save.status !== 200 || !Array.isArray(save.data.items) || save.data.items.length !== 1) {
      throw new Error('Expected history append to succeed');
    }

    const history = await request(server, '/api/history/chat', 'GET', null, { Cookie: cookie });
    if (history.status !== 200 || history.data.items?.[0]?.title !== 'Test Title') {
      throw new Error('Expected history retrieval to return saved entry');
    }

    server.appStateStore.incrementUsageDaily(userId, 'chat');
    const usageAfter = await request(server, '/api/usage/today', 'GET', null, { Cookie: cookie });
    if (usageAfter.status !== 200 || usageAfter.data.usage?.chatCount !== 1) {
      throw new Error('Expected usage increment to be visible');
    }

    const templates = await request(server, '/api/templates/chat', 'GET', null, { Cookie: cookie });
    if (templates.status !== 200 || !Array.isArray(templates.data.groups) || templates.data.groups.length < 1) {
      throw new Error('Expected chat templates to be returned');
    }

    const createdTemplate = await request(server, '/api/templates/chat', 'POST', {
      category: 'My Templates',
      label: 'Regression Template',
      description: 'Template created by regression test',
      message: 'Write a short regression test sample'
    }, { Cookie: cookie });
    if (createdTemplate.status !== 200 || createdTemplate.data.template?.label !== 'Regression Template') {
      throw new Error('Expected user template creation to persist');
    }

    const favorite = await request(
      server,
      `/api/templates/chat/${createdTemplate.data.template.id}/favorite`,
      'POST',
      {},
      { Cookie: cookie }
    );
    if (favorite.status !== 200 || favorite.data.favorite !== true) {
      throw new Error('Expected template favorite toggle to succeed');
    }

    const templatesAfter = await request(server, '/api/templates/chat', 'GET', null, { Cookie: cookie });
    const flattenedTemplates = (templatesAfter.data.groups || []).flatMap(group => group.items || []);
    const savedTemplate = flattenedTemplates.find(item => item.id === createdTemplate.data.template.id);
    if (!savedTemplate || savedTemplate.favorite !== true) {
      throw new Error('Expected favorited user template to be returned');
    }

    const adminUsers = await request(server, '/api/admin/users', 'GET', null, { Cookie: cookie });
    if (adminUsers.status !== 200 || !Array.isArray(adminUsers.data.users) || adminUsers.data.users.length < 2) {
      throw new Error('Expected admin users list to be returned');
    }

    const updatedAdminUser = await request(server, `/api/admin/users/${reviewer.id}`, 'POST', {
      status: 'disabled',
      role: 'admin',
      planCode: 'pro'
    }, { Cookie: cookie });
    if (
      updatedAdminUser.status !== 200 ||
      updatedAdminUser.data.user?.status !== 'disabled' ||
      updatedAdminUser.data.user?.role !== 'admin' ||
      updatedAdminUser.data.user?.planCode !== 'pro'
    ) {
      throw new Error('Expected admin user update to persist');
    }

    const logout = await request(server, '/api/auth/logout', 'POST', {}, { Cookie: cookie });
    if (logout.status !== 200) throw new Error(`Expected 200 for logout, got ${logout.status}`);

    const afterLogout = await request(server, '/api/auth/session', 'GET', null, { Cookie: cookie });
    if (afterLogout.status !== 401) throw new Error(`Expected 401 after logout, got ${afterLogout.status}`);
  });

  console.log('Auth/history tests passed');
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
