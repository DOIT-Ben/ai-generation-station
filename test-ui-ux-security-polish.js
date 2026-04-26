const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { createConfig } = require('./server/config');
const { readProjectCss, CSS_MODULES } = require('./test-css-utils');

const root = __dirname;
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

function assertIncludes(haystack, needle, message) {
  assert.ok(haystack.includes(needle), message || `Expected content to include: ${needle}`);
}

function main() {
  const css = readProjectCss(root);
  const authJs = read('public/js/auth-page.js');
  const appJs = read('public/js/app.js');
  const siteShellJs = read('public/js/site-shell.js');
  const adminHtml = read('public/admin/index.html');
  const indexHtml = read('public/index.html');
  const loginHtml = read('public/login/index.html');
  const registerHtml = read('public/register/index.html');
  const envExample = read('.env.example');

  for (const cssFile of CSS_MODULES) {
    assertIncludes(indexHtml, `/css/${cssFile}`, `workspace should load modular stylesheet ${cssFile}`);
    assertIncludes(loginHtml, `/css/${cssFile}`, `login page should load modular stylesheet ${cssFile}`);
    assertIncludes(registerHtml, `/css/${cssFile}`, `register page should load modular stylesheet ${cssFile}`);
  }

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

  assertIncludes(css, '.sidebar {\n  width: 272px;', 'desktop sidebar should have enough room for the two-line logo lockup');
  assertIncludes(css, 'margin-left: 272px;', 'main content should align with the wider desktop sidebar');
  assertIncludes(indexHtml, 'class="logo-ai-mark"', 'sidebar logo should use a large AI text mark');
  assertIncludes(indexHtml, 'logo-text-line logo-text-line--primary', 'logo text should use a primary row');
  assertIncludes(indexHtml, 'logo-text-line logo-text-line--station', 'logo text should use a station row');
  assertIncludes(indexHtml, '>AI</strong>', 'logo text mark should keep AI text');
  assertIncludes(indexHtml, '>Generation</span>', 'logo primary row should keep Generation text');
  assertIncludes(indexHtml, '>STATION</em>', 'logo station row should keep STATION text');
  assertIncludes(css, 'max-width: 160px;', 'logo text should match the compact two-line lockup');
  assertIncludes(css, '.logo-ai-mark', 'logo text mark should have dedicated styling');
  assertIncludes(css, '.logo-text-line--primary', 'logo text should style the AI Generation row');
  assertIncludes(css, 'font-stretch: normal;', 'logo text should not be visually compressed');
  assertIncludes(css, '.logo-text span', 'logo subtitle styling should exist');
  assertIncludes(css, 'white-space: nowrap;', 'logo text should avoid awkward wrapping');

  assertIncludes(loginHtml, 'auth-simple-page auth-simple-page--login', 'login page should use the pure auth form layout');
  assertIncludes(registerHtml, 'auth-simple-page auth-simple-page--register', 'register page should use the pure auth form layout');
  assertIncludes(css, '.auth-simple-shell', 'pure auth pages should have a dedicated centered shell');
  assertIncludes(css, '.auth-simple-card', 'pure auth pages should use one focused form card');
  assert.ok(!loginHtml.includes('auth-v2-brand-panel'), 'login page should not render unrelated brand panels');
  assert.ok(!registerHtml.includes('auth-v2-brand-panel'), 'register page should not render unrelated brand panels');
  assert.ok(!css.includes('.auth-v2-brand-panel'), 'auth CSS should not keep the removed brand panel selector');

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

