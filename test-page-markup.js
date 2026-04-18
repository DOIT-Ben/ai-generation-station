const fs = require('fs');
const path = require('path');
const assert = require('assert');

function main() {
  const html = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');

  assert.ok(html.includes('/js/app-shell.js'), 'index should load app-shell.js before app.js');
  assert.ok(html.includes('id="user-panel"'), 'index should contain user panel placeholder');
  assert.ok(html.includes('id="chat-queue-indicator"'), 'index should contain chat queue indicator');
  assert.ok(html.includes('id="covervoice-result"'), 'voice result id should be aligned with app logic');

  console.log('✅ Page markup tests passed');
}

if (require.main === module) {
  main();
}

module.exports = {
  main
};
