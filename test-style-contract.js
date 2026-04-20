const fs = require('fs');
const path = require('path');
const assert = require('assert');

function getBlock(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`(^|\\n)${escaped}\\s*\\{([\\s\\S]*?)\\}`, 'm'));
  return match ? match[2] : '';
}

function main() {
  const css = fs.readFileSync(path.join(__dirname, 'public', 'css', 'style.css'), 'utf8');

  assert.ok(css.includes('.card {'), 'style contract should define the shared .card base');
  assert.ok(css.includes('[data-theme="light"] .card {'), 'style contract should define a light-theme .card surface');
  assert.ok(css.includes('.theme-toggle-fixed {'), 'style contract should define the top-right utility cluster container');
  assert.ok(css.includes('.topbar-account-action {'), 'style contract should define the utility logout action');
  assert.ok(css.includes('.topbar-login-button {'), 'style contract should define the top-right login action');

  const cardBlock = getBlock(css, '.card');
  assert.ok(cardBlock.includes('border-radius: var(--radius-xl);'), 'shared .card should keep the standard radius contract');
  assert.ok(cardBlock.includes('padding: 32px;'), 'shared .card should keep the standard desktop padding contract');
  assert.ok(cardBlock.includes('box-shadow: var(--shadow-md);'), 'shared .card should keep the standard shadow contract');

  const chatCardBlock = getBlock(css, '.chat-card');
  assert.ok(chatCardBlock, 'style contract should define .chat-card');
  assert.ok(!/background\s*:/.test(chatCardBlock), '.chat-card should not replace the shared card background');
  assert.ok(!/border-radius\s*:/.test(chatCardBlock), '.chat-card should not replace the shared card radius');
  assert.ok(!/box-shadow\s*:/.test(chatCardBlock), '.chat-card should not replace the shared card shadow');
  assert.ok(!/padding\s*:/.test(chatCardBlock), '.chat-card should not replace the shared card padding');

  const utilityActionBlock = getBlock(css, '.topbar-account-action');
  const sharedTopbarActionBlockMatch = css.match(/(^|\n)\.topbar-account-action,\s*\n\.topbar-login-button\s*\{([\s\S]*?)\}/m);
  const sharedTopbarActionBlock = sharedTopbarActionBlockMatch ? sharedTopbarActionBlockMatch[2] : '';
  assert.ok(/background\s*:/.test(utilityActionBlock), 'topbar utility action should keep an explicit restrained background');
  assert.ok(/border\s*:/.test(utilityActionBlock), 'topbar utility action should keep an explicit border');
  assert.ok(/border-radius\s*:\s*(999px|var\(--utility-shell-radius\));/.test(sharedTopbarActionBlock), 'topbar utility action should keep pill rounding');

  console.log('Style contract tests passed');
}

if (require.main === module) {
  main();
}

module.exports = {
  main
};
