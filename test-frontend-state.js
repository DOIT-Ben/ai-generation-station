const assert = require('assert');
const AppShell = require('./public/js/app-shell.js');
const SiteShell = require('./public/js/site-shell.js');

function createMockResponse(payload, options = {}) {
  const status = Number(options.status || 200);
  return {
    ok: status >= 200 && status < 300,
    status,
    clone() {
      return createMockResponse(payload, options);
    },
    async json() {
      return payload;
    }
  };
}

function createCsrfAwareFetch(calls, handler) {
  return async (url, options = {}) => {
    calls.push({ url, options });
    if (String(url).includes('/api/auth/csrf')) {
      return createMockResponse({
        csrfToken: 'csrf-test-token',
        headerName: 'X-CSRF-Token'
      });
    }
    return handler
      ? handler(url, options)
      : createMockResponse({});
  };
}

function withoutCsrfBootstrapCalls(calls) {
  return calls.filter(call => !String(call.url).includes('/api/auth/csrf'));
}

function testAuth() {
  assert.equal(AppShell.authenticate('studio', 'AIGS2026!'), true, 'fixed credentials should authenticate');
  assert.equal(AppShell.authenticate('studio', 'wrong'), false, 'wrong password should fail');
}

function testTemplates() {
  const library = AppShell.TEMPLATE_LIBRARY;
  const features = ['chat', 'lyrics', 'cover', 'speech', 'music', 'covervoice'];

  for (const feature of features) {
    assert.ok(Array.isArray(library[feature]), `${feature} should have template categories`);
    assert.ok(library[feature].length >= 2, `${feature} should have multiple categories`);
    const totalItems = library[feature].reduce((sum, category) => sum + category.items.length, 0);
    assert.ok(totalItems >= 6, `${feature} should have enough templates`);
  }
}

function testRemotePersistenceShape() {
  const remote = AppShell.createRemotePersistence(async () => ({
    ok: true,
    status: 200,
    async json() {
      return {};
    }
  }));

  ['loadSession', 'login', 'register', 'logout', 'changePassword', 'getInvitationSession', 'activateInvitation', 'requestPasswordReset', 'getPasswordResetSession', 'completePasswordReset', 'getHistory', 'appendHistory', 'getPreferences', 'savePreferences', 'getUsageToday', 'getTemplates', 'createTemplate', 'toggleTemplateFavorite', 'getAdminUsers', 'getAdminAuditLogs', 'issueAdminInvitation', 'resendAdminInvitation', 'revokeAdminInvitation', 'createAdminUser', 'updateAdminUser', 'resetAdminUserPassword', 'getConversations', 'listArchivedConversations', 'createConversation', 'getConversation', 'updateConversation', 'archiveConversation', 'restoreConversation', 'deleteArchivedConversation', 'sendChatMessage']
    .forEach(method => {
      assert.equal(typeof remote[method], 'function', `${method} should exist on remote persistence`);
    });
}

