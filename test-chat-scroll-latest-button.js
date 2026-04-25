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
  const baseBlock = getBlock(css, '.chat-scroll-to-latest');
  const attentionBlock = getBlock(css, '.chat-scroll-to-latest[data-state="attention"]');
  const lightBlock = getBlock(css, '[data-theme="light"] .chat-scroll-to-latest');
  const lightAttentionBlock = getBlock(css, '[data-theme="light"] .chat-scroll-to-latest[data-state="attention"]');
  const paperBlock = getBlock(css, '[data-theme="paper"] .chat-scroll-to-latest');
  const paperAttentionBlock = getBlock(css, '[data-theme="paper"] .chat-scroll-to-latest[data-state="attention"]');
  const iconBlock = getBlock(css, '.chat-scroll-to-latest-icon');
  const mobileBlock = css.match(/@media \(max-width: 767px\) \{([\s\S]*?)\n\}/m)?.[1] || '';
  const html = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
  const appJs = fs.readFileSync(path.join(__dirname, 'public', 'js', 'app.js'), 'utf8');

  assert.ok(baseBlock.includes('display: inline-flex;'), 'chat scroll-to-latest button should center content with inline-flex');
  assert.ok(baseBlock.includes('gap: 8px;'), 'chat scroll-to-latest button should space the icon and label clearly');
  assert.ok(baseBlock.includes('min-width: 152px;'), 'chat scroll-to-latest button should keep enough width for the icon and Chinese label');
  assert.ok(baseBlock.includes('background: rgba(8, 13, 27, 0.88);'), 'idle scroll-to-latest button should keep a calmer base surface');
  assert.ok(baseBlock.includes('white-space: normal;'), 'chat scroll-to-latest button should allow multi-line wrapping to avoid clipping');
  assert.ok(baseBlock.includes('text-align: center;'), 'chat scroll-to-latest button should center wrapped text');
  assert.ok(baseBlock.includes('opacity: 0;'), 'chat scroll-to-latest button should start visually hidden for smooth transitions');
  assert.ok(baseBlock.includes('pointer-events: none;'), 'chat scroll-to-latest button should ignore clicks while hidden');
  assert.ok(baseBlock.includes('bottom: calc(154px + var(--chat-mobile-keyboard-offset));'), 'chat scroll-to-latest button should sit a bit higher above the composer on desktop');
  assert.ok(baseBlock.includes('max-width: min(236px, calc(100% - 48px));'), 'chat scroll-to-latest button should stay inside the chat viewport');
  assert.ok(attentionBlock.includes('background: rgba(8, 13, 27, 0.96);'), 'attention scroll-to-latest button should become more prominent when new replies arrive');
  assert.ok(css.includes('.chat-scroll-to-latest[data-visible="true"] {'), 'chat scroll-to-latest button should expose an explicit visible state for smooth transitions');
  assert.ok(iconBlock.includes('width: 22px;'), 'chat scroll-to-latest icon should keep a stable circular affordance');
  assert.ok(lightBlock.includes('color: #15368d;'), 'light theme scroll-to-latest button should keep stronger readable contrast');
  assert.ok(lightAttentionBlock.includes('background: rgba(255, 255, 255, 1);'), 'light theme attention state should lift visual priority');
  assert.ok(paperBlock.includes('color: #5d4310;'), 'paper theme scroll-to-latest button should keep stronger readable contrast');
  assert.ok(paperAttentionBlock.includes('box-shadow: 0 18px 28px rgba(94, 71, 29, 0.16);'), 'paper theme attention state should lift visual priority');
  assert.ok(mobileBlock.includes('bottom: calc(142px + var(--chat-mobile-keyboard-offset));'), 'mobile scroll-to-latest button should sit a bit higher above the composer');
  assert.ok(mobileBlock.includes('max-width: min(204px, calc(100% - 28px));'), 'mobile scroll-to-latest button should keep a bounded width without clipping');
  assert.ok(html.includes('class="chat-scroll-to-latest-icon"'), 'scroll-to-latest button should render an explicit icon node');
  assert.ok(html.includes('data-visible="false"'), 'scroll-to-latest button should declare its initial hidden-visible state');
  assert.ok(html.includes('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"'), 'scroll-to-latest button should render a vector arrow icon instead of plain text');
  assert.ok(iconBlock.includes('border-radius: 999px;'), 'scroll-to-latest icon should stay inside a circular affordance');
  assert.ok(css.includes('.chat-scroll-to-latest-icon svg {'), 'scroll-to-latest button should define explicit svg sizing for the icon');
  assert.ok(appJs.includes("const label = button?.querySelector('.chat-scroll-to-latest-label');"), 'scroll-to-latest button logic should update the label node without dropping the icon');
  assert.ok(appJs.includes("button.dataset.state = isAttentionState ? 'attention' : 'idle';"), 'scroll-to-latest button should toggle explicit idle and attention states');
  assert.ok(appJs.includes("button.dataset.visible = 'true';"), 'scroll-to-latest button logic should show the mounted button through a visible state flag');
  assert.ok(appJs.includes("button.dataset.visible = 'false';"), 'scroll-to-latest button logic should hide the mounted button through a visible state flag');

  console.log('Chat scroll latest button tests passed');
}

if (require.main === module) {
  main();
}

module.exports = {
  main
};
