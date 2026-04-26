const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { createConfig } = require('./server/config');

const root = __dirname;
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

function assertIncludes(haystack, needle, message) {
  assert.ok(haystack.includes(needle), message || `Expected content to include: ${needle}`);
}

function main() {
  const css = read('public/css/style.css');
  const authJs = read('public/js/auth-page.js');
  const appJs = read('public/js/app.js');
  const siteShellJs = read('public/js/site-shell.js');
  const adminHtml = read('public/admin/index.html');
  const indexHtml = read('public/index.html');
  const envExample = read('.env.example');

  assertIncludes(css, '.drop-zone {\n  display: grid;', 'drop zone should use stable grid alignment');
  assertIncludes(css, 'grid-template-columns: 24px minmax(0, 1fr) auto;', 'drop zone should reserve icon, hint, and format columns');
  assertIncludes(css, '.drop-link {\n  color: var(--accent-cyan);', 'drop upload link should keep explicit styling');
  assertIncludes(css, 'line-height: inherit;', 'drop upload link should inherit hint line height');

  assertIncludes(siteShellJs, 'const PENDING_WELCOME_TOAST_KEY =', 'site shell should define a pending welcome toast key');
  assertIncludes(siteShellJs, 'function queueWelcomeToast', 'site shell should queue welcome toast before redirect');
  assertIncludes(siteShellJs, 'function consumeQueuedWelcomeToast', 'site shell should consume welcome toast after landing');
  assert.ok(!authJs.includes('await SiteShell.showWelcomeToast'), 'auth page should not wait for welcome toast before redirect');
  assertIncludes(authJs, 'SiteShell.queueWelcomeToast?.({', 'auth page should queue the welcome toast');
  assertIncludes(appJs, 'consumeQueuedWelcomeToast', 'workspace should consume queued welcome toast');
  assertIncludes(indexHtml, '/js/site-shell.js', 'workspace should load site shell before consuming queued welcome toast');

  assertIncludes(css, '.logo-icon {\n  width: 42px;', 'logo icon should be enlarged by about 10 percent');
  assertIncludes(css, 'max-width: 156px;', 'logo text should have enough width');
  assertIncludes(css, 'font-stretch: normal;', 'logo text should not be visually compressed');
  assertIncludes(css, '.logo-text span', 'logo subtitle styling should exist');
  assertIncludes(css, 'white-space: nowrap;', 'logo text should avoid awkward wrapping');

  assertIncludes(adminHtml, 'admin-portal-layout', 'admin page should use the wider admin layout');
  assertIncludes(adminHtml, 'admin-data-grid', 'admin page should separate heavy data sections');
  assertIncludes(adminHtml, 'admin-users-card', 'admin users section should have dedicated layout class');
  assertIncludes(adminHtml, 'admin-audit-card', 'admin audit section should have dedicated layout class');
  assertIncludes(css, '.admin-portal-layout {\n  width: min(1500px, 100%);', 'admin layout should use a wider container');
  assertIncludes(css, '.admin-data-grid {\n  grid-template-columns: 1fr;', 'admin data sections should not be squeezed side by side');
  assertIncludes(css, '.admin-audit-card .audit-log-table {\n  min-width: 1080px;', 'audit table should preserve readable column width');
  assertIncludes(css, '.admin-bulk-actions .btn', 'admin bulk buttons should have dedicated density rules');

  assert.strictEqual(createConfig({ env: { PORT: '18888', APP_STATE_DB: path.join(root, 'data', 'test-polish.sqlite') } }).BIND_HOST, '127.0.0.1');
  assertIncludes(envExample, 'BIND_HOST=127.0.0.1', 'env example should document safe bind host');

  console.log('UI/UX and port security polish tests passed');
}

if (require.main === module) {
  main();
}

module.exports = {
  main
};