async function testRemotePersistencePublicAuthRoutes() {
  const calls = [];
  const remote = AppShell.createRemotePersistence(createCsrfAwareFetch(calls, async () => createMockResponse({
    success: true,
    user: {
      username: 'invite-user'
    }
  })));

  await remote.getInvitationSession('invite-token');
  await remote.activateInvitation('invite-token', 'Invite2026!');
  await remote.register({
    username: 'invite-user',
    email: 'invite@example.com',
    password: 'Invite2026!'
  });
  await remote.requestPasswordReset('invite-user');
  await remote.getPasswordResetSession('reset-token');
  await remote.completePasswordReset('reset-token', 'Reset2026!');
  await remote.issueAdminInvitation('user-123');
  await remote.resendAdminInvitation('user-123');
  await remote.revokeAdminInvitation('user-123');

  const requestCalls = withoutCsrfBootstrapCalls(calls);
  assert.ok(calls.some(call => String(call.url).includes('/api/auth/csrf')), 'POST auth/admin routes should bootstrap a CSRF token');
  assert.equal(requestCalls[0].url, '/api/auth/invitation?token=invite-token', 'invitation session should request the invite validation route');
  assert.equal(requestCalls[0].options.credentials, 'include', 'invitation session should use credentialed requests');
  assert.equal(requestCalls[1].url, '/api/auth/invitation/activate', 'invitation activation should request the activate route');
  assert.equal(requestCalls[1].options.method, 'POST', 'invitation activation should use POST');
  assert.equal(requestCalls[1].options.headers['X-CSRF-Token'], 'csrf-test-token', 'invitation activation should include the CSRF header');
  assert.equal(JSON.parse(requestCalls[1].options.body).password, 'Invite2026!', 'invitation activation should send the chosen password');
  assert.equal(requestCalls[2].url, '/api/auth/register', 'public register should request the register route');
  assert.equal(requestCalls[2].options.method, 'POST', 'public register should use POST');
  assert.equal(JSON.parse(requestCalls[2].options.body).email, 'invite@example.com', 'public register should send the email payload');
  assert.equal(requestCalls[3].url, '/api/auth/forgot-password', 'forgot-password should request the recovery route');
  assert.equal(requestCalls[3].options.method, 'POST', 'forgot-password should use POST');
  assert.equal(JSON.parse(requestCalls[3].options.body).username, 'invite-user', 'forgot-password should send the username payload');
  assert.equal(requestCalls[4].url, '/api/auth/password-reset?token=reset-token', 'password-reset session should request the reset validation route');
  assert.equal(requestCalls[5].url, '/api/auth/password-reset/complete', 'password-reset completion should request the completion route');
  assert.equal(JSON.parse(requestCalls[5].options.body).token, 'reset-token', 'password-reset completion should send the reset token');
  assert.equal(requestCalls[6].url, '/api/admin/users/user-123/invite', 'admin invitation should hit the admin invite route');
  assert.equal(requestCalls[6].options.method, 'POST', 'admin invitation should use POST');
  assert.equal(requestCalls[7].url, '/api/admin/users/user-123/invite-resend', 'admin invitation resend should hit the resend route');
  assert.equal(requestCalls[7].options.method, 'POST', 'admin invitation resend should use POST');
  assert.equal(requestCalls[8].url, '/api/admin/users/user-123/invite-revoke', 'admin invitation revoke should hit the revoke route');
  assert.equal(requestCalls[8].options.method, 'POST', 'admin invitation revoke should use POST');
}

async function testRemotePersistenceLoadSessionNoStore() {
  const calls = [];
  const remote = AppShell.createRemotePersistence(createCsrfAwareFetch(calls, async () => createMockResponse({
    authenticated: true,
    user: {
      username: 'studio'
    }
  })));

  const session = await remote.loadSession();
  assert.equal(session?.username, 'studio', 'loadSession should return the authenticated user');
  assert.equal(calls.length, 1, 'loadSession should issue exactly one request');
  assert.equal(calls[0].url, '/api/auth/session', 'loadSession should hit the auth session endpoint');
  assert.equal(calls[0].options.cache, 'no-store', 'loadSession should bypass browser caches');
  assert.equal(calls[0].options.headers['Cache-Control'], 'no-store', 'loadSession should send a no-store cache hint');
  assert.equal(calls[0].options.headers.Pragma, 'no-cache', 'loadSession should send a legacy no-cache hint');
}

async function testRemotePersistenceAdminUserPayloads() {
  const calls = [];
  const remote = AppShell.createRemotePersistence(createCsrfAwareFetch(calls, async () => createMockResponse({
    users: [],
    user: {
      id: 'user-123',
      username: 'member-user',
      email: 'member@example.com'
    }
  })));

  await remote.getAdminUsers();
  await remote.createAdminUser({
    username: 'member-user',
    email: 'member@example.com',
    password: 'Member2026!'
  });
  await remote.updateAdminUser('user-123', {
    email: 'member-updated@example.com'
  });

  const requestCalls = withoutCsrfBootstrapCalls(calls);
  assert.equal(requestCalls[0].url, '/api/admin/users', 'admin user list should hit the admin users endpoint');
  assert.equal(requestCalls[0].options.credentials, 'include', 'admin user list should use credentialed requests');
  assert.equal(requestCalls[1].url, '/api/admin/users', 'admin create-user should hit the admin users endpoint');
  assert.equal(requestCalls[1].options.method, 'POST', 'admin create-user should use POST');
  assert.equal(requestCalls[1].options.headers['X-CSRF-Token'], 'csrf-test-token', 'admin create-user should include the CSRF header');
  assert.equal(JSON.parse(requestCalls[1].options.body).email, 'member@example.com', 'admin create-user should send the email payload');
  assert.equal(requestCalls[2].url, '/api/admin/users/user-123', 'admin update-user should hit the user patch route');
  assert.equal(requestCalls[2].options.method, 'POST', 'admin update-user should use POST');
  assert.equal(JSON.parse(requestCalls[2].options.body).email, 'member-updated@example.com', 'admin update-user should send the updated email payload');
}

