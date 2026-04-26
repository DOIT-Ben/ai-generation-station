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
  const lightTimeBlock = getBlock(css, '[data-theme="light"] .message-meta-time');
  const lightUserTimeBlock = getBlock(css, '[data-theme="light"] .chat-message.user .message-meta-time,\n[data-theme="light"] .chat-message.user .message-meta-pill.tone-role');
  const paperTimeBlock = getBlock(css, '[data-theme="paper"] .message-meta-time');
  const paperUserTimeBlock = getBlock(css, '[data-theme="paper"] .chat-message.user .message-meta-time,\n[data-theme="paper"] .chat-message.user .message-meta-pill.tone-role');
  const scrollBlock = getBlock(css, '.chat-scroll-to-latest');
  const mobileBlock = css.match(/@media \(max-width: 767px\) \{([\s\S]*?)\n\}/m)?.[1] || '';

  assert.ok(lightTimeBlock.includes('color: rgba(24, 32, 51, 0.68);'), 'light theme message time should be darker for readability');
  assert.ok(lightUserTimeBlock.includes('color: rgba(24, 32, 51, 0.78);'), 'light theme user message time should use strong dark text');
  assert.ok(paperTimeBlock.includes('color: rgba(60, 47, 29, 0.7);'), 'paper theme message time should use deeper ink contrast');
  assert.ok(paperUserTimeBlock.includes('color: rgba(60, 47, 29, 0.82);'), 'paper theme user message time should use strong ink contrast');
  assert.ok(scrollBlock.includes('bottom: calc(154px + var(--chat-mobile-keyboard-offset));'), 'scroll-to-latest button should sit higher above the composer on desktop');
  assert.ok(mobileBlock.includes('bottom: calc(142px + var(--chat-mobile-keyboard-offset));'), 'scroll-to-latest button should sit higher above the composer on mobile');

  console.log('Chat time and scroll contrast tests passed');
}

if (require.main === module) {
  main();
}

module.exports = {
  main
};

