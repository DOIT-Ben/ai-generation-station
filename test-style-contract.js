const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { readProjectCss } = require('./test-css-utils');

function getBlock(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`(^|\\n)${escaped}\\s*\\{([\\s\\S]*?)\\}`, 'm'));
  return match ? match[2] : '';
}

function main() {
  const css = readProjectCss(__dirname);

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
  assert.ok(chatCardBlock.includes('padding: 0;'), '.chat-card should delegate spacing to the dedicated chat layout');
  assert.ok(getBlock(css, '.chat-messages').includes('padding: 24px clamp(16px, 4vw, 44px) 28px;'), 'chat message area should keep its own responsive spacing');
  assert.ok(css.includes('.chat-composer-count {'), 'chat composer should expose a visible draft character counter');
  assert.ok(css.includes('#chat-draft-count[data-state="near-limit"]'), 'chat composer should style near-limit draft counts');
  assert.ok(css.includes('.chat-input-area:focus-within {'), 'chat composer should expose a clear focused input area state');
  assert.ok(getBlock(css, '.progress-fill').includes('width: 0;'), 'progress fill should keep its initial width in CSS instead of inline HTML');

  const utilityActionBlock = getBlock(css, '.topbar-account-action');
  const sharedTopbarActionBlockMatch = css.match(/(^|\n)\.topbar-account-action,\s*\n\.topbar-login-button\s*\{([\s\S]*?)\}/m);
  const sharedTopbarActionBlock = sharedTopbarActionBlockMatch ? sharedTopbarActionBlockMatch[2] : '';
  const dropdownMenuBlock = getBlock(css, '.custom-dropdown .dropdown-menu');
  const dropdownHintBlock = getBlock(css, '.dropdown-scroll-hint');
  assert.ok(/background\s*:/.test(utilityActionBlock), 'topbar utility action should keep an explicit restrained background');
  assert.ok(/border\s*:/.test(utilityActionBlock), 'topbar utility action should keep an explicit border');
  assert.ok(/border-radius\s*:\s*(12px|999px|var\(--utility-shell-radius\));/.test(sharedTopbarActionBlock), 'topbar utility action should keep compact rounded action geometry');
  assert.ok(css.includes('max-height: min(400px, calc(100vh - 160px));'), 'chat dropdown should expose the taller height contract');
  assert.ok(css.includes('scrollbar-width: thin;'), 'chat dropdown should expose a visible scrollbar contract');
  assert.ok(dropdownHintBlock.includes('position: sticky;'), 'chat dropdown should expose a sticky scroll hint contract');

  console.log('Style contract tests passed');
}

if (require.main === module) {
  main();
}

module.exports = {
  main
};

