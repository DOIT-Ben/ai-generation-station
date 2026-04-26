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
  const appJs = fs.readFileSync(path.join(__dirname, 'public', 'js', 'app.js'), 'utf8');

  const paperTextareaBlock = getBlock(css, '[data-theme="paper"] .chat-input-row textarea');
  const paperPlaceholderBlock = getBlock(css, '[data-theme="paper"] .chat-input-row textarea::placeholder');
  const paperLoadingOptionBlock = getBlock(css, '[data-theme="paper"] .dropdown-option-loading');
  const chatInputTextareaBlock = getBlock(css, '.chat-input-row textarea');

  assert.ok(paperTextareaBlock.includes('background: transparent;'), 'paper theme chat input textarea should stay transparent in idle state');
  assert.ok(paperTextareaBlock.includes('border-color: transparent;'), 'paper theme chat input textarea should not show an inner idle border');
  assert.ok(paperTextareaBlock.includes('color: #3c2f1d;'), 'paper theme chat input text should use the warm readable foreground');
  assert.ok(paperTextareaBlock.includes('caret-color: #8c6a2d;'), 'paper theme chat input caret should match the warm paper accent');
  assert.ok(paperPlaceholderBlock.includes('color: rgba(107, 90, 61, 0.72);'), 'paper theme chat input placeholder should keep softer readable contrast');
  assert.ok(paperLoadingOptionBlock.includes('background: rgba(199, 153, 71, 0.06);'), 'paper theme loading option should inherit the paper dropdown tone');
  assert.ok(chatInputTextareaBlock.includes('transition: background 0.18s ease;'), 'chat input text should no longer animate color during theme switching');
  assert.ok(appJs.includes("const CHAT_MODEL_OPTIONS_CACHE_KEY = 'aigs.chat.model-options';"), 'chat model dropdown should define a dedicated local cache key');
  assert.ok(appJs.includes('function readCachedChatModelOptions()'), 'chat model dropdown should expose a cache read helper');
  assert.ok(appJs.includes('function writeCachedChatModelOptions(models = [])'), 'chat model dropdown should expose a cache write helper');
  assert.ok(appJs.includes('window.localStorage.setItem(CHAT_MODEL_OPTIONS_CACHE_KEY'), 'chat model dropdown should persist successful model lists locally');
  assert.ok(appJs.includes('const cached = readCachedChatModelOptions();'), 'chat model dropdown should consult cache during initialization');
  assert.ok(appJs.includes('function initializeChatModelDropdownLoadingState()'), 'chat model dropdown should expose a dedicated loading-state initializer');
  assert.ok(appJs.includes('正在加载模型列表...'), 'chat model dropdown should show a visible loading option while async models load');
  assert.ok(appJs.includes("initializeChatModelDropdownLoadingState();"), 'chat init should seed dropdown content before async loading');

  console.log('Chat input paper theme and dropdown init tests passed');
}

if (require.main === module) {
  main();
}

module.exports = {
  main
};

