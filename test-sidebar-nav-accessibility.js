const assert = require('assert');
const fs = require('fs');
const path = require('path');

function main() {
  const html = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
  const appJs = fs.readFileSync(path.join(__dirname, 'public', 'js', 'app.js'), 'utf8');

  const navMatch = html.match(/<nav class="nav-list"[\s\S]*?<\/nav>/);
  assert.ok(navMatch, 'sidebar nav should exist');
  const navHtml = navMatch[0];

  assert.equal(navHtml.includes('role="menubar"'), false, 'sidebar nav should not use menubar semantics');
  assert.equal(navHtml.includes('role="menuitem"'), false, 'sidebar nav items should not use menuitem semantics');
  assert.equal(navHtml.includes('tabindex="-1"'), false, 'sidebar nav should not hide inactive buttons from tab order');
  assert.ok(navHtml.includes('aria-label="工作台功能"'), 'sidebar nav should expose a plain navigation label');
  assert.ok(navHtml.includes('aria-current="page"'), 'initial active nav item should expose aria-current');

  assert.ok(appJs.includes("item.setAttribute('aria-current', 'page')"), 'tab switching should set aria-current on the active nav item');
  assert.ok(appJs.includes("item.removeAttribute('aria-current')"), 'tab switching should remove aria-current from inactive nav items');

  console.log('Sidebar nav accessibility tests passed');
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = {
  main
};