async function testRemotePersistenceAdminAuditQuery() {
  const calls = [];
  const remote = AppShell.createRemotePersistence(createCsrfAwareFetch(calls, async () => createMockResponse({
    items: [],
    page: 2,
    pageSize: 25,
    total: 0,
    totalPages: 1,
    hasMore: false
  })));

  await remote.getAdminAuditLogs({
    page: 2,
    pageSize: 25,
    action: 'user_create',
    actorUsername: 'studio',
    targetUsername: 'member-user',
    from: '2026-04-19',
    to: '2026-04-20'
  });

  assert.equal(calls.length, 1, 'admin audit query should issue one request');
  const requestUrl = new URL(calls[0].url, 'http://localhost');
  assert.equal(requestUrl.pathname, '/api/admin/audit-logs', 'admin audit query should hit the audit endpoint');
  assert.equal(requestUrl.searchParams.get('page'), '2', 'admin audit query should include page');
  assert.equal(requestUrl.searchParams.get('pageSize'), '25', 'admin audit query should include page size');
  assert.equal(requestUrl.searchParams.get('action'), 'user_create', 'admin audit query should include action filter');
  assert.equal(requestUrl.searchParams.get('actorUsername'), 'studio', 'admin audit query should include actor filter');
  assert.equal(requestUrl.searchParams.get('targetUsername'), 'member-user', 'admin audit query should include target filter');
  assert.equal(requestUrl.searchParams.get('from'), '2026-04-19', 'admin audit query should include from date');
  assert.equal(requestUrl.searchParams.get('to'), '2026-04-20', 'admin audit query should include to date');
  assert.equal(calls[0].options.credentials, 'include', 'admin audit query should use credentialed requests');
}

async function testApiClientConfiguredBaseUrlAndAssetResolution() {
  const calls = [];
  const previousApiBaseUrl = global.AIGS_API_BASE_URL;

  global.AIGS_API_BASE_URL = 'https://api.example.com';

  try {
    const client = AppShell.createApiClient(createCsrfAwareFetch(calls, async () => createMockResponse({ ok: true })));
    await client.fetch('/api/preferences');

    assert.equal(calls[0].url, 'https://api.example.com/api/preferences', 'configured API base URL should prefix browser API requests');
    assert.equal(calls[0].options.credentials, 'include', 'configured API base requests should keep credentials included');
    assert.equal(
      AppShell.resolveApiAssetUrl('/output/demo.mp3'),
      'https://api.example.com/output/demo.mp3',
      'relative output URLs should resolve against the configured API base URL'
    );
  } finally {
    if (previousApiBaseUrl === undefined) {
      delete global.AIGS_API_BASE_URL;
    } else {
      global.AIGS_API_BASE_URL = previousApiBaseUrl;
    }
  }
}

async function testApiClientRetriesCsrfOnce() {
  const calls = [];
  let csrfTokenCount = 0;
  let protectedPostCount = 0;

  const client = AppShell.createApiClient(async (url, options = {}) => {
    calls.push({ url, options });
    if (String(url).includes('/api/auth/csrf')) {
      csrfTokenCount += 1;
      return createMockResponse({
        csrfToken: `csrf-token-${csrfTokenCount}`,
        headerName: 'X-CSRF-Token'
      });
    }

    protectedPostCount += 1;
    if (protectedPostCount === 1) {
      return createMockResponse({
        error: '安全校验失败，请刷新页面后重试',
        reason: 'csrf_invalid'
      }, { status: 403 });
    }

    return createMockResponse({ success: true });
  });

  const response = await client.fetch('/api/preferences', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ theme: 'dark' })
  });

  const data = await response.json();
  assert.equal(data.success, true, 'csrf retry path should eventually return the successful response');
  assert.equal(csrfTokenCount, 2, 'csrf retry path should refresh the token once after a csrf failure');
  assert.equal(protectedPostCount, 2, 'csrf retry path should replay the protected request once');
  assert.equal(calls[1].options.headers['X-CSRF-Token'], 'csrf-token-1', 'first protected request should use the first csrf token');
  assert.equal(calls[calls.length - 1].options.headers['X-CSRF-Token'], 'csrf-token-2', 'retried protected request should use the refreshed csrf token');
}

