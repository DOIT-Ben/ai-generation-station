const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { chromium } = require('playwright');
const { createServer } = require('./server/index');
const { createConfig } = require('./server/config');

function parseArgs(argv) {
  const args = {
    baseUrl: process.env.UI_SMOKE_BASE_URL || 'http://127.0.0.1:18791',
    port: Number(process.env.UI_SMOKE_PORT || 18791),
    launchServer: process.env.UI_SMOKE_LAUNCH_SERVER === '1',
    cdpUrl: process.env.UI_SMOKE_CDP_URL || ''
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--base-url' && argv[i + 1]) {
      args.baseUrl = argv[i + 1];
      i += 1;
    } else if (arg === '--port' && argv[i + 1]) {
      args.port = Number(argv[i + 1]);
      i += 1;
    } else if (arg === '--launch-server') {
      args.launchServer = true;
    } else if (arg === '--cdp-url' && argv[i + 1]) {
      args.cdpUrl = argv[i + 1];
      i += 1;
    }
  }

  return args;
}

function requestUrl(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
  });
}

async function waitForServer(url, timeoutMs = 10000) {
  const startedAt = Date.now();
  let lastError = null;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await requestUrl(url);
      if (response.status === 200) {
        return response;
      }
      lastError = new Error(`Unexpected status ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }

  throw new Error(`UI smoke target not ready: ${lastError ? lastError.message : url}`);
}

async function withListeningServer({ port }, fn) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aigs-ui-smoke-'));
  const tempDbPath = path.join(tempRoot, 'app-state.sqlite');
  const tempLegacyPath = path.join(tempRoot, 'app-state.json');
  fs.writeFileSync(tempLegacyPath, JSON.stringify({ sessions: {}, history: {} }, null, 2));

  const server = createServer({
    config: createConfig({
      env: {
        ...process.env,
        PORT: String(port),
        APP_STATE_DB: tempDbPath,
        APP_STATE_FILE: tempLegacyPath
      }
    })
  });

  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, '127.0.0.1', resolve);
    });
    return await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise(resolve => server.close(() => resolve()));
    server.appStateStore?.close?.();
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

function extractFirstUrl(text) {
  const match = String(text || '').match(/https?:\/\/\S+/);
  return match ? match[0] : '';
}

function parsePageUrl(page) {
  return new URL(page.url());
}

async function waitForPath(page, pathname, searchPredicate = null) {
  const startedAt = Date.now();
  let lastUrl = '';
  while (Date.now() - startedAt < 30000) {
    lastUrl = page.url();
    if (lastUrl) {
      const nextUrl = new URL(lastUrl);
      if (nextUrl.pathname === pathname && (typeof searchPredicate !== 'function' || searchPredicate(nextUrl))) {
        return;
      }
    }
    await page.waitForTimeout(100);
  }
  throw new Error(`Timed out waiting for path ${pathname} (last url: ${lastUrl || 'empty'})`);
}

async function assertAuthPage(page, options = {}) {
  const expectedNext = options.expectedNext;
  await waitForPath(page, '/login/', expectedNext == null ? null : url => url.searchParams.get('next') === expectedNext);
  await page.locator('#theme-toggle').waitFor({ state: 'visible' });
  await page.locator('#portal-user-nav').waitFor({ state: 'visible' });
  await page.locator('#login-form').waitFor({ state: 'visible' });
  await page.locator('#login-username').waitFor({ state: 'visible' });
  await page.locator('#login-password').waitFor({ state: 'visible' });
}

async function switchAuthMode(page, mode) {
  await page.locator(`[data-auth-mode="${mode}"]`).click();
  await page.locator(`#auth-pane-${mode}`).waitFor({ state: 'visible' });
}

async function assertAuthModeSwitching(page) {
  await assertAuthPage(page);
  assert.equal(await page.locator('#auth-pane-login').isVisible(), true, 'login pane should be visible on the login page');

  await page.goto(`${new URL(page.url()).origin}/register/`, { waitUntil: 'domcontentloaded' });
  assert.equal(await page.locator('#register-form').isVisible(), true, 'register form should be visible on the register page');

  await page.goto(`${new URL(page.url()).origin}/auth/`, { waitUntil: 'domcontentloaded' });
  assert.equal(await page.locator('#forgot-form').isVisible(), true, 'forgot-password form should be visible on the recovery page');

  await page.goto(`${new URL(page.url()).origin}/login/`, { waitUntil: 'domcontentloaded' });
  assert.equal(await page.locator('#login-form').isVisible(), true, 'login form should be visible again after returning to login');
}

async function loginThroughAuthPage(page, { username, password, expectedPath = '/' }) {
  await assertAuthPage(page);
  await page.fill('#login-username', username);
  await page.fill('#login-password', password);

  const [response] = await Promise.all([
    page.waitForResponse(item => item.url().includes('/api/auth/login') && item.request().method() === 'POST'),
    page.locator('#login-form button[type="submit"]').click()
  ]);

  assert.equal(response.status(), 200, `login should succeed for ${username}`);
  await waitForPath(page, expectedPath);
}

async function assertWorkspaceAuthenticated(page, username, options = {}) {
  await waitForPath(page, '/');
  await page.locator('#sidebar').waitFor({ state: 'visible' });
  await page.locator('#theme-toggle').waitFor({ state: 'visible' });
  await page.locator('#btn-logout').waitFor({ state: 'visible' });
  const userPanelText = await page.locator('#user-panel').innerText();
  assert.ok(userPanelText.includes(username), `workspace user panel should render ${username}`);
  if (options.isAdmin === true) {
    assert.ok(userPanelText.includes('后台'), 'workspace user panel should expose admin entry for admin users');
  }
  if (options.isAdmin === false) {
    assert.ok(!userPanelText.includes('后台'), 'workspace user panel should not expose admin entry for non-admin users');
  }
}

async function assertThemeToggleWorks(page) {
  const themeBefore = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  await page.click('#theme-toggle');
  await page.waitForFunction(previousTheme => document.documentElement.getAttribute('data-theme') !== previousTheme, themeBefore);
  const themeAfter = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  assert.notStrictEqual(themeAfter, themeBefore, 'theme toggle should change the root theme');
}

async function assertWorkspaceNavigation(page) {
  await page.locator('.nav-item[data-tab="lyrics"]').click();
  await page.waitForFunction(() => {
    const tab = document.getElementById('tab-lyrics');
    const nav = document.querySelector('.nav-item[data-tab="lyrics"]');
    return Boolean(tab?.classList.contains('active') && nav?.classList.contains('active'));
  });
}

async function renameActiveWorkspaceConversation(page, title) {
  await page.evaluate(nextTitle => {
    window.prompt = () => nextTitle;
  }, title);
  const manageButton = page.locator('#btn-chat-manage-conversations');
  const manageState = await manageButton.getAttribute('aria-pressed');
  if (manageState !== 'true') {
    await manageButton.click();
    await page.waitForFunction(() => document.getElementById('btn-chat-manage-conversations')?.getAttribute('aria-pressed') === 'true');
  }

  const [response] = await Promise.all([
    page.waitForResponse(item => item.url().includes('/api/conversations/') && item.request().method() === 'POST'),
    page.locator('[data-conversation-rename-id]').first().click()
  ]);

  assert.equal(response.status(), 200, 'conversation rename should succeed');
  await page.waitForFunction(expected => {
    const title = document.getElementById('chat-conversation-title');
    return Boolean(title?.textContent?.includes(expected));
  }, title);
}

function getConversationCardTitlePreview(title) {
  const normalized = String(title || '').replace(/\s+/g, ' ').trim();
  if (normalized.length <= 15) return normalized;
  return `${normalized.slice(0, 15)}...`;
}

async function assertWorkspaceResumePersistence(page, uniqueSeed) {
  const firstConversationMessage = `polish-first-${uniqueSeed}`;
  const secondConversationMessage = `polish-second-${uniqueSeed}`;
  const lyricsDraft = `每日使用草稿 ${uniqueSeed}`;

  await page.locator('.nav-item[data-tab="chat"]').click();
  await page.waitForFunction(() => document.getElementById('tab-chat')?.classList.contains('active'));
  await page.click('#btn-chat-new-conversation');
  await page.waitForFunction(() => {
    const title = document.getElementById('chat-conversation-title');
    return Boolean(title?.textContent?.includes('新对话'));
  });
  await renameActiveWorkspaceConversation(page, firstConversationMessage);
  await page.click('#btn-chat-new-conversation');
  await page.waitForFunction(() => {
    const title = document.getElementById('chat-conversation-title');
    return Boolean(title?.textContent?.includes('新对话'));
  });
  await renameActiveWorkspaceConversation(page, secondConversationMessage);

  await page.locator(`.chat-conversation-item:has-text("${getConversationCardTitlePreview(firstConversationMessage)}")`).first().click();
  await page.waitForFunction(expected => {
    const title = document.getElementById('chat-conversation-title');
    return Boolean(title?.textContent?.includes(expected));
  }, firstConversationMessage);

  await page.locator('.nav-item[data-tab="lyrics"]').click();
  await page.waitForFunction(() => document.getElementById('tab-lyrics')?.classList.contains('active'));
  await page.fill('#lyrics-prompt', lyricsDraft);
  await page.waitForTimeout(1400);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await assertWorkspaceAuthenticated(page, 'studio', { isAdmin: true });
  await page.waitForFunction(expected => {
    const tab = document.getElementById('tab-lyrics');
    const nav = document.querySelector('.nav-item[data-tab="lyrics"]');
    const input = document.getElementById('lyrics-prompt');
    return Boolean(
      tab?.classList.contains('active') &&
      nav?.classList.contains('active') &&
      input?.value === expected
    );
  }, lyricsDraft);

  await page.locator('.nav-item[data-tab="chat"]').click();
  await page.waitForFunction(expected => {
    const title = document.getElementById('chat-conversation-title');
    return Boolean(title?.textContent?.includes(expected));
  }, firstConversationMessage);
}

async function logoutFromWorkspace(page) {
  const [response] = await Promise.all([
    page.waitForResponse(item => item.url().includes('/api/auth/logout') && item.request().method() === 'POST'),
    page.click('#btn-logout')
  ]);

  assert.equal(response.status(), 200, 'workspace logout should succeed');
  await assertAuthPage(page);
}

async function assertPortalPageLoaded(page, pathname) {
  await waitForPath(page, pathname);
  await page.locator('#theme-toggle').waitFor({ state: 'visible' });
  await page.locator('#portal-user-nav').waitFor({ state: 'visible' });
  await page.locator('#portal-logout-button').waitFor({ state: 'visible' });
}

async function assertAccountPage(page, { username, roleLabel, adminLinkVisible }) {
  await assertPortalPageLoaded(page, '/account/');
  await page.locator('#account-password-form').waitFor({ state: 'visible' });
  await page.locator('#account-password-status-heading').waitFor({ state: 'visible' });
  const usernameLine = await page.locator('#account-username-line').innerText();
  const roleText = await page.locator('#account-role-pill').innerText();
  assert.ok(usernameLine.includes(username), `account page should render username ${username}`);
  assert.ok(roleText.includes(roleLabel), `account page should render role label ${roleLabel}`);
  assert.equal(
    await page.locator('#account-admin-link').isVisible(),
    adminLinkVisible,
    `account admin link visibility should be ${adminLinkVisible}`
  );
}

async function changePasswordFromAccount(page, { currentPassword, newPassword }) {
  await assertPortalPageLoaded(page, '/account/');
  await page.fill('#account-current-password', currentPassword);
  await page.fill('#account-new-password', newPassword);
  await page.fill('#account-confirm-password', newPassword);

  const [response] = await Promise.all([
    page.waitForResponse(item => item.url().includes('/api/auth/change-password') && item.request().method() === 'POST'),
    page.locator('#account-password-form button[type="submit"]').click()
  ]);

  assert.equal(response.status(), 200, 'account password change should succeed');
  await page.waitForFunction(() => {
    const feedback = document.getElementById('account-password-feedback');
    return Boolean(
      feedback &&
      !feedback.hasAttribute('hidden') &&
      String(feedback.textContent || '').includes('密码已更新')
    );
  });
}

async function logoutFromPortalPage(page, expectedPath = '/login/') {
  const [response] = await Promise.all([
    page.waitForResponse(item => item.url().includes('/api/auth/logout') && item.request().method() === 'POST'),
    page.click('#portal-logout-button')
  ]);

  assert.equal(response.status(), 200, 'portal logout should succeed');
  if (expectedPath === '/login/') {
    await assertAuthPage(page);
    await page.waitForTimeout(600);
    assert.equal(parsePageUrl(page).pathname, '/login/', 'portal logout should land on the login page after the session check');
    return;
  }

  await waitForPath(page, expectedPath);
}

async function assertAdminPage(page) {
  await assertPortalPageLoaded(page, '/admin/');
  await page.locator('#admin-create-user-form').waitFor({ state: 'visible' });
  await page.locator('#admin-reset-password-form').waitFor({ state: 'visible' });
  await page.locator('#admin-audit-form').waitFor({ state: 'visible' });
  await page.waitForFunction(() => {
    const summary = document.getElementById('admin-audit-summary');
    return Boolean(summary?.textContent) && !summary.textContent.includes('正在准备审计日志');
  });
  const summaryText = await page.locator('#admin-audit-summary').innerText();
  assert.ok(summaryText.includes('共'), 'admin audit summary should render a loaded state');
}

async function createManagedUser(page, { username, email, displayName, password }) {
  await page.fill('#admin-create-username', username);
  await page.fill('#admin-create-email', email);
  await page.fill('#admin-create-display-name', displayName);
  await page.fill('#admin-create-password', password);

  const [response] = await Promise.all([
    page.waitForResponse(item => item.url().endsWith('/api/admin/users') && item.request().method() === 'POST'),
    page.locator('#admin-create-user-form button[type="submit"]').click()
  ]);

  assert.equal(response.status(), 200, 'admin create-user request should succeed');
  const userCard = page.locator('#admin-user-list .history-item').filter({ hasText: username }).first();
  await userCard.waitFor({ state: 'visible' });
  return userCard;
}

async function issueInviteFromCard(page, userCard, expectedResponsePath) {
  const buttonLabel = expectedResponsePath.includes('invite-resend') ? '重发邀请' : '签发邀请';
  const [response] = await Promise.all([
    page.waitForResponse(item => item.url().includes(expectedResponsePath) && item.request().method() === 'POST'),
    userCard.getByRole('button', { name: buttonLabel }).click()
  ]);

  assert.equal(response.status(), 200, `${buttonLabel} request should succeed`);
  await page.locator('#admin-invite-feedback').waitFor({ state: 'visible' });
  const feedbackText = await page.locator('#admin-invite-feedback').innerText();
  const inviteUrl = extractFirstUrl(feedbackText);
  assert.ok(inviteUrl, 'admin invite feedback should include a local preview URL');
  return inviteUrl;
}

async function revokeInviteFromCard(page, userCard) {
  const [response] = await Promise.all([
    page.waitForResponse(item => item.url().includes('/invite-revoke') && item.request().method() === 'POST'),
    userCard.getByRole('button', { name: '撤销邀请' }).click()
  ]);

  assert.equal(response.status(), 200, 'invite revoke request should succeed');
  await page.locator('#admin-invite-feedback').waitFor({ state: 'visible' });
}

async function assertAuditFiltering(page, username) {
  await page.fill('#admin-audit-target', username);
  const [response] = await Promise.all([
    page.waitForResponse(item => item.url().includes('/api/admin/audit-logs') && item.request().method() === 'GET'),
    page.locator('#admin-audit-form button[type="submit"]').click()
  ]);

  assert.equal(response.status(), 200, 'admin audit filtering should succeed');
  await page.waitForFunction(targetUsername => {
    const tableBody = document.getElementById('admin-audit-table-body');
    return Boolean(tableBody && tableBody.textContent && tableBody.textContent.includes(targetUsername));
  }, username);
}

async function assertTokenPane(page, expectedUsername) {
  await waitForPath(page, '/auth/');
  await page.locator('#auth-pane-token').waitFor({ state: 'visible' });
  await page.locator('#token-form').waitFor({ state: 'visible' });
  const usernameText = await page.locator('#token-username').innerText();
  assert.ok(usernameText.includes(expectedUsername), `token page should render username ${expectedUsername}`);
}

async function completeTokenFlow(page, { responsePath, username, password }) {
  await assertTokenPane(page, username);
  await page.fill('#token-password', password);
  await page.fill('#token-confirm-password', password);

  const [response] = await Promise.all([
    page.waitForResponse(item => item.url().includes(responsePath) && item.request().method() === 'POST'),
    page.locator('#token-submit').click()
  ]);

  assert.equal(response.status(), 200, `token flow ${responsePath} should succeed`);
  await assertWorkspaceAuthenticated(page, username, { isAdmin: false });
}

async function requestForgotPasswordPreview(page, username) {
  const origin = new URL(page.url()).origin;
  await page.goto(`${origin}/auth/`, { waitUntil: 'domcontentloaded' });
  await page.locator('#forgot-form').waitFor({ state: 'visible' });
  await page.fill('#forgot-username', username);

  const [response] = await Promise.all([
    page.waitForResponse(item => item.url().includes('/api/auth/forgot-password') && item.request().method() === 'POST'),
    page.locator('#forgot-form button[type="submit"]').click()
  ]);

  assert.equal(response.status(), 200, 'forgot-password request should succeed');
  await page.locator('#forgot-preview').waitFor({ state: 'visible' });
  const href = await page.locator('#forgot-preview-link').getAttribute('href');
  assert.ok(href, 'forgot-password preview link should be present in local preview mode');
  return href;
}

async function assertInvalidInviteTokenState(page, baseUrl) {
  await page.goto(`${baseUrl}/auth/?invite=invalid-token`, { waitUntil: 'domcontentloaded' });
  await page.locator('#auth-pane-token').waitFor({ state: 'visible' });
  await page.waitForFunction(() => {
    const feedback = document.getElementById('token-feedback');
    return Boolean(
      feedback &&
      !feedback.hasAttribute('hidden') &&
      String(feedback.textContent || '').includes('无效或已失效')
    );
  });
}

async function runDesktopFlow(browser, baseUrl) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const page = await context.newPage();
  const uniqueSuffix = String(Date.now()).slice(-6);
  const inviteUsername = `flowuser${uniqueSuffix}`;
  const inviteEmail = `${inviteUsername}@example.com`;
  const inviteDisplayName = inviteUsername;
  const invitePassword = 'FlowInvite2026!';
  const accountPassword = 'FlowAccount2026!';
  const recoveredPassword = 'FlowRecovered2026!';

  try {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await assertAuthPage(page, { expectedNext: '/' });
    await assertAuthModeSwitching(page);
    await loginThroughAuthPage(page, {
      username: 'studio',
      password: 'AIGS2026!',
      expectedPath: '/'
    });

    await assertWorkspaceAuthenticated(page, 'studio', { isAdmin: true });
    await assertWorkspaceNavigation(page);
    await assertThemeToggleWorks(page);
    await assertWorkspaceResumePersistence(page, uniqueSuffix);

    await page.goto(`${baseUrl}/account/`, { waitUntil: 'domcontentloaded' });
    await assertAccountPage(page, {
      username: 'studio',
      roleLabel: '管理员',
      adminLinkVisible: true
    });

    await page.goto(`${baseUrl}/admin/`, { waitUntil: 'domcontentloaded' });
    await assertAdminPage(page);

    const userCard = await createManagedUser(page, {
      username: inviteUsername,
      email: inviteEmail,
      displayName: inviteDisplayName,
      password: 'FlowTemp2026!'
    });

    const firstInviteUrl = await issueInviteFromCard(page, userCard, '/invite');
    await page.waitForFunction(username => {
      const list = document.getElementById('admin-user-list');
      return Boolean(list && list.textContent?.includes(username) && list.textContent.includes('待激活'));
    }, inviteUsername);

    const resentInviteUrl = await issueInviteFromCard(page, userCard, '/invite-resend');
    assert.notStrictEqual(resentInviteUrl, firstInviteUrl, 'invite resend should produce a fresh preview URL');

    await revokeInviteFromCard(page, userCard);
    await page.waitForFunction(username => {
      const list = document.getElementById('admin-user-list');
      return Boolean(list && list.textContent?.includes(username) && list.textContent.includes('无待激活邀请'));
    }, inviteUsername);

    const freshInviteUrl = await issueInviteFromCard(page, userCard, '/invite');
    await assertAuditFiltering(page, inviteUsername);
    await logoutFromPortalPage(page);

    await page.goto(freshInviteUrl, { waitUntil: 'domcontentloaded' });
    await completeTokenFlow(page, {
      responsePath: '/api/auth/invitation/activate',
      username: inviteUsername,
      password: invitePassword
    });

    await page.goto(`${baseUrl}/admin/`, { waitUntil: 'domcontentloaded' });
    await waitForPath(page, '/account/');
    await assertAccountPage(page, {
      username: inviteUsername,
      roleLabel: '成员',
      adminLinkVisible: false
    });

    await changePasswordFromAccount(page, {
      currentPassword: invitePassword,
      newPassword: accountPassword
    });
    await logoutFromPortalPage(page);

    await loginThroughAuthPage(page, {
      username: inviteUsername,
      password: accountPassword,
      expectedPath: '/'
    });
    await assertWorkspaceAuthenticated(page, inviteUsername, { isAdmin: false });
    await logoutFromWorkspace(page);

    const forgotPath = await requestForgotPasswordPreview(page, inviteUsername);
    await page.goto(new URL(forgotPath, baseUrl).href, { waitUntil: 'domcontentloaded' });
    await completeTokenFlow(page, {
      responsePath: '/api/auth/password-reset/complete',
      username: inviteUsername,
      password: recoveredPassword
    });

    await logoutFromWorkspace(page);
    await assertInvalidInviteTokenState(page, baseUrl);
  } finally {
    await page.close();
    await context.close();
  }
}

