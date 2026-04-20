const fs = require('fs');
const path = require('path');
const os = require('os');
const { EventEmitter } = require('events');
const { createServer } = require('./server/index');
const { createConfig } = require('./server/config');
const { dispatchRequest } = require('./test-live-utils');

function isUnsafeMethod(method) {
  return !['GET', 'HEAD', 'OPTIONS'].includes(String(method || 'GET').toUpperCase());
}

function extractCookieHeader(rawSetCookieHeader) {
  if (!rawSetCookieHeader) return '';
  const items = Array.isArray(rawSetCookieHeader) ? rawSetCookieHeader : [rawSetCookieHeader];
  return items
    .map(item => String(item || '').split(';')[0].trim())
    .filter(Boolean)
    .join('; ');
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

async function request(server, requestPath, method, body, headers = {}) {
  if (!isUnsafeMethod(method)) {
    return dispatchRequest(server, requestPath, method, body, { headers });
  }

  const csrfBootstrap = await dispatchRequest(server, '/api/auth/csrf', 'GET', null, { headers });
  const csrfToken = csrfBootstrap.data?.csrfToken;
  const csrfCookieHeader = extractCookieHeader(csrfBootstrap.headers?.['set-cookie']);
  const mergedHeaders = {
    ...headers
  };
  const mergedCookie = mergeCookieHeaders(headers.Cookie || headers.cookie, csrfCookieHeader);
  if (mergedCookie) {
    mergedHeaders.Cookie = mergedCookie;
  }
  if (csrfToken) {
    mergedHeaders['X-CSRF-Token'] = csrfToken;
  }

  return dispatchRequest(server, requestPath, method, body, { headers: mergedHeaders });
}

function createHttpsStub(responses = []) {
  const calls = [];
  let responseIndex = 0;

  return {
    calls,
    request(_options, callback) {
      const req = new EventEmitter();
      let body = '';

      req.write = chunk => {
        body += Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
      };
      req.end = () => {
        let parsedBody = null;
        try {
          parsedBody = body ? JSON.parse(body) : null;
        } catch {
          parsedBody = body;
        }
        calls.push(parsedBody);

        const res = new EventEmitter();
        callback(res);
        process.nextTick(() => {
          const payload = responses[responseIndex] || responses[responses.length - 1] || {};
          responseIndex += 1;
          res.emit('data', JSON.stringify(payload));
          res.emit('end');
        });
      };
      req.on = req.addListener.bind(req);
      return req;
    }
  };
}

async function withServer(fn, options = {}) {
  const stateDb = path.join(os.tmpdir(), `aigs-state-${Date.now()}.sqlite`);
  const httpsStub = createHttpsStub(options.httpsResponses || [
    {
      content: [{ type: 'text', text: 'First reply from stub' }],
      usage: { input_tokens: 11, output_tokens: 7 }
    },
    {
      content: [{ type: 'text', text: 'Second reply from stub' }],
      usage: { input_tokens: 17, output_tokens: 9 }
    }
  ]);
  const server = createServer({
    https: httpsStub,
    notificationService: options.notificationService,
    notificationFetch: options.notificationFetch,
    config: createConfig({
      env: {
        ...process.env,
        PORT: '18802',
        APP_STATE_DB: stateDb,
        APP_USERNAME: 'studio',
        APP_PASSWORD: 'AIGS2026!',
        ...(options.env || {})
      }
    })
  });

  try {
    return await fn(stateDb, server, httpsStub);
  } finally {
    server.appStateStore?.close?.();
    if (fs.existsSync(stateDb)) {
      fs.unlinkSync(stateDb);
    }
    if (fs.existsSync(`${stateDb}-shm`)) fs.unlinkSync(`${stateDb}-shm`);
    if (fs.existsSync(`${stateDb}-wal`)) fs.unlinkSync(`${stateDb}-wal`);
  }
}

function createTestServer(options = {}) {
  const httpsStub = createHttpsStub(options.httpsResponses || [
    {
      content: [{ type: 'text', text: 'First reply from stub' }],
      usage: { input_tokens: 11, output_tokens: 7 }
    },
    {
      content: [{ type: 'text', text: 'Second reply from stub' }],
      usage: { input_tokens: 17, output_tokens: 9 }
    }
  ]);

  const server = createServer({
    https: httpsStub,
    notificationService: options.notificationService,
    notificationFetch: options.notificationFetch,
    config: createConfig({
      env: {
        ...process.env,
        PORT: '18802',
        APP_USERNAME: 'studio',
        APP_PASSWORD: 'AIGS2026!',
        ...(options.env || {})
      }
    })
  });

  return { server, httpsStub };
}

function createNotificationFetchStub(responses = []) {
  const calls = [];
  let responseIndex = 0;

  return {
    calls,
    async fetch(url, options = {}) {
      const payload = options.body ? JSON.parse(options.body) : null;
      calls.push({
        url,
        options,
        payload
      });
      const current = responses[responseIndex] || responses[responses.length - 1] || { ok: true, status: 200, body: { id: 'email_default' } };
      responseIndex += 1;
      return {
        ok: current.ok !== false,
        status: Number(current.status || 200),
        async json() {
          return current.body || {};
        }
      };
    }
  };
}

function extractPublicTokenFromEmail(message, param) {
  const candidates = [message?.html, message?.text].filter(Boolean);
  for (const candidate of candidates) {
    const match = String(candidate).match(new RegExp(`[?&]${param}=([^"'<\\s&]+)`));
    if (match?.[1]) {
      return decodeURIComponent(match[1]);
    }
  }
  return null;
}

async function main() {
  await withServer(async (_stateDb, server, httpsStub) => {
    const anonymous = await request(server, '/api/auth/session', 'GET');
    if (anonymous.status !== 401) throw new Error(`Expected 401 before login, got ${anonymous.status}`);

    const anonymousAdmin = await request(server, '/api/admin/users', 'GET');
    if (anonymousAdmin.status !== 401) throw new Error(`Expected 401 for anonymous admin users, got ${anonymousAdmin.status}`);

    const anonymousAuditLogs = await request(server, '/api/admin/audit-logs', 'GET');
    if (anonymousAuditLogs.status !== 401) throw new Error(`Expected 401 for anonymous audit logs, got ${anonymousAuditLogs.status}`);

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
    const disabledUser = server.appStateStore.createUser({
      username: 'disabled-user',
      password: 'Disabled2026!',
      displayName: 'Disabled User',
      role: 'user',
      planCode: 'free'
    });
    server.appStateStore.updateUser(disabledUser.id, { status: 'disabled' });

    const disabledLogin = await request(server, '/api/auth/login', 'POST', {
      username: 'disabled-user',
      password: 'Disabled2026!'
    });
    if (
      disabledLogin.status !== 403 ||
      disabledLogin.data.reason !== 'user_disabled' ||
      disabledLogin.data.error !== '账号已被禁用，请联系管理员'
    ) {
      throw new Error('Expected disabled user login to return an explicit disabled-account response');
    }

    const lockedUser = server.appStateStore.createUser({
      username: 'locked-user',
      password: 'Lock2026!',
      displayName: 'Locked User',
      role: 'user',
      planCode: 'free'
    });

    for (let attempt = 1; attempt <= 4; attempt += 1) {
      const badAttempt = await request(server, '/api/auth/login', 'POST', {
        username: 'locked-user',
        password: 'wrong-pass'
      });
      if (badAttempt.status !== 401) {
        throw new Error('Expected early failed logins to remain generic 401 responses');
      }
    }

    const lockingAttempt = await request(server, '/api/auth/login', 'POST', {
      username: 'locked-user',
      password: 'wrong-pass'
    });
    if (
      lockingAttempt.status !== 423 ||
      lockingAttempt.data.reason !== 'login_locked' ||
      lockingAttempt.data.error !== '账号已被临时锁定，请 15 分钟后重试'
    ) {
      throw new Error('Expected fifth failed login to lock the account with an explicit message');
    }

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

    const emptyConversations = await request(server, '/api/conversations', 'GET', null, { Cookie: cookie });
    if (emptyConversations.status !== 200 || !Array.isArray(emptyConversations.data.conversations) || emptyConversations.data.conversations.length !== 0) {
      throw new Error('Expected empty conversation list before creation');
    }

    const conversationA = await request(server, '/api/conversations', 'POST', {
      title: 'Conversation A',
      model: 'MiniMax-M2.7'
    }, { Cookie: cookie });
    if (conversationA.status !== 200 || !conversationA.data.conversation?.id) {
      throw new Error('Expected conversation creation to succeed');
    }

    await new Promise(resolve => setTimeout(resolve, 5));
    const conversationB = await request(server, '/api/conversations', 'POST', {
      model: 'MiniMax-M2.7-highspeed'
    }, { Cookie: cookie });
    if (conversationB.status !== 200 || !conversationB.data.conversation?.id) {
      throw new Error('Expected second conversation creation to succeed');
    }
    if (conversationB.data.conversation?.title !== '新对话') {
      throw new Error('Expected untitled conversation to default to localized Chinese copy');
    }

    const initialConversationList = await request(server, '/api/conversations', 'GET', null, { Cookie: cookie });
    if (initialConversationList.data.conversations?.[0]?.id !== conversationB.data.conversation.id) {
      throw new Error('Expected newest empty conversation to be listed first');
    }

    const firstChat = await request(server, '/api/chat', 'POST', {
      conversationId: conversationA.data.conversation.id,
      message: 'Hello session chain',
      model: 'MiniMax-M2.7'
    }, { Cookie: cookie });
    if (firstChat.status !== 200 || firstChat.data.reply !== 'First reply from stub') {
      throw new Error('Expected first conversation chat reply to persist');
    }
    if (!Array.isArray(firstChat.data.messages) || firstChat.data.messages.length !== 2) {
      throw new Error('Expected conversation chat to return the persisted message chain');
    }
    if (firstChat.data.conversation?.title !== 'Hello session chain') {
      throw new Error('Expected first user message to seed the conversation title');
    }

    const conversationADetail = await request(
      server,
      `/api/conversations/${conversationA.data.conversation.id}`,
      'GET',
      null,
      { Cookie: cookie }
    );
    if (conversationADetail.status !== 200 || conversationADetail.data.messages?.length !== 2) {
      throw new Error('Expected conversation detail to reload the stored chain');
    }

    await new Promise(resolve => setTimeout(resolve, 5));
    const secondChat = await request(server, '/api/chat', 'POST', {
      conversationId: conversationA.data.conversation.id,
      message: 'Continue this thread',
      model: 'MiniMax-M2.7-highspeed'
    }, { Cookie: cookie });
    if (secondChat.status !== 200 || secondChat.data.reply !== 'Second reply from stub') {
      throw new Error('Expected second conversation chat reply to persist');
    }
    if (secondChat.data.messages?.length !== 4) {
      throw new Error('Expected second turn to append to the same conversation chain');
    }
    if (!Array.isArray(httpsStub.calls[1]?.messages) || httpsStub.calls[1].messages.length !== 3) {
      throw new Error('Expected upstream payload to include previous conversation context');
    }

    const orderedConversationList = await request(server, '/api/conversations', 'GET', null, { Cookie: cookie });
    if (orderedConversationList.data.conversations?.[0]?.id !== conversationA.data.conversation.id) {
      throw new Error('Expected active conversation with recent messages to sort to the top');
    }

    const renamedConversation = await request(
      server,
      `/api/conversations/${conversationB.data.conversation.id}`,
      'POST',
      { title: 'Renamed Conversation B' },
      { Cookie: cookie }
    );
    if (renamedConversation.status !== 200 || renamedConversation.data.conversation?.title !== 'Renamed Conversation B') {
      throw new Error('Expected conversation rename to persist');
    }

    const renamedConversationDetail = await request(
      server,
      `/api/conversations/${conversationB.data.conversation.id}`,
      'GET',
      null,
      { Cookie: cookie }
    );
    if (renamedConversationDetail.status !== 200 || renamedConversationDetail.data.conversation?.title !== 'Renamed Conversation B') {
      throw new Error('Expected conversation detail to reflect the renamed title');
    }

    const archivedConversation = await request(
      server,
      `/api/conversations/${conversationB.data.conversation.id}/archive`,
      'POST',
      {},
      { Cookie: cookie }
    );
    if (
      archivedConversation.status !== 200 ||
      archivedConversation.data.archivedConversationId !== conversationB.data.conversation.id ||
      (archivedConversation.data.conversations || []).some(item => item.id === conversationB.data.conversation.id)
    ) {
      throw new Error('Expected archived conversation to disappear from the active list');
    }

    const archivedConversationDetail = await request(
      server,
      `/api/conversations/${conversationB.data.conversation.id}`,
      'GET',
      null,
      { Cookie: cookie }
    );
    if (archivedConversationDetail.status !== 404) {
      throw new Error('Expected archived conversation detail to become unavailable');
    }

    const archivedConversationList = await request(server, '/api/conversations/archived', 'GET', null, { Cookie: cookie });
    if (
      archivedConversationList.status !== 200 ||
      !Array.isArray(archivedConversationList.data.conversations) ||
      archivedConversationList.data.conversations?.[0]?.id !== conversationB.data.conversation.id
    ) {
      throw new Error('Expected archived conversation list to return the archived conversation');
    }

    const restoredConversation = await request(
      server,
      `/api/conversations/${conversationB.data.conversation.id}/restore`,
      'POST',
      {},
      { Cookie: cookie }
    );
    if (
      restoredConversation.status !== 200 ||
      restoredConversation.data.conversation?.id !== conversationB.data.conversation.id ||
      (restoredConversation.data.archivedConversations || []).some(item => item.id === conversationB.data.conversation.id) ||
      !(restoredConversation.data.conversations || []).some(item => item.id === conversationB.data.conversation.id)
    ) {
      throw new Error('Expected archived conversation to restore into the active list');
    }

    const restoredConversationDetail = await request(
      server,
      `/api/conversations/${conversationB.data.conversation.id}`,
      'GET',
      null,
      { Cookie: cookie }
    );
    if (restoredConversationDetail.status !== 200 || restoredConversationDetail.data.conversation?.title !== 'Renamed Conversation B') {
      throw new Error('Expected restored conversation detail to be available again');
    }

    const reArchivedConversation = await request(
      server,
      `/api/conversations/${conversationB.data.conversation.id}/archive`,
      'POST',
      {},
      { Cookie: cookie }
    );
    if (
      reArchivedConversation.status !== 200 ||
      reArchivedConversation.data.archivedConversationId !== conversationB.data.conversation.id
    ) {
      throw new Error('Expected restored conversation to be archivable again');
    }

    const deletedConversation = await request(
      server,
      `/api/conversations/${conversationB.data.conversation.id}/delete`,
      'POST',
      {},
      { Cookie: cookie }
    );
    if (
      deletedConversation.status !== 200 ||
      deletedConversation.data.deletedConversationId !== conversationB.data.conversation.id ||
      (deletedConversation.data.archivedConversations || []).some(item => item.id === conversationB.data.conversation.id)
    ) {
      throw new Error('Expected archived conversation to be permanently deleted');
    }

    const deletedConversationArchivedList = await request(server, '/api/conversations/archived', 'GET', null, { Cookie: cookie });
    if ((deletedConversationArchivedList.data.conversations || []).some(item => item.id === conversationB.data.conversation.id)) {
      throw new Error('Expected deleted conversation to disappear from the archived list');
    }

    const deletedConversationDetail = await request(
      server,
      `/api/conversations/${conversationB.data.conversation.id}`,
      'GET',
      null,
      { Cookie: cookie }
    );
    if (deletedConversationDetail.status !== 404) {
      throw new Error('Expected deleted conversation detail to remain unavailable');
    }

    const usageAfterChats = await request(server, '/api/usage/today', 'GET', null, { Cookie: cookie });
    if (usageAfterChats.status !== 200 || usageAfterChats.data.usage?.chatCount !== 2) {
      throw new Error('Expected chat usage to reflect the two persisted conversation turns');
    }

    server.appStateStore.incrementUsageDaily(userId, 'chat');
    const usageAfter = await request(server, '/api/usage/today', 'GET', null, { Cookie: cookie });
    if (usageAfter.status !== 200 || usageAfter.data.usage?.chatCount !== 3) {
      throw new Error('Expected manual usage increment to be added on top of chat traffic');
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

    const createdMember = await request(server, '/api/admin/users', 'POST', {
      username: 'member-user',
      email: 'member-user@example.com',
      displayName: 'Member User',
      password: 'Member2026!',
      role: 'user',
      planCode: 'free'
    }, { Cookie: cookie });
    if (
      createdMember.status !== 200 ||
      createdMember.data.user?.username !== 'member-user' ||
      createdMember.data.user?.email !== 'member-user@example.com'
    ) {
      throw new Error('Expected admin create-user flow to persist a real user');
    }

    const duplicateMember = await request(server, '/api/admin/users', 'POST', {
      username: 'member-user',
      password: 'Another2026!'
    }, { Cookie: cookie });
    if (duplicateMember.status !== 409 || duplicateMember.data.error !== '用户名已存在') {
      throw new Error('Expected duplicate usernames to be rejected explicitly');
    }

    const invalidEmailMember = await request(server, '/api/admin/users', 'POST', {
      username: 'invalid-email-member',
      email: 'not-an-email',
      password: 'InvalidEmail2026!'
    }, { Cookie: cookie });
    if (invalidEmailMember.status !== 400 || invalidEmailMember.data.error !== '请输入有效邮箱地址') {
      throw new Error('Expected invalid admin create-user email payloads to be rejected explicitly');
    }

    const duplicateEmailMember = await request(server, '/api/admin/users', 'POST', {
      username: 'duplicate-email-member',
      email: 'member-user@example.com',
      password: 'DuplicateEmail2026!'
    }, { Cookie: cookie });
    if (duplicateEmailMember.status !== 409 || duplicateEmailMember.data.error !== '邮箱已存在') {
      throw new Error('Expected duplicate admin create-user emails to be rejected explicitly');
    }

    const updatedMemberEmail = await request(server, `/api/admin/users/${createdMember.data.user.id}`, 'POST', {
      email: 'member-updated@example.com'
    }, { Cookie: cookie });
    if (
      updatedMemberEmail.status !== 200 ||
      updatedMemberEmail.data.user?.id !== createdMember.data.user.id ||
      updatedMemberEmail.data.user?.email !== 'member-updated@example.com'
    ) {
      throw new Error('Expected admin email updates to persist for existing users');
    }

    const invalidMemberEmailUpdate = await request(server, `/api/admin/users/${createdMember.data.user.id}`, 'POST', {
      email: 'still-not-an-email'
    }, { Cookie: cookie });
    if (invalidMemberEmailUpdate.status !== 400 || invalidMemberEmailUpdate.data.error !== '请输入有效邮箱地址') {
      throw new Error('Expected invalid admin email updates to be rejected explicitly');
    }

    const createdReviewerWithEmail = await request(server, `/api/admin/users/${reviewer.id}`, 'POST', {
      email: 'reviewer@example.com'
    }, { Cookie: cookie });
    if (
      createdReviewerWithEmail.status !== 200 ||
      createdReviewerWithEmail.data.user?.id !== reviewer.id ||
      createdReviewerWithEmail.data.user?.email !== 'reviewer@example.com'
    ) {
      throw new Error('Expected admin user patch flow to allow assigning email addresses');
    }

    const duplicateEmailUpdate = await request(server, `/api/admin/users/${reviewer.id}`, 'POST', {
      email: 'member-updated@example.com'
    }, { Cookie: cookie });
    if (duplicateEmailUpdate.status !== 409 || duplicateEmailUpdate.data.error !== '邮箱已存在') {
      throw new Error('Expected duplicate admin email updates to be rejected explicitly');
    }

    const adminUsersAfterEmailUpdates = await request(server, '/api/admin/users', 'GET', null, { Cookie: cookie });
    const listedMemberUser = (adminUsersAfterEmailUpdates.data.users || []).find(user => user.id === createdMember.data.user.id);
    if (
      adminUsersAfterEmailUpdates.status !== 200 ||
      !listedMemberUser ||
      listedMemberUser.email !== 'member-updated@example.com'
    ) {
      throw new Error('Expected admin user listing to expose persisted email addresses');
    }

    const memberLogin = await request(server, '/api/auth/login', 'POST', {
      username: 'member-user',
      password: 'Member2026!'
    });
    if (
      memberLogin.status !== 200 ||
      memberLogin.data.user?.username !== 'member-user' ||
      memberLogin.data.user?.mustResetPassword !== true
    ) {
      throw new Error('Expected newly created user to log in successfully with forced password rotation required');
    }

    const memberCookieHeaderRaw = memberLogin.headers['set-cookie'];
    const memberCookieHeader = Array.isArray(memberCookieHeaderRaw) ? memberCookieHeaderRaw[0] : memberCookieHeaderRaw;
    if (!memberCookieHeader) {
      throw new Error('Expected newly created user to receive a session cookie');
    }
    const memberCookie = String(memberCookieHeader).split(';')[0];

    const forcedResetBlockedPreferences = await request(server, '/api/preferences', 'GET', null, { Cookie: memberCookie });
    if (
      forcedResetBlockedPreferences.status !== 403 ||
      forcedResetBlockedPreferences.data.reason !== 'password_reset_required' ||
      forcedResetBlockedPreferences.data.error !== '请先修改临时密码后再继续使用'
    ) {
      throw new Error('Expected forced-reset users to be blocked from protected routes until they change password');
    }

    const badForcedResetChange = await request(server, '/api/auth/change-password', 'POST', {
      currentPassword: 'Wrong2026!',
      newPassword: 'MemberPermanent2026!'
    }, { Cookie: memberCookie });
    if (
      badForcedResetChange.status !== 400 ||
      badForcedResetChange.data.reason !== 'current_password_incorrect' ||
      badForcedResetChange.data.error !== '当前密码不正确'
    ) {
      throw new Error('Expected forced-reset password change to validate the current password');
    }

    const completeForcedReset = await request(server, '/api/auth/change-password', 'POST', {
      currentPassword: 'Member2026!',
      newPassword: 'MemberPermanent2026!'
    }, { Cookie: memberCookie });
    if (
      completeForcedReset.status !== 200 ||
      completeForcedReset.data.user?.mustResetPassword !== false ||
      completeForcedReset.data.sessionRetained !== true
    ) {
      throw new Error('Expected forced-reset password change to clear the reset requirement and keep the current session');
    }

    const unlockedPreferences = await request(server, '/api/preferences', 'GET', null, { Cookie: memberCookie });
    if (unlockedPreferences.status !== 200 || unlockedPreferences.data.preferences?.theme !== 'dark') {
      throw new Error('Expected the same session to unlock protected routes after completing the forced reset');
    }

    const nonAdminAuditLogs = await request(server, '/api/admin/audit-logs', 'GET', null, { Cookie: memberCookie });
    if (nonAdminAuditLogs.status !== 403 || nonAdminAuditLogs.data.error !== '需要管理员权限') {
      throw new Error('Expected non-admin users to be blocked from the admin audit log route');
    }

    const oldInitialPasswordLogin = await request(server, '/api/auth/login', 'POST', {
      username: 'member-user',
      password: 'Member2026!'
    });
    if (oldInitialPasswordLogin.status !== 401 || oldInitialPasswordLogin.data.error !== '账号或密码不正确') {
      throw new Error('Expected the issued initial password to fail after the user completes first-login rotation');
    }

    const permanentPasswordLogin = await request(server, '/api/auth/login', 'POST', {
      username: 'member-user',
      password: 'MemberPermanent2026!'
    });
    if (
      permanentPasswordLogin.status !== 200 ||
      permanentPasswordLogin.data.user?.username !== 'member-user' ||
      permanentPasswordLogin.data.user?.mustResetPassword !== false
    ) {
      throw new Error('Expected the user-selected permanent password to become the steady-state login');
    }

    const permanentCookieHeaderRaw = permanentPasswordLogin.headers['set-cookie'];
    const permanentCookieHeader = Array.isArray(permanentCookieHeaderRaw) ? permanentCookieHeaderRaw[0] : permanentCookieHeaderRaw;
    if (!permanentCookieHeader) {
      throw new Error('Expected the permanent-password login to receive a session cookie');
    }
    const permanentMemberCookie = String(permanentCookieHeader).split(';')[0];

    const resetMemberPassword = await request(server, `/api/admin/users/${createdMember.data.user.id}/password`, 'POST', {
      password: 'MemberReset2026!'
    }, { Cookie: cookie });
    if (resetMemberPassword.status !== 200 || resetMemberPassword.data.user?.id !== createdMember.data.user.id) {
      throw new Error('Expected admin password reset to succeed');
    }

    const staleMemberSession = await request(server, '/api/auth/session', 'GET', null, { Cookie: permanentMemberCookie });
    if (
      staleMemberSession.status !== 401 ||
      staleMemberSession.data.reason !== 'session_expired' ||
      staleMemberSession.data.error !== '登录状态已失效，请重新登录'
    ) {
      throw new Error('Expected reset-password to revoke the target user session');
    }

    const oldPasswordLogin = await request(server, '/api/auth/login', 'POST', {
      username: 'member-user',
      password: 'MemberPermanent2026!'
    });
    if (oldPasswordLogin.status !== 401 || oldPasswordLogin.data.error !== '账号或密码不正确') {
      throw new Error('Expected the pre-reset steady-state password to fail after admin reset');
    }

    const newPasswordLogin = await request(server, '/api/auth/login', 'POST', {
      username: 'member-user',
      password: 'MemberReset2026!'
    });
    if (
      newPasswordLogin.status !== 200 ||
      newPasswordLogin.data.user?.username !== 'member-user' ||
      newPasswordLogin.data.user?.mustResetPassword !== true
    ) {
      throw new Error('Expected admin-reset credentials to log in only as a temporary password that still requires rotation');
    }

    const resetCookieHeaderRaw = newPasswordLogin.headers['set-cookie'];
    const resetCookieHeader = Array.isArray(resetCookieHeaderRaw) ? newPasswordLogin.headers['set-cookie'][0] : newPasswordLogin.headers['set-cookie'];
    if (!resetCookieHeader) {
      throw new Error('Expected the reset-password login to receive a session cookie');
    }
    const resetMemberCookie = String(resetCookieHeader).split(';')[0];

    const blockedAfterAdminReset = await request(server, '/api/preferences', 'GET', null, { Cookie: resetMemberCookie });
    if (
      blockedAfterAdminReset.status !== 403 ||
      blockedAfterAdminReset.data.reason !== 'password_reset_required' ||
      blockedAfterAdminReset.data.error !== '请先修改临时密码后再继续使用'
    ) {
      throw new Error('Expected admin-reset users to be forced through password rotation before protected access');
    }

    const finalizeResetPassword = await request(server, '/api/auth/change-password', 'POST', {
      currentPassword: 'MemberReset2026!',
      newPassword: 'MemberFinal2026!'
    }, { Cookie: resetMemberCookie });
    if (
      finalizeResetPassword.status !== 200 ||
      finalizeResetPassword.data.user?.mustResetPassword !== false
    ) {
      throw new Error('Expected users to complete a second forced rotation after admin reset');
    }

    const finalPasswordLogin = await request(server, '/api/auth/login', 'POST', {
      username: 'member-user',
      password: 'MemberFinal2026!'
    });
    if (
      finalPasswordLogin.status !== 200 ||
      finalPasswordLogin.data.user?.username !== 'member-user' ||
      finalPasswordLogin.data.user?.mustResetPassword !== false
    ) {
      throw new Error('Expected the post-reset permanent password to become the new valid login');
    }

    const adminUsers = await request(server, '/api/admin/users', 'GET', null, { Cookie: cookie });
    if (adminUsers.status !== 200 || !Array.isArray(adminUsers.data.users) || adminUsers.data.users.length < 3) {
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

    const pagedAuditLogs = await request(server, '/api/admin/audit-logs?page=1&pageSize=2', 'GET', null, { Cookie: cookie });
    if (
      pagedAuditLogs.status !== 200 ||
      !Array.isArray(pagedAuditLogs.data.items) ||
      pagedAuditLogs.data.items.length !== 2 ||
      pagedAuditLogs.data.page !== 1 ||
      pagedAuditLogs.data.pageSize !== 2 ||
      pagedAuditLogs.data.total < 4 ||
      pagedAuditLogs.data.totalPages < 2 ||
      pagedAuditLogs.data.hasMore !== true
    ) {
      throw new Error('Expected paginated admin audit logs to expose stable pagination fields');
    }

    const actionFilteredAuditLogs = await request(server, '/api/admin/audit-logs?action=user_create', 'GET', null, { Cookie: cookie });
    if (
      actionFilteredAuditLogs.status !== 200 ||
      !actionFilteredAuditLogs.data.items.length ||
      actionFilteredAuditLogs.data.items.some(item => item.action !== 'user_create') ||
      actionFilteredAuditLogs.data.filters?.action !== 'user_create'
    ) {
      throw new Error('Expected admin audit route action filtering to narrow the returned items');
    }

    const actorFilteredAuditLogs = await request(server, '/api/admin/audit-logs?actorUsername=stud', 'GET', null, { Cookie: cookie });
    if (
      actorFilteredAuditLogs.status !== 200 ||
      !actorFilteredAuditLogs.data.items.length ||
      actorFilteredAuditLogs.data.items.some(item => !String(item.actorUsername || '').toLowerCase().includes('stud')) ||
      actorFilteredAuditLogs.data.filters?.actorUsername !== 'stud'
    ) {
      throw new Error('Expected admin audit route actor filtering to narrow the returned items');
    }

    const targetFilteredAuditLogs = await request(server, '/api/admin/audit-logs?targetUsername=member', 'GET', null, { Cookie: cookie });
    if (
      targetFilteredAuditLogs.status !== 200 ||
      !targetFilteredAuditLogs.data.items.length ||
      targetFilteredAuditLogs.data.items.some(item => !String(item.targetUsername || '').toLowerCase().includes('member')) ||
      targetFilteredAuditLogs.data.filters?.targetUsername !== 'member'
    ) {
      throw new Error('Expected admin audit route target filtering to narrow the returned items');
    }

    const auditDay = new Date().toISOString().slice(0, 10);
    const dateFilteredAuditLogs = await request(server, `/api/admin/audit-logs?from=${auditDay}&to=${auditDay}`, 'GET', null, { Cookie: cookie });
    if (
      dateFilteredAuditLogs.status !== 200 ||
      !dateFilteredAuditLogs.data.items.length ||
      dateFilteredAuditLogs.data.filters?.from !== auditDay ||
      dateFilteredAuditLogs.data.filters?.to !== auditDay
    ) {
      throw new Error('Expected admin audit route date filtering to accept same-day ranges');
    }

    const auditLogs = server.appStateStore.listAuditLogs(20);
    const createUserAudit = auditLogs.find(log => log.action === 'user_create' && log.targetUserId === createdMember.data.user.id);
    if (
      !createUserAudit ||
      createUserAudit.actorUserId !== userId ||
      createUserAudit.targetUsername !== 'member-user' ||
      createUserAudit.targetRole !== 'user' ||
      createUserAudit.details?.email !== 'member-user@example.com' ||
      createUserAudit.details?.mustResetPassword !== true
    ) {
      throw new Error('Expected create-user audit log to persist actor, target, and temporary-password details');
    }

    const disableUserAudit = auditLogs.find(log => log.action === 'user_disable' && log.targetUserId === reviewer.id);
    if (
      !disableUserAudit ||
      disableUserAudit.actorUserId !== userId ||
      disableUserAudit.targetUsername !== 'reviewer' ||
      disableUserAudit.details?.previousStatus !== 'active' ||
      disableUserAudit.details?.nextStatus !== 'disabled'
    ) {
      throw new Error('Expected disable-user audit log to capture the status transition');
    }

    const roleChangeAudit = auditLogs.find(log => log.action === 'user_role_change' && log.targetUserId === reviewer.id);
    if (
      !roleChangeAudit ||
      roleChangeAudit.actorUserId !== userId ||
      roleChangeAudit.targetUsername !== 'reviewer' ||
      roleChangeAudit.targetRole !== 'admin' ||
      roleChangeAudit.details?.previousRole !== 'user' ||
      roleChangeAudit.details?.nextRole !== 'admin'
    ) {
      throw new Error('Expected role-change audit log to capture the admin promotion');
    }

    const passwordResetAudit = auditLogs.find(log => log.action === 'user_password_reset' && log.targetUserId === createdMember.data.user.id);
    if (
      !passwordResetAudit ||
      passwordResetAudit.actorUserId !== userId ||
      passwordResetAudit.targetUsername !== 'member-user' ||
      passwordResetAudit.details?.requirePasswordChange !== true ||
      passwordResetAudit.details?.sessionRetained !== false
    ) {
      throw new Error('Expected password-reset audit log to capture forced-rotation reset details');
    }

    const selfDisable = await request(server, `/api/admin/users/${userId}`, 'POST', {
      status: 'disabled'
    }, { Cookie: cookie });
    if (selfDisable.status !== 400 || selfDisable.data.error !== '不能禁用当前登录管理员') {
      throw new Error('Expected admin self-disable to be rejected explicitly');
    }

    const selfDemotion = await request(server, `/api/admin/users/${userId}`, 'POST', {
      role: 'user'
    }, { Cookie: cookie });
    if (selfDemotion.status !== 400 || selfDemotion.data.error !== '不能降级当前登录管理员') {
      throw new Error('Expected admin self-demotion to be rejected explicitly');
    }

    const selfPasswordChange = await request(server, '/api/auth/change-password', 'POST', {
      currentPassword: 'AIGS2026!',
      newPassword: 'StudioRotate2026!'
    }, { Cookie: cookie });
    if (
      selfPasswordChange.status !== 200 ||
      selfPasswordChange.data.sessionRetained !== true ||
      selfPasswordChange.data.user?.mustResetPassword !== false
    ) {
      throw new Error('Expected self-service password change to keep the current session and clear reset state');
    }

    const sessionAfterSelfChange = await request(server, '/api/auth/session', 'GET', null, { Cookie: cookie });
    if (
      sessionAfterSelfChange.status !== 200 ||
      sessionAfterSelfChange.data.user?.username !== 'studio' ||
      sessionAfterSelfChange.data.user?.mustResetPassword !== false
    ) {
      throw new Error('Expected the current session to remain usable after self-service password change');
    }

    const staleBootstrapPassword = await request(server, '/api/auth/login', 'POST', {
      username: 'studio',
      password: 'AIGS2026!'
    });
    if (staleBootstrapPassword.status !== 401 || staleBootstrapPassword.data.error !== '账号或密码不正确') {
      throw new Error('Expected the old bootstrap password to fail after self-service rotation');
    }

    const rotatedAdminLogin = await request(server, '/api/auth/login', 'POST', {
      username: 'studio',
      password: 'StudioRotate2026!'
    });
    if (
      rotatedAdminLogin.status !== 200 ||
      rotatedAdminLogin.data.user?.username !== 'studio' ||
      rotatedAdminLogin.data.user?.mustResetPassword !== false
    ) {
      throw new Error('Expected the rotated admin password to become the new valid login');
    }

    const invitedUser = await request(server, '/api/admin/users', 'POST', {
      username: 'invite-user',
      displayName: 'Invite User',
      password: 'InviteTemp2026!',
      role: 'user',
      planCode: 'free'
    }, { Cookie: cookie });
    if (invitedUser.status !== 200 || invitedUser.data.user?.username !== 'invite-user') {
      throw new Error('Expected admin create-user flow to prepare an invitation target');
    }

    const issuedInvitation = await request(server, `/api/admin/users/${invitedUser.data.user.id}/invite`, 'POST', {}, { Cookie: cookie });
    if (
      issuedInvitation.status !== 200 ||
      issuedInvitation.data.user?.username !== 'invite-user' ||
      issuedInvitation.data.deliveryMode !== 'local_preview' ||
      !issuedInvitation.data.previewUrl
    ) {
      throw new Error('Expected admin invite issuance to return a local preview link');
    }

    const invitationUrl = new URL(issuedInvitation.data.previewUrl, 'http://localhost');
    const invitationToken = invitationUrl.searchParams.get('invite');
    if (!invitationToken) {
      throw new Error('Expected admin invite preview link to contain an invitation token');
    }

    const invitationPreview = await request(server, `/api/auth/invitation?token=${encodeURIComponent(invitationToken)}`, 'GET');
    if (
      invitationPreview.status !== 200 ||
      invitationPreview.data.valid !== true ||
      invitationPreview.data.user?.username !== 'invite-user'
    ) {
      throw new Error('Expected invitation validation route to return the invite target');
    }

    const activation = await request(server, '/api/auth/invitation/activate', 'POST', {
      token: invitationToken,
      password: 'InvitePermanent2026!'
    });
    if (
      activation.status !== 200 ||
      activation.data.user?.username !== 'invite-user' ||
      activation.data.user?.mustResetPassword !== false
    ) {
      throw new Error('Expected invitation activation to set a steady-state password and log the user in');
    }

    const activationCookieHeaderRaw = activation.headers['set-cookie'];
    const activationCookieHeader = Array.isArray(activationCookieHeaderRaw) ? activationCookieHeaderRaw[0] : activationCookieHeaderRaw;
    if (!activationCookieHeader) {
      throw new Error('Expected invitation activation to establish a session cookie');
    }
    const activationCookie = String(activationCookieHeader).split(';')[0];

    const staleInvitationPasswordLogin = await request(server, '/api/auth/login', 'POST', {
      username: 'invite-user',
      password: 'InviteTemp2026!'
    });
    if (staleInvitationPasswordLogin.status !== 401 || staleInvitationPasswordLogin.data.error !== '账号或密码不正确') {
      throw new Error('Expected the admin-issued temporary password to fail after invitation activation');
    }

    const invitationSteadyLogin = await request(server, '/api/auth/login', 'POST', {
      username: 'invite-user',
      password: 'InvitePermanent2026!'
    });
    if (
      invitationSteadyLogin.status !== 200 ||
      invitationSteadyLogin.data.user?.username !== 'invite-user' ||
      invitationSteadyLogin.data.user?.mustResetPassword !== false
    ) {
      throw new Error('Expected the invitation-selected password to become the new valid login');
    }

    const consumedInvitationPreview = await request(server, `/api/auth/invitation?token=${encodeURIComponent(invitationToken)}`, 'GET');
    if (
      consumedInvitationPreview.status !== 404 ||
      consumedInvitationPreview.data.reason !== 'token_invalid'
    ) {
      throw new Error('Expected invitation links to become invalid immediately after activation');
    }

    const forgotPasswordRequest = await request(server, '/api/auth/forgot-password', 'POST', {
      username: 'invite-user'
    });
    if (
      forgotPasswordRequest.status !== 200 ||
      forgotPasswordRequest.data.success !== true ||
      forgotPasswordRequest.data.deliveryMode !== 'local_preview' ||
      !forgotPasswordRequest.data.previewUrl
    ) {
      throw new Error('Expected forgot-password requests to return a local preview link');
    }

    const forgotPreviewUrl = new URL(forgotPasswordRequest.data.previewUrl, 'http://localhost');
    const resetToken = forgotPreviewUrl.searchParams.get('reset');
    if (!resetToken) {
      throw new Error('Expected forgot-password preview link to contain a reset token');
    }

    const resetPreview = await request(server, `/api/auth/password-reset?token=${encodeURIComponent(resetToken)}`, 'GET');
    if (
      resetPreview.status !== 200 ||
      resetPreview.data.valid !== true ||
      resetPreview.data.user?.username !== 'invite-user'
    ) {
      throw new Error('Expected password-reset validation to return the reset target');
    }

    const unknownForgotPasswordRequest = await request(server, '/api/auth/forgot-password', 'POST', {
      username: 'missing-user'
    });
    if (
      unknownForgotPasswordRequest.status !== 200 ||
      unknownForgotPasswordRequest.data.success !== true ||
      unknownForgotPasswordRequest.data.deliveryMode !== 'local_preview' ||
      !unknownForgotPasswordRequest.data.previewUrl
    ) {
      throw new Error('Expected forgot-password to stay generic even for unknown users');
    }

    const unknownResetToken = new URL(unknownForgotPasswordRequest.data.previewUrl, 'http://localhost').searchParams.get('reset');
    const unknownResetPreview = await request(server, `/api/auth/password-reset?token=${encodeURIComponent(unknownResetToken)}`, 'GET');
    if (
      unknownResetPreview.status !== 404 ||
      unknownResetPreview.data.reason !== 'token_invalid'
    ) {
      throw new Error('Expected synthetic preview links for unknown users to fail only at token validation time');
    }

    const completedPasswordReset = await request(server, '/api/auth/password-reset/complete', 'POST', {
      token: resetToken,
      password: 'InviteRecovered2026!'
    });
    if (
      completedPasswordReset.status !== 200 ||
      completedPasswordReset.data.user?.username !== 'invite-user' ||
      completedPasswordReset.data.user?.mustResetPassword !== false
    ) {
      throw new Error('Expected password-reset completion to log the user in with a steady-state password');
    }

    const staleInvitationSession = await request(server, '/api/auth/session', 'GET', null, { Cookie: activationCookie });
    if (
      staleInvitationSession.status !== 401 ||
      staleInvitationSession.data.reason !== 'session_expired' ||
      staleInvitationSession.data.error !== '登录状态已失效，请重新登录'
    ) {
      throw new Error('Expected password-reset completion to invalidate the session established during invitation activation');
    }

    const staleActivatedPasswordLogin = await request(server, '/api/auth/login', 'POST', {
      username: 'invite-user',
      password: 'InvitePermanent2026!'
    });
    if (staleActivatedPasswordLogin.status !== 401 || staleActivatedPasswordLogin.data.error !== '账号或密码不正确') {
      throw new Error('Expected the pre-reset steady-state password to fail after password-reset completion');
    }

    const recoveredPasswordLogin = await request(server, '/api/auth/login', 'POST', {
      username: 'invite-user',
      password: 'InviteRecovered2026!'
    });
    if (
      recoveredPasswordLogin.status !== 200 ||
      recoveredPasswordLogin.data.user?.username !== 'invite-user' ||
      recoveredPasswordLogin.data.user?.mustResetPassword !== false
    ) {
      throw new Error('Expected the recovered password to become the new valid login');
    }

    const consumedResetPreview = await request(server, `/api/auth/password-reset?token=${encodeURIComponent(resetToken)}`, 'GET');
    if (
      consumedResetPreview.status !== 404 ||
      consumedResetPreview.data.reason !== 'token_invalid'
    ) {
      throw new Error('Expected password-reset links to become invalid immediately after completion');
    }

    const inviteAuditLog = server.appStateStore.listAuditLogs(40).find(log => log.action === 'user_invite_issue' && log.targetUserId === invitedUser.data.user.id);
    if (
      !inviteAuditLog ||
      inviteAuditLog.actorUserId !== userId ||
      inviteAuditLog.targetUsername !== 'invite-user' ||
      Number(inviteAuditLog.details?.expiresAt || 0) < Date.now()
    ) {
      throw new Error('Expected invitation issuance to be captured in the admin audit log');
    }

    const logout = await request(server, '/api/auth/logout', 'POST', {}, { Cookie: cookie });
    if (logout.status !== 200) throw new Error(`Expected 200 for logout, got ${logout.status}`);

    const afterLogout = await request(server, '/api/auth/session', 'GET', null, { Cookie: cookie });
    if (afterLogout.status !== 401) throw new Error(`Expected 401 after logout, got ${afterLogout.status}`);
  });

  await withServer(async (_stateDb, server) => {
    const adminLogin = await request(server, '/api/auth/login', 'POST', {
      username: 'studio',
      password: 'AIGS2026!'
    });
    if (adminLogin.status !== 200) {
      throw new Error('Expected bootstrap login to succeed before invitation operator testing');
    }
    const adminCookieHeaderRaw = adminLogin.headers['set-cookie'];
    const adminCookieHeader = Array.isArray(adminCookieHeaderRaw) ? adminCookieHeaderRaw[0] : adminCookieHeaderRaw;
    if (!adminCookieHeader) {
      throw new Error('Expected invitation operator testing login to return a session cookie');
    }
    const adminCookie = String(adminCookieHeader).split(';')[0];

    const inviteTarget = await request(server, '/api/admin/users', 'POST', {
      username: 'invite-ops-user',
      email: 'invite-ops-user@example.com',
      password: 'InviteOpsTemp2026!'
    }, { Cookie: adminCookie });
    if (inviteTarget.status !== 200) {
      throw new Error('Expected invitation operator test to create an invite target');
    }

    const initialUsers = await request(server, '/api/admin/users', 'GET', null, { Cookie: adminCookie });
    const initialTarget = (initialUsers.data.users || []).find(user => user.id === inviteTarget.data.user.id);
    if (!initialTarget || initialTarget.invitation?.active !== false) {
      throw new Error('Expected fresh admin user listings to show no active invitation before issuance');
    }

    const firstInvitation = await request(server, `/api/admin/users/${inviteTarget.data.user.id}/invite`, 'POST', {}, { Cookie: adminCookie });
    if (firstInvitation.status !== 200 || !firstInvitation.data.previewUrl) {
      throw new Error('Expected invitation operator test to issue an initial preview invitation');
    }
    const firstInvitationToken = new URL(firstInvitation.data.previewUrl, 'http://localhost').searchParams.get('invite');
    if (!firstInvitationToken) {
      throw new Error('Expected initial invitation issuance to return a preview token');
    }

    const usersAfterIssue = await request(server, '/api/admin/users', 'GET', null, { Cookie: adminCookie });
    const issuedTarget = (usersAfterIssue.data.users || []).find(user => user.id === inviteTarget.data.user.id);
    if (!issuedTarget?.invitation?.active || !issuedTarget.invitation?.expiresAt) {
      throw new Error('Expected admin user listings to expose an active invitation summary after issuance');
    }

    const resentInvitation = await request(server, `/api/admin/users/${inviteTarget.data.user.id}/invite-resend`, 'POST', {}, { Cookie: adminCookie });
    if (resentInvitation.status !== 200 || !resentInvitation.data.previewUrl) {
      throw new Error('Expected invitation resend to return a fresh preview invitation');
    }
    const resentInvitationToken = new URL(resentInvitation.data.previewUrl, 'http://localhost').searchParams.get('invite');
    if (!resentInvitationToken || resentInvitationToken === firstInvitationToken) {
      throw new Error('Expected invitation resend to mint a fresh token');
    }

    const staleInvitationPreview = await request(server, `/api/auth/invitation?token=${encodeURIComponent(firstInvitationToken)}`, 'GET');
    if (staleInvitationPreview.status !== 404 || staleInvitationPreview.data.reason !== 'token_invalid') {
      throw new Error('Expected invitation resend to invalidate the older invitation token');
    }

    const resentInvitationPreview = await request(server, `/api/auth/invitation?token=${encodeURIComponent(resentInvitationToken)}`, 'GET');
    if (resentInvitationPreview.status !== 200 || resentInvitationPreview.data.user?.username !== 'invite-ops-user') {
      throw new Error('Expected the resent invitation token to validate successfully');
    }

    const revokedInvitation = await request(server, `/api/admin/users/${inviteTarget.data.user.id}/invite-revoke`, 'POST', {}, { Cookie: adminCookie });
    if (
      revokedInvitation.status !== 200 ||
      revokedInvitation.data.revoked !== true ||
      revokedInvitation.data.invitation?.active !== false
    ) {
      throw new Error('Expected invitation revoke to clear the active invitation state');
    }

    const revokedInvitationPreview = await request(server, `/api/auth/invitation?token=${encodeURIComponent(resentInvitationToken)}`, 'GET');
    if (revokedInvitationPreview.status !== 404 || revokedInvitationPreview.data.reason !== 'token_invalid') {
      throw new Error('Expected invitation revoke to invalidate the active invitation token immediately');
    }

    const repeatedRevoke = await request(server, `/api/admin/users/${inviteTarget.data.user.id}/invite-revoke`, 'POST', {}, { Cookie: adminCookie });
    if (repeatedRevoke.status !== 409 || repeatedRevoke.data.error !== '当前账号没有可撤销的邀请链接') {
      throw new Error('Expected repeated invitation revoke attempts to fail once no active invitation remains');
    }

    const usersAfterRevoke = await request(server, '/api/admin/users', 'GET', null, { Cookie: adminCookie });
    const revokedTarget = (usersAfterRevoke.data.users || []).find(user => user.id === inviteTarget.data.user.id);
    if (!revokedTarget || revokedTarget.invitation?.active !== false) {
      throw new Error('Expected admin user listings to clear the active invitation summary after revoke');
    }

    const resendWithoutActiveInvite = await request(server, `/api/admin/users/${inviteTarget.data.user.id}/invite-resend`, 'POST', {}, { Cookie: adminCookie });
    if (resendWithoutActiveInvite.status !== 409 || resendWithoutActiveInvite.data.error !== '当前账号没有可重发的邀请链接，请先签发邀请') {
      throw new Error('Expected invitation resend to reject users without an active invitation');
    }

    const operatorAuditLogs = server.appStateStore.listAuditLogs(60);
    const issueAuditLog = operatorAuditLogs.find(log => log.action === 'user_invite_issue' && log.targetUserId === inviteTarget.data.user.id);
    const resendAuditLog = operatorAuditLogs.find(log => log.action === 'user_invite_resend' && log.targetUserId === inviteTarget.data.user.id);
    const revokeAuditLog = operatorAuditLogs.find(log => log.action === 'user_invite_revoke' && log.targetUserId === inviteTarget.data.user.id);
    if (!issueAuditLog || !resendAuditLog || !revokeAuditLog) {
      throw new Error('Expected invite issue, resend, and revoke actions to be captured in the admin audit log');
    }
  });

  await withServer(async (_stateDb, server) => {
    const login = await request(server, '/api/auth/login', 'POST', { username: 'studio', password: 'AIGS2026!' });
    if (login.status !== 200) {
      throw new Error('Expected bootstrap login to succeed before testing session expiry');
    }
    const rawCookieHeader = login.headers['set-cookie'];
    const cookieHeader = Array.isArray(rawCookieHeader) ? rawCookieHeader[0] : rawCookieHeader;
    if (!cookieHeader) {
      throw new Error('Expected short-lived login to return a session cookie');
    }
    const cookie = String(cookieHeader).split(';')[0];

    await new Promise(resolve => setTimeout(resolve, 20));

    const expiredSession = await request(server, '/api/auth/session', 'GET', null, { Cookie: cookie });
    if (
      expiredSession.status !== 401 ||
      expiredSession.data.reason !== 'session_expired' ||
      expiredSession.data.error !== '登录状态已失效，请重新登录'
    ) {
      throw new Error('Expected expired session checks to return a session-expired response');
    }

    const expiredPreferences = await request(server, '/api/preferences', 'GET', null, { Cookie: cookie });
    if (
      expiredPreferences.status !== 401 ||
      expiredPreferences.data.reason !== 'session_expired' ||
      expiredPreferences.data.error !== '登录状态已失效，请重新登录'
    ) {
      throw new Error('Expected protected routes to reject expired sessions explicitly');
    }
  }, {
    env: {
      PORT: '18803',
      SESSION_TTL_MS: '5'
    }
  });

  await withServer(async (_stateDb, server) => {
    const loginHeaders = { 'X-Forwarded-For': '10.10.10.10' };

    const firstRateLimitedLogin = await request(server, '/api/auth/login', 'POST', {
      username: 'studio',
      password: 'Wrong2026!'
    }, loginHeaders);
    if (firstRateLimitedLogin.status !== 401) {
      throw new Error('Expected first bad login attempt to remain a generic auth failure before rate limiting');
    }

    const secondRateLimitedLogin = await request(server, '/api/auth/login', 'POST', {
      username: 'studio',
      password: 'Wrong2026!'
    }, loginHeaders);
    if (secondRateLimitedLogin.status !== 401) {
      throw new Error('Expected second bad login attempt to remain a generic auth failure before rate limiting');
    }

    const blockedLogin = await request(server, '/api/auth/login', 'POST', {
      username: 'studio',
      password: 'Wrong2026!'
    }, loginHeaders);
    if (
      blockedLogin.status !== 429 ||
      blockedLogin.data.reason !== 'login_rate_limited' ||
      blockedLogin.data.error !== '登录尝试过于频繁，请稍后再试' ||
      Number(blockedLogin.data.retryAfterSeconds || 0) < 1 ||
      blockedLogin.headers['retry-after'] !== '60'
    ) {
      throw new Error('Expected repeated login attempts from the same client to hit the login rate limit');
    }

    const adminLogin = await request(server, '/api/auth/login', 'POST', {
      username: 'studio',
      password: 'AIGS2026!'
    }, { 'X-Forwarded-For': '10.10.10.11' });
    if (adminLogin.status !== 200) {
      throw new Error('Expected admin login to succeed from a separate client key for rate-limit testing');
    }

    const adminCookieHeaderRaw = adminLogin.headers['set-cookie'];
    const adminCookieHeader = Array.isArray(adminCookieHeaderRaw) ? adminCookieHeaderRaw[0] : adminCookieHeaderRaw;
    if (!adminCookieHeader) {
      throw new Error('Expected admin rate-limit test login to receive a session cookie');
    }
    const adminCookie = String(adminCookieHeader).split(';')[0];
    const adminHeaders = {
      Cookie: adminCookie,
      'X-Forwarded-For': '10.10.10.11'
    };

    const firstCreated = await request(server, '/api/admin/users', 'POST', {
      username: 'rate-user-1',
      password: 'RateUser12026!'
    }, adminHeaders);
    if (firstCreated.status !== 200 || firstCreated.data.user?.username !== 'rate-user-1') {
      throw new Error('Expected first admin create-user action to succeed before rate limiting');
    }

    const secondCreated = await request(server, '/api/admin/users', 'POST', {
      username: 'rate-user-2',
      password: 'RateUser22026!'
    }, adminHeaders);
    if (secondCreated.status !== 200 || secondCreated.data.user?.username !== 'rate-user-2') {
      throw new Error('Expected second admin create-user action to succeed before rate limiting');
    }

    const blockedCreate = await request(server, '/api/admin/users', 'POST', {
      username: 'rate-user-3',
      password: 'RateUser32026!'
    }, adminHeaders);
    if (
      blockedCreate.status !== 429 ||
      blockedCreate.data.reason !== 'admin_user_create_rate_limited' ||
      blockedCreate.data.error !== '创建用户操作过于频繁，请稍后再试' ||
      Number(blockedCreate.data.retryAfterSeconds || 0) < 1 ||
      blockedCreate.headers['retry-after'] !== '60' ||
      server.appStateStore.getUserByUsername('rate-user-3')
    ) {
      throw new Error('Expected repeated admin create-user actions to hit the create-user rate limit');
    }

    const firstReset = await request(server, `/api/admin/users/${firstCreated.data.user.id}/password`, 'POST', {
      password: 'RateReset12026!'
    }, adminHeaders);
    if (firstReset.status !== 200 || firstReset.data.user?.id !== firstCreated.data.user.id) {
      throw new Error('Expected the first admin password reset to succeed before rate limiting');
    }

    const blockedReset = await request(server, `/api/admin/users/${secondCreated.data.user.id}/password`, 'POST', {
      password: 'RateReset22026!'
    }, adminHeaders);
    if (
      blockedReset.status !== 429 ||
      blockedReset.data.reason !== 'admin_password_reset_rate_limited' ||
      blockedReset.data.error !== '重置密码操作过于频繁，请稍后再试' ||
      Number(blockedReset.data.retryAfterSeconds || 0) < 1 ||
      blockedReset.headers['retry-after'] !== '60'
    ) {
      throw new Error('Expected repeated admin password resets to hit the password-reset rate limit');
    }

    const forgotPasswordHeaders = { 'X-Forwarded-For': '10.10.10.12' };
    const firstForgotPassword = await request(server, '/api/auth/forgot-password', 'POST', {
      username: 'rate-user-1'
    }, forgotPasswordHeaders);
    if (
      firstForgotPassword.status !== 200 ||
      firstForgotPassword.data.success !== true ||
      firstForgotPassword.data.deliveryMode !== 'local_preview' ||
      !firstForgotPassword.data.previewUrl
    ) {
      throw new Error('Expected the first forgot-password request to succeed before rate limiting');
    }

    const blockedForgotPassword = await request(server, '/api/auth/forgot-password', 'POST', {
      username: 'missing-rate-user'
    }, forgotPasswordHeaders);
    if (
      blockedForgotPassword.status !== 429 ||
      blockedForgotPassword.data.reason !== 'forgot_password_rate_limited' ||
      blockedForgotPassword.data.error !== '找回密码请求过于频繁，请稍后再试' ||
      Number(blockedForgotPassword.data.retryAfterSeconds || 0) < 1 ||
      blockedForgotPassword.headers['retry-after'] !== '60'
    ) {
      throw new Error('Expected repeated forgot-password requests from the same client to hit the dedicated rate limit');
    }
  }, {
    env: {
      PORT: '18804',
      TRUST_PROXY: 'true',
      LOGIN_RATE_LIMIT_MAX: '2',
      LOGIN_RATE_LIMIT_WINDOW_MS: '60000',
      FORGOT_PASSWORD_RATE_LIMIT_MAX: '1',
      FORGOT_PASSWORD_RATE_LIMIT_WINDOW_MS: '60000',
      ADMIN_CREATE_USER_RATE_LIMIT_MAX: '2',
      ADMIN_CREATE_USER_RATE_LIMIT_WINDOW_MS: '60000',
      ADMIN_PASSWORD_RESET_RATE_LIMIT_MAX: '1',
      ADMIN_PASSWORD_RESET_RATE_LIMIT_WINDOW_MS: '60000'
    }
  });

  {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aigs-rate-limit-persist-'));
    const stateDb = path.join(tempRoot, 'app-state.sqlite');
    const legacyFile = path.join(tempRoot, 'app-state.json');
    fs.writeFileSync(legacyFile, JSON.stringify({ sessions: {}, history: {} }, null, 2));

    let firstServer = null;
    let secondServer = null;
    try {
      firstServer = createTestServer({
        env: {
          PORT: '18805',
          APP_STATE_DB: stateDb,
          APP_STATE_FILE: legacyFile,
          FORGOT_PASSWORD_RATE_LIMIT_MAX: '1',
          FORGOT_PASSWORD_RATE_LIMIT_WINDOW_MS: '60000'
        }
      }).server;

      const firstForgotPassword = await request(firstServer, '/api/auth/forgot-password', 'POST', {
        username: 'studio'
      }, { 'X-Forwarded-For': '10.10.10.13' });
      if (
        firstForgotPassword.status !== 200 ||
        firstForgotPassword.data.success !== true ||
        firstForgotPassword.data.deliveryMode !== 'local_preview'
      ) {
        throw new Error('Expected the initial forgot-password request to succeed before restart-persistence testing');
      }

      firstServer.appStateStore?.close?.();
      firstServer = null;

      secondServer = createTestServer({
        env: {
          PORT: '18805',
          APP_STATE_DB: stateDb,
          APP_STATE_FILE: legacyFile,
          FORGOT_PASSWORD_RATE_LIMIT_MAX: '1',
          FORGOT_PASSWORD_RATE_LIMIT_WINDOW_MS: '60000'
        }
      }).server;

      const blockedAfterRestart = await request(secondServer, '/api/auth/forgot-password', 'POST', {
        username: 'studio'
      }, { 'X-Forwarded-For': '10.10.10.13' });
      if (
        blockedAfterRestart.status !== 429 ||
        blockedAfterRestart.data.reason !== 'forgot_password_rate_limited' ||
        blockedAfterRestart.data.error !== '找回密码请求过于频繁，请稍后再试' ||
        Number(blockedAfterRestart.data.retryAfterSeconds || 0) < 1 ||
        blockedAfterRestart.headers['retry-after'] !== '60'
      ) {
        throw new Error('Expected forgot-password rate limits to survive server restart when the same SQLite state DB is reused');
      }
    } finally {
      firstServer?.appStateStore?.close?.();
      secondServer?.appStateStore?.close?.();
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  }

  {
    const notificationStub = createNotificationFetchStub([
      { ok: true, status: 200, body: { id: 'email_invite_1' } },
      { ok: true, status: 200, body: { id: 'email_reset_1' } }
    ]);

    await withServer(async (_stateDb, server) => {
      const adminLogin = await request(server, '/api/auth/login', 'POST', {
        username: 'studio',
        password: 'AIGS2026!'
      });
      if (adminLogin.status !== 200) {
        throw new Error('Expected admin login to succeed before resend delivery testing');
      }
      const adminCookieHeaderRaw = adminLogin.headers['set-cookie'];
      const adminCookieHeader = Array.isArray(adminCookieHeaderRaw) ? adminCookieHeaderRaw[0] : adminCookieHeaderRaw;
      if (!adminCookieHeader) {
        throw new Error('Expected resend delivery admin login to receive a session cookie');
      }
      const adminCookie = String(adminCookieHeader).split(';')[0];

      const inviteTarget = await request(server, '/api/admin/users', 'POST', {
        username: 'emailed-user',
        email: 'emailed-user@example.com',
        password: 'InviteMail2026!'
      }, { Cookie: adminCookie });
      if (inviteTarget.status !== 200 || inviteTarget.data.user?.email !== 'emailed-user@example.com') {
        throw new Error('Expected resend delivery test user creation to persist an email address');
      }

      const issuedInvitation = await request(server, `/api/admin/users/${inviteTarget.data.user.id}/invite`, 'POST', {}, { Cookie: adminCookie });
      if (
        issuedInvitation.status !== 200 ||
        issuedInvitation.data.deliveryMode !== 'resend' ||
        issuedInvitation.data.recipientEmail !== 'emailed-user@example.com' ||
        issuedInvitation.data.previewUrl
      ) {
        throw new Error('Expected admin invitation issuance to use real email delivery when resend mode is enabled');
      }
      if (
        notificationStub.calls.length < 1 ||
        notificationStub.calls[0].url !== 'https://api.resend.com/emails' ||
        notificationStub.calls[0].payload?.to?.[0] !== 'emailed-user@example.com'
      ) {
        throw new Error('Expected invitation email delivery to call the Resend API with the target email');
      }

      const invitationToken = extractPublicTokenFromEmail(notificationStub.calls[0].payload, 'invite');
      if (!invitationToken) {
        throw new Error('Expected invitation emails to contain a usable invitation token link');
      }
      const invitationPreview = await request(server, `/api/auth/invitation?token=${encodeURIComponent(invitationToken)}`, 'GET');
      if (
        invitationPreview.status !== 200 ||
        invitationPreview.data.valid !== true ||
        invitationPreview.data.user?.username !== 'emailed-user'
      ) {
        throw new Error('Expected tokens embedded in invitation emails to validate successfully');
      }

      const forgotPasswordRequest = await request(server, '/api/auth/forgot-password', 'POST', {
        username: 'emailed-user'
      });
      if (
        forgotPasswordRequest.status !== 200 ||
        forgotPasswordRequest.data.deliveryMode !== 'resend' ||
        forgotPasswordRequest.data.previewUrl
      ) {
        throw new Error('Expected forgot-password to avoid local preview links when resend mode is enabled');
      }
      if (
        notificationStub.calls.length < 2 ||
        notificationStub.calls[1].payload?.to?.[0] !== 'emailed-user@example.com'
      ) {
        throw new Error('Expected forgot-password delivery to call the Resend API with the target email');
      }

      const resetToken = extractPublicTokenFromEmail(notificationStub.calls[1].payload, 'reset');
      if (!resetToken) {
        throw new Error('Expected password-reset emails to contain a usable reset token link');
      }
      const resetPreview = await request(server, `/api/auth/password-reset?token=${encodeURIComponent(resetToken)}`, 'GET');
      if (
        resetPreview.status !== 200 ||
        resetPreview.data.valid !== true ||
        resetPreview.data.user?.username !== 'emailed-user'
      ) {
        throw new Error('Expected tokens embedded in password-reset emails to validate successfully');
      }
    }, {
      notificationFetch: notificationStub.fetch,
      env: {
        PORT: '18806',
        NOTIFICATION_DELIVERY_MODE: 'resend',
        NOTIFICATION_FROM_EMAIL: 'noreply@example.com',
        RESEND_API_KEY: 'resend_test_key',
        APP_BASE_URL: 'https://app.example.com'
      }
    });
  }

  {
    const failingNotificationStub = createNotificationFetchStub([
      { ok: false, status: 503, body: { message: 'provider down' } },
      { ok: false, status: 503, body: { message: 'provider down' } }
    ]);

    await withServer(async (_stateDb, server) => {
      const adminLogin = await request(server, '/api/auth/login', 'POST', {
        username: 'studio',
        password: 'AIGS2026!'
      });
      if (adminLogin.status !== 200) {
        throw new Error('Expected admin login to succeed before resend failure-path testing');
      }
      const adminCookieHeaderRaw = adminLogin.headers['set-cookie'];
      const adminCookieHeader = Array.isArray(adminCookieHeaderRaw) ? adminCookieHeaderRaw[0] : adminCookieHeaderRaw;
      if (!adminCookieHeader) {
        throw new Error('Expected resend failure-path admin login to receive a session cookie');
      }
      const adminCookie = String(adminCookieHeader).split(';')[0];

      const noEmailInviteTarget = await request(server, '/api/admin/users', 'POST', {
        username: 'no-email-invite-user',
        password: 'NoEmailInvite2026!'
      }, { Cookie: adminCookie });
      if (noEmailInviteTarget.status !== 200) {
        throw new Error('Expected resend failure-path test to create a user without email');
      }

      const missingEmailInvite = await request(server, `/api/admin/users/${noEmailInviteTarget.data.user.id}/invite`, 'POST', {}, { Cookie: adminCookie });
      if (missingEmailInvite.status !== 409 || missingEmailInvite.data.error !== '目标账号未设置邮箱地址') {
        throw new Error('Expected admin invitation issuance to fail closed when resend mode is enabled but the target has no email');
      }

      const emailedTarget = await request(server, '/api/admin/users', 'POST', {
        username: 'email-failure-user',
        email: 'email-failure-user@example.com',
        password: 'EmailFailure2026!'
      }, { Cookie: adminCookie });
      if (emailedTarget.status !== 200) {
        throw new Error('Expected resend failure-path test to create an email-enabled user');
      }

      const failedInvitation = await request(server, `/api/admin/users/${emailedTarget.data.user.id}/invite`, 'POST', {}, { Cookie: adminCookie });
      if (
        failedInvitation.status !== 502 ||
        failedInvitation.data.reason !== 'notification_delivery_failed' ||
        failedInvitation.data.error !== 'provider down'
      ) {
        throw new Error('Expected admin invitation issuance to fail closed when the email provider returns an error');
      }

      const failedForgotPassword = await request(server, '/api/auth/forgot-password', 'POST', {
        username: 'email-failure-user'
      });
      if (
        failedForgotPassword.status !== 200 ||
        failedForgotPassword.data.success !== true ||
        failedForgotPassword.data.deliveryMode !== 'resend' ||
        failedForgotPassword.data.previewUrl
      ) {
        throw new Error('Expected forgot-password to remain generic even when resend delivery fails');
      }
    }, {
      notificationFetch: failingNotificationStub.fetch,
      env: {
        PORT: '18807',
        NOTIFICATION_DELIVERY_MODE: 'resend',
        NOTIFICATION_FROM_EMAIL: 'noreply@example.com',
        RESEND_API_KEY: 'resend_test_key',
        APP_BASE_URL: 'https://app.example.com'
      }
    });
  }

  {
    const fallbackNotificationStub = createNotificationFetchStub([
      { ok: false, status: 503, body: { message: 'provider down' } },
      { ok: false, status: 503, body: { message: 'provider down' } }
    ]);

    await withServer(async (_stateDb, server) => {
      const adminLogin = await request(server, '/api/auth/login', 'POST', {
        username: 'studio',
        password: 'AIGS2026!'
      });
      if (adminLogin.status !== 200) {
        throw new Error('Expected admin login to succeed before notification failover testing');
      }
      const adminCookieHeaderRaw = adminLogin.headers['set-cookie'];
      const adminCookieHeader = Array.isArray(adminCookieHeaderRaw) ? adminCookieHeaderRaw[0] : adminCookieHeaderRaw;
      if (!adminCookieHeader) {
        throw new Error('Expected notification failover admin login to receive a session cookie');
      }
      const adminCookie = String(adminCookieHeader).split(';')[0];

      const emailedTarget = await request(server, '/api/admin/users', 'POST', {
        username: 'fallback-email-user',
        email: 'fallback-email-user@example.com',
        password: 'FallbackInvite2026!'
      }, { Cookie: adminCookie });
      if (emailedTarget.status !== 200) {
        throw new Error('Expected notification failover test to create an email-enabled user');
      }

      const failedInvitation = await request(server, `/api/admin/users/${emailedTarget.data.user.id}/invite`, 'POST', {}, { Cookie: adminCookie });
      if (
        failedInvitation.status !== 502 ||
        failedInvitation.data.reason !== 'notification_delivery_failed' ||
        failedInvitation.data.error !== 'provider down' ||
        failedInvitation.data.fallbackMode !== 'local_preview' ||
        !failedInvitation.data.previewUrl
      ) {
        throw new Error('Expected invitation failure to expose an explicit local-preview operator fallback when failover mode is enabled');
      }
      const fallbackInvitationToken = new URL(failedInvitation.data.previewUrl, 'http://localhost').searchParams.get('invite');
      if (!fallbackInvitationToken) {
        throw new Error('Expected notification failover invitation fallback to include a usable invitation token');
      }
      const fallbackInvitationPreview = await request(server, `/api/auth/invitation?token=${encodeURIComponent(fallbackInvitationToken)}`, 'GET');
      if (
        fallbackInvitationPreview.status !== 200 ||
        fallbackInvitationPreview.data.valid !== true ||
        fallbackInvitationPreview.data.user?.username !== 'fallback-email-user'
      ) {
        throw new Error('Expected invitation tokens exposed by the operator fallback to validate successfully');
      }

      const failedForgotPassword = await request(server, '/api/auth/forgot-password', 'POST', {
        username: 'fallback-email-user'
      });
      if (
        failedForgotPassword.status !== 200 ||
        failedForgotPassword.data.success !== true ||
        failedForgotPassword.data.deliveryMode !== 'resend' ||
        failedForgotPassword.data.previewUrl
      ) {
        throw new Error('Expected forgot-password to remain generic even when notification failover mode is enabled');
      }
    }, {
      notificationFetch: fallbackNotificationStub.fetch,
      env: {
        PORT: '18808',
        NOTIFICATION_DELIVERY_MODE: 'resend',
        NOTIFICATION_FAILOVER_MODE: 'local_preview',
        NOTIFICATION_FROM_EMAIL: 'noreply@example.com',
        RESEND_API_KEY: 'resend_test_key',
        APP_BASE_URL: 'https://app.example.com'
      }
    });
  }

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