async function testRemotePersistenceAuthExpiryEvent() {
  const events = [];
  const previousWindow = global.window;
  const previousCustomEvent = global.CustomEvent;

  class TestCustomEvent {
    constructor(type, init = {}) {
      this.type = type;
      this.detail = init.detail;
    }
  }

  global.window = {
    dispatchEvent(event) {
      events.push(event);
    },
    CustomEvent: TestCustomEvent
  };
  global.CustomEvent = TestCustomEvent;

  try {
    const remote = AppShell.createRemotePersistence(async () => ({
      ok: false,
      status: 401,
      async json() {
        return {
          error: '登录状态已失效，请重新登录',
          reason: 'session_expired'
        };
      }
    }));

    await assert.rejects(() => remote.getPreferences(), error => {
      assert.equal(error.status, 401, '401 responses should reject with the HTTP status');
      assert.equal(error.reason, 'session_expired', '401 responses should preserve the backend reason');
      return true;
    });

    assert.equal(events.length, 1, '401 responses should dispatch one auth-expired event');
    assert.equal(events[0].type, 'app-auth-expired', 'auth-expired event name should stay stable');
    assert.equal(events[0].detail.reason, 'session_expired', 'auth-expired event should include the backend reason');
  } finally {
    global.window = previousWindow;
    global.CustomEvent = previousCustomEvent;
  }
}

async function testRemotePersistencePasswordResetEvent() {
  const events = [];
  const previousWindow = global.window;
  const previousCustomEvent = global.CustomEvent;

  class TestCustomEvent {
    constructor(type, init = {}) {
      this.type = type;
      this.detail = init.detail;
    }
  }

  global.window = {
    dispatchEvent(event) {
      events.push(event);
    },
    CustomEvent: TestCustomEvent
  };
  global.CustomEvent = TestCustomEvent;

  try {
    const remote = AppShell.createRemotePersistence(async () => ({
      ok: false,
      status: 403,
      async json() {
        return {
          error: '请先修改临时密码后再继续使用',
          reason: 'password_reset_required',
          user: {
            username: 'member-user',
            mustResetPassword: true
          }
        };
      }
    }));

    await assert.rejects(() => remote.getPreferences(), error => {
      assert.equal(error.status, 403, '403 password-reset-required responses should reject with the HTTP status');
      assert.equal(error.reason, 'password_reset_required', '403 password-reset-required responses should preserve the backend reason');
      assert.equal(error.user?.username, 'member-user', '403 password-reset-required responses should preserve the user payload');
      return true;
    });

    assert.equal(events.length, 1, 'password-reset-required responses should dispatch one event');
    assert.equal(events[0].type, 'app-password-reset-required', 'password-reset-required event name should stay stable');
    assert.equal(events[0].detail.reason, 'password_reset_required', 'password-reset-required event should include the backend reason');
  } finally {
    global.window = previousWindow;
    global.CustomEvent = previousCustomEvent;
  }
}

async function testPortalLogoutRedirectsAfterSessionClears() {
  const previousWindow = global.window;
  const previousDocument = global.document;
  let redirectedTo = null;

  global.window = {
    location: {
      origin: 'http://localhost',
      replace(url) {
        redirectedTo = url;
      }
    },
    setTimeout,
    clearTimeout
  };
  global.document = {
    getElementById() {
      return null;
    },
    createElement() {
      return {
        textContent: '',
        innerHTML: ''
      };
    }
  };

  try {
    const result = await SiteShell.logoutAndRedirect({
      async logout() {},
      async loadSession() {
        return null;
      }
    }, '/auth/');

    assert.equal(result, true, 'portal logout should resolve true after the session clears');
    assert.equal(redirectedTo, '/auth/', 'portal logout should replace the page with the auth URL');
  } finally {
    global.window = previousWindow;
    global.document = previousDocument;
  }
}

async function testPortalLogoutDoesNotRedirectWhenSessionRemainsActive() {
  const previousWindow = global.window;
  const previousDocument = global.document;
  let redirectedTo = null;

  global.window = {
    location: {
      origin: 'http://localhost',
      replace(url) {
        redirectedTo = url;
      }
    },
    setTimeout,
    clearTimeout
  };
  global.document = {
    getElementById() {
      return null;
    },
    createElement() {
      return {
        textContent: '',
        innerHTML: ''
      };
    }
  };

  try {
    const result = await SiteShell.logoutAndRedirect({
      async logout() {},
      async loadSession() {
        return { username: 'studio' };
      }
    }, '/auth/');

    assert.equal(result, false, 'portal logout should resolve false when the session remains active');
    assert.equal(redirectedTo, null, 'portal logout should not redirect if the session still exists');
  } finally {
    global.window = previousWindow;
    global.document = previousDocument;
  }
}