async function runMobileFlow(browser, baseUrl) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true
  });
  const page = await context.newPage();

  try {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await assertAuthPage(page, { expectedNext: '/' });
    await loginThroughAuthPage(page, {
      username: 'studio',
      password: 'AIGS2026!',
      expectedPath: '/'
    });

    await assertWorkspaceAuthenticated(page, 'studio', { isAdmin: true });
    await page.locator('#sidebar-toggle').waitFor({ state: 'visible' });

    await page.click('#sidebar-toggle');
    await page.waitForFunction(() => {
      const sidebar = document.getElementById('sidebar');
      const overlay = document.getElementById('sidebar-overlay');
      const toggle = document.getElementById('sidebar-toggle');
      return Boolean(
        sidebar?.classList.contains('open') &&
        overlay?.classList.contains('show') &&
        toggle?.getAttribute('aria-expanded') === 'true'
      );
    });

    await page.locator('#sidebar-overlay').click();
    await page.waitForFunction(() => {
      const sidebar = document.getElementById('sidebar');
      const overlay = document.getElementById('sidebar-overlay');
      const toggle = document.getElementById('sidebar-toggle');
      return Boolean(
        sidebar && !sidebar.classList.contains('open') &&
        overlay && !overlay.classList.contains('show') &&
        toggle?.getAttribute('aria-expanded') === 'false'
      );
    });

    await page.click('#sidebar-toggle');
    await page.waitForFunction(() => document.getElementById('sidebar')?.classList.contains('open'));
    await page.locator('.nav-item[data-tab="lyrics"]').click();
    await page.waitForFunction(() => {
      const tab = document.getElementById('tab-lyrics');
      const nav = document.querySelector('.nav-item[data-tab="lyrics"]');
      const sidebar = document.getElementById('sidebar');
      const toggle = document.getElementById('sidebar-toggle');
      return Boolean(
        tab?.classList.contains('active') &&
        nav?.classList.contains('active') &&
        sidebar && !sidebar.classList.contains('open') &&
        toggle?.getAttribute('aria-expanded') === 'false'
      );
    });

    await logoutFromWorkspace(page);
  } finally {
    await page.close();
    await context.close();
  }
}

