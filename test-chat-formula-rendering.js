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
  const appJs = fs.readFileSync(path.join(__dirname, 'public', 'js', 'app.js'), 'utf8');
  const markdownJs = fs.readFileSync(path.join(__dirname, 'public', 'js', 'chat-markdown.js'), 'utf8');
  const css = readProjectCss(__dirname);

  assert.ok(appJs.includes('protectChatFormulaSegments'), 'chat renderer should protect formula segments before inline markdown');
  assert.ok(appJs.includes('restoreChatFormulaSegments'), 'chat renderer should restore formula segments after inline markdown');
  assert.ok(markdownJs.includes('chat-formula-inline'), 'chat markdown module should emit inline formula markup');
  assert.ok(markdownJs.includes('chat-formula-block'), 'chat markdown module should emit block formula markup');
  assert.ok(markdownJs.includes('\\\\(') && markdownJs.includes('\\\\['), 'chat markdown module should support \\(...\\) and \\[...\\] delimiters');
  assert.ok(markdownJs.includes('createTools'), 'chat markdown logic should live in a dedicated tool factory');

  assert.ok(css.includes('.chat-formula-inline,\n.chat-formula-block'), 'formula styles should share base typography');
  assert.ok(css.includes('font-family: var(--font-mono);'), 'formula should use mono-style typography');
  assert.ok(css.includes('white-space: nowrap;'), 'inline formula should stay complete on one line');
  assert.ok(css.includes('overflow-x: auto;'), 'block formula should scroll horizontally instead of clipping');
  assert.ok(css.includes('white-space: pre;'), 'block formula should preserve formula spacing');

  console.log('Chat formula rendering tests passed');
}

if (require.main === module) {
  main();
}

module.exports = { main };