function testConversationFilter() {
  const items = [
    { title: 'Roadmap Review', model: 'MiniMax-M2.7' },
    { title: 'Archived Design Notes', model: 'MiniMax-M2.7-highspeed' }
  ];

  assert.equal(AppShell.filterConversationSummaries(items, '').length, 2, 'blank search should return all items');
  assert.equal(AppShell.filterConversationSummaries(items, 'roadmap').length, 1, 'search should match title case-insensitively');
  assert.equal(AppShell.filterConversationSummaries(items, 'highspeed').length, 1, 'search should match model');
  assert.equal(AppShell.filterConversationSummaries(items, 'design notes').length, 1, 'search should support multiple terms');
  assert.equal(AppShell.filterConversationSummaries(items, 'missing').length, 0, 'search should drop non-matching items');
}

function testPersistence() {
  const storage = AppShell.createMemoryStorage();
  const persistence = AppShell.createPersistence(storage);

  persistence.saveSession({ username: 'studio' });
  assert.deepEqual(persistence.loadSession(), { username: 'studio' }, 'session should round-trip');

  for (let i = 0; i < AppShell.MAX_HISTORY_ITEMS + 3; i++) {
    persistence.appendHistory('studio', 'chat', { id: i, title: `entry-${i}` });
  }

  const history = persistence.getHistory('studio', 'chat');
  assert.equal(history.length, AppShell.MAX_HISTORY_ITEMS, 'history should be trimmed to max size');
  assert.equal(history[0].id, AppShell.MAX_HISTORY_ITEMS + 2, 'newest history item should be first');

  const untitledConversation = persistence.createConversation('studio', { model: 'MiniMax-M2.7' });
  assert.equal(untitledConversation.title, '新对话', 'untitled conversations should default to localized Chinese copy');

  const conversation = persistence.createConversation('studio', { title: 'Test Chat', model: 'MiniMax-M2.7-highspeed' });
  assert.ok(conversation.id, 'conversation should get an id');
  assert.equal(conversation.title, 'Test Chat', 'conversation should store title');
  assert.equal(conversation.model, 'MiniMax-M2.7-highspeed', 'conversation should store model');

  persistence.saveConversationMessages('studio', conversation.id, [
    { role: 'user', content: 'hello' },
    { role: 'assistant', content: 'hi' }
  ]);
  const messages = persistence.getConversationMessages('studio', conversation.id);
  assert.equal(messages.length, 2, 'conversation messages should round-trip');
  assert.equal(persistence.getConversation('studio', conversation.id)?.id, conversation.id, 'conversation lookup should work');

  const updatedConversation = persistence.updateConversation('studio', conversation.id, { title: 'Renamed Chat' });
  assert.equal(updatedConversation.conversation?.title, 'Renamed Chat', 'conversation rename should persist');

  const archivedConversation = persistence.archiveConversation('studio', conversation.id);
  assert.equal(archivedConversation.archivedConversationId, conversation.id, 'archive should return the archived conversation id');
  assert.equal(persistence.getConversation('studio', conversation.id), null, 'archived conversation should leave the active list');
  assert.equal((archivedConversation.archivedConversations || []).length, 1, 'archive should move the conversation into the archived list');

  const restoredConversation = persistence.restoreConversation('studio', conversation.id);
  assert.equal(restoredConversation.conversation?.id, conversation.id, 'restore should return the restored conversation');
  assert.equal((restoredConversation.archivedConversations || []).length, 0, 'restored conversation should leave the archived list');
  assert.equal(persistence.getConversation('studio', conversation.id)?.id, conversation.id, 'restored conversation should return to the active list');

  const reArchivedConversation = persistence.archiveConversation('studio', conversation.id);
  assert.equal((reArchivedConversation.archivedConversations || []).length, 1, 're-archive should return the conversation to the archived list');

  const deletedConversation = persistence.deleteArchivedConversation('studio', conversation.id);
  assert.equal(deletedConversation.deletedConversationId, conversation.id, 'delete should report the deleted conversation id');
  assert.equal((deletedConversation.archivedConversations || []).length, 0, 'delete should remove the conversation from the archived list');
}

async function main() {
  testAuth();
  testTemplates();
  testRemotePersistenceShape();
  await testApiClientConfiguredBaseUrlAndAssetResolution();
  await testApiClientRetriesCsrfOnce();
  await testRemotePersistenceLoadSessionNoStore();
  await testRemotePersistenceAdminAuditQuery();
  await testRemotePersistencePublicAuthRoutes();
  await testRemotePersistenceAdminUserPayloads();
  await testRemotePersistenceAuthExpiryEvent();
  await testRemotePersistencePasswordResetEvent();
  await testPortalLogoutRedirectsAfterSessionClears();
  await testPortalLogoutDoesNotRedirectWhenSessionRemainsActive();
  testConversationFilter();
  testPersistence();
  console.log('✅ Frontend state tests passed');
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