async function openBrowser({ headless = process.env.PLAYWRIGHT_HEADLESS !== '0', cdpUrl = '' } = {}) {
  if (cdpUrl) {
    return chromium.connectOverCDP(cdpUrl);
  }
  return chromium.launch({ headless });
}

async function runUiFlow({ baseUrl, headless = process.env.PLAYWRIGHT_HEADLESS !== '0', cdpUrl = '' }) {
  const browser = await openBrowser({ headless, cdpUrl });
  try {
    await runDesktopFlow(browser, baseUrl);
    await runMobileFlow(browser, baseUrl);
  } finally {
    await browser.close();
  }
}

async function main(options = {}) {
  const args = options.argv ? parseArgs(options.argv) : { ...parseArgs([]), ...options };
  const baseUrl = options.baseUrl || args.baseUrl;
  const port = Number(options.port || args.port || 18791);
  const launchServer = options.launchServer != null ? options.launchServer : args.launchServer;
  const cdpUrl = options.cdpUrl || args.cdpUrl || '';

  if (launchServer) {
    await withListeningServer({ port }, async serverBaseUrl => {
      await waitForServer(serverBaseUrl);
      await runUiFlow({ baseUrl: serverBaseUrl, cdpUrl });
    });
  } else {
    await waitForServer(baseUrl);
    await runUiFlow({ baseUrl, cdpUrl });
  }

  console.log('UI flow smoke tests passed');
}

if (require.main === module) {
  main({ argv: process.argv.slice(2) }).catch(error => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = {
  main
};
