const fs = require('fs');
const path = require('path');
const assert = require('assert');

function main() {
  const html = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
  const authHtml = fs.readFileSync(path.join(__dirname, 'public', 'auth', 'index.html'), 'utf8');
  const accountHtml = fs.readFileSync(path.join(__dirname, 'public', 'account', 'index.html'), 'utf8');
  const adminHtml = fs.readFileSync(path.join(__dirname, 'public', 'admin', 'index.html'), 'utf8');
  const appJs = fs.readFileSync(path.join(__dirname, 'public', 'js', 'app.js'), 'utf8');
  const authPageJs = fs.readFileSync(path.join(__dirname, 'public', 'js', 'auth-page.js'), 'utf8');
  const accountPageJs = fs.readFileSync(path.join(__dirname, 'public', 'js', 'account-page.js'), 'utf8');
  const adminPageJs = fs.readFileSync(path.join(__dirname, 'public', 'js', 'admin-page.js'), 'utf8');

  assert.ok(html.includes('/js/app-shell.js'), 'index should load app-shell.js before app.js');
  assert.ok(html.includes('name="aigs-api-base-url"'), 'index should expose the optional API base-url meta tag');
  assert.ok(html.includes('id="user-panel"'), 'index should contain user panel placeholder');
  assert.ok(!html.includes('id="account-panel"'), 'index should no longer contain the account panel');
  assert.ok(!html.includes('id="admin-panel"'), 'index should no longer contain the admin panel');
  assert.ok(html.includes('id="chat-queue-indicator"'), 'index should contain chat queue indicator');
  assert.ok(html.includes('id="chat-conversation-list"'), 'index should contain chat conversation list');
  assert.ok(html.includes('id="chat-conversation-search"'), 'index should contain conversation search input');
  assert.ok(html.includes('id="chat-archived-section"'), 'index should contain archived conversation section');
  assert.ok(html.includes('id="chat-archived-list"'), 'index should contain archived conversation list');
  assert.ok(html.includes('id="chat-conversation-title"'), 'index should contain active conversation title');
  assert.ok(html.includes('id="workspace-resume-card"'), 'index should contain the workspace resume card');
  assert.ok(html.includes('id="workspace-clear-draft"'), 'index should contain the workspace clear-draft action');
  assert.ok(html.includes('id="chat-scroll-to-latest"'), 'index should contain the chat scroll-to-latest action');
  assert.ok(html.includes('id="chat-request-status"'), 'index should contain chat request status feedback');
  assert.ok(html.includes('id="btn-chat-stop"'), 'index should contain chat stop-generation action');
  assert.ok(html.includes('id="btn-chat-new-conversation"'), 'index should contain new conversation button');
  assert.ok(html.includes('id="btn-chat-rename-conversation"'), 'index should contain rename conversation button');
  assert.ok(html.includes('id="btn-chat-archive-conversation"'), 'index should contain archive conversation button');
  assert.ok(html.includes('id="covervoice-result"'), 'voice result id should be aligned with app logic');
  assert.ok(html.includes('会话列表'), 'chat conversation sidebar title should be localized to Chinese');
  assert.ok(html.includes('继续上次工作'), 'workspace should surface the personal resume card copy');
  assert.ok(html.indexOf('id="workspace-resume-card"') > html.indexOf('id="tab-chat"'), 'workspace resume strip should render near the bottom of the main content');
  assert.ok(html.includes('新建对话'), 'chat new conversation button should be localized to Chinese');
  assert.ok(html.includes('搜索会话'), 'conversation search should be localized to Chinese');
  assert.ok(html.includes('已归档'), 'archived conversation section should be localized to Chinese');
  assert.ok(html.includes('暂无进行中的对话'), 'empty active conversation title should be localized to Chinese');
  assert.ok(html.includes('重命名'), 'rename conversation button should be localized to Chinese');
  assert.ok(html.includes('归档'), 'archive conversation button should be localized to Chinese');
  assert.ok(authHtml.includes('/js/auth-page.js'), 'auth page should load the auth page controller');
  assert.ok(authHtml.includes('name="aigs-api-base-url"'), 'auth page should expose the optional API base-url meta tag');
  assert.ok(authHtml.includes('data-auth-mode="login"'), 'auth page should expose the login tab');
  assert.ok(authHtml.includes('data-auth-mode="register"'), 'auth page should expose the register tab');
  assert.ok(authHtml.includes('data-auth-mode="forgot"'), 'auth page should expose the forgot-password tab');
  assert.ok(authHtml.includes('id="token-form"'), 'auth page should expose token-based activation/reset form');
  assert.ok(accountHtml.includes('/js/account-page.js'), 'account page should load the account page controller');
  assert.ok(accountHtml.includes('name="aigs-api-base-url"'), 'account page should expose the optional API base-url meta tag');
  assert.ok(accountHtml.includes('class="account-dashboard"'), 'account page should expose the account dashboard layout');
  assert.ok(accountHtml.includes('id="account-password-form"'), 'account page should contain the account password form');
  assert.ok(accountHtml.includes('id="account-password-status-heading"'), 'account page should expose the security status summary');
  assert.ok(accountHtml.includes('id="account-admin-link"'), 'account page should expose the admin shortcut link placeholder');
  assert.ok(adminHtml.includes('/js/admin-page.js'), 'admin page should load the admin page controller');
  assert.ok(adminHtml.includes('name="aigs-api-base-url"'), 'admin page should expose the optional API base-url meta tag');
  assert.ok(adminHtml.includes('id="admin-create-user-form"'), 'admin page should contain admin create-user form');
  assert.ok(adminHtml.includes('id="admin-reset-password-form"'), 'admin page should contain admin reset-password form');
  assert.ok(adminHtml.includes('id="admin-invite-feedback"'), 'admin page should contain admin invitation feedback area');
  assert.ok(adminHtml.includes('id="admin-audit-form"'), 'admin page should contain admin audit filter form');
  assert.ok(adminHtml.includes('value="user_public_register"'), 'admin audit filters should expose the public-registration action');
  assert.ok(appJs.includes('会话已归档'), 'conversation archive success toast should be localized to Chinese');
  assert.ok(appJs.includes('确认归档“${getConversationTitlePreview(activeConversation)}”吗？'), 'conversation archive confirmation should be localized to Chinese');
  assert.ok(appJs.includes('请等待当前回复完成后再切换会话。'), 'conversation switch guard should be localized to Chinese');
  assert.ok(appJs.includes('已归档会话已删除'), 'archived conversation delete success toast should be localized to Chinese');
  assert.ok(html.includes('class="message-body"'), 'chat welcome message should use structured message-body markup');
  assert.ok(appJs.includes('正在思考'), 'workspace should surface a visible thinking state before chat replies stream in');
  assert.ok(appJs.includes('formatChatMessageHtml'), 'workspace should format chat replies with structured rich text rendering');
  assert.ok(appJs.includes('conversation_state'), 'workspace should handle streamed conversation state events');
  assert.ok(appJs.includes('rewriteAssistantMessage'), 'workspace should expose assistant rewrite actions');
  assert.ok(appJs.includes('copyAssistantMessage'), 'workspace should expose assistant copy actions');
  assert.ok(appJs.includes('retryTransientAssistantMessage'), 'workspace should expose retry actions for failed assistant replies');
  assert.ok(appJs.includes('stopChatGeneration'), 'workspace should expose stop-generation behavior');
  assert.ok(appJs.includes('groupConversationsByDay'), 'workspace should group conversation list items by relative day');
  assert.ok(authPageJs.includes('注册成功，正在进入工作台'), 'auth page should contain a register success flow');
  assert.ok(authPageJs.includes('账号激活成功'), 'auth page should contain an invite-activation success flow');
  assert.ok(accountPageJs.includes('密码已更新，当前会话已保留。'), 'account page should surface password update success feedback');
  assert.ok(adminPageJs.includes('已撤销'), 'admin page should support invitation revocation copy');
  assert.ok(adminHtml.includes('审计日志'), 'admin page should expose localized audit log copy');
  assert.ok(appJs.includes('登录状态已失效，请重新登录'), 'session expiry copy should be localized to Chinese');
  assert.ok(appJs.includes('/auth/'), 'workspace should redirect unauthenticated users to the auth page');
  assert.ok(appJs.includes('/account/'), 'workspace should link authenticated users to the account page');
  assert.ok(appJs.includes('/admin/'), 'workspace should link admin users to the admin page');

  console.log('✅ Page markup tests passed');
}

if (require.main === module) {
  main();
}

module.exports = {
  main
};
