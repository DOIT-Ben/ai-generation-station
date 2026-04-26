const assert = require('assert');
const { readProjectCss } = require('./test-css-utils');
const fs = require('fs');
const path = require('path');
const chatModelUtils = require('./public/js/chat-model-utils.js');

function main() {
  const appJs = fs.readFileSync(path.join(__dirname, 'public', 'js', 'app.js'), 'utf8');
  const modelUtilsJs = fs.readFileSync(path.join(__dirname, 'public', 'js', 'chat-model-utils.js'), 'utf8');
  const css = readProjectCss(__dirname);
  assert.strictEqual(chatModelUtils.getChatModelSeriesLabel('gpt-5.4'), 'GPT-5.x', 'gpt-5 models should expose a GPT-5.x series badge');
  assert.strictEqual(chatModelUtils.getChatModelSeriesLabel('gpt-4.1-mini'), 'GPT-4.1', 'gpt-4.1 models should expose a GPT-4.1 series badge');
  assert.strictEqual(chatModelUtils.getChatModelSeriesLabel('chatgpt-4o-latest'), 'ChatGPT-4o', 'chatgpt-4o models should expose a ChatGPT-4o series badge');
  assert.strictEqual(chatModelUtils.getChatModelSeriesLabel('o4-mini'), 'o Series', 'o-series models should expose an o Series badge');

  assert.strictEqual(chatModelUtils.getChatModelSeriesClass('GPT-5.x'), 'series-gpt5', 'GPT-5.x should map to the dedicated series class');
  assert.strictEqual(chatModelUtils.getChatModelSeriesClass('GPT-4.1'), 'series-gpt41', 'GPT-4.1 should map to the dedicated series class');
  assert.strictEqual(chatModelUtils.getChatModelSeriesClass('ChatGPT-4o'), 'series-chatgpt4o', 'ChatGPT-4o should map to the dedicated series class');
  assert.strictEqual(chatModelUtils.getChatModelSeriesClass('o Series'), 'series-o', 'o Series should map to the dedicated series class');

  assert.ok(
    appJs.includes('<span class="dropdown-option-series ${getChatModelSeriesClass(seriesLabel)}">${escapeHtml(seriesLabel)}</span>'),
    'chat model dropdown items should render an explicit series badge'
  );
  assert.ok(
    appJs.includes('<span class="dropdown-option-meta">${seriesBadge}${capabilityTags}</span>'),
    'chat model dropdown items should render series identity and capability tags in separate meta slots'
  );
  assert.ok(modelUtilsJs.includes('formatChatModelDropdownLabel'), 'chat model utilities should move label formatting into a dedicated module');

  assert.ok(css.includes('.dropdown-option-series {'), 'chat model dropdown should define a dedicated series badge style');
  assert.ok(css.includes('.dropdown-option-meta {'), 'chat model dropdown should define a shared meta row for badges');
  assert.ok(css.includes('.dropdown-option-series.series-gpt5 {'), 'chat model dropdown should define a dedicated GPT-5.x badge tone');
  assert.ok(css.includes('[data-theme="paper"] .dropdown-option-series.series-gpt5 {'), 'paper theme should override the GPT-5.x badge tone');

  console.log('Chat model series badge tests passed');
}

if (require.main === module) {
  main();
}

module.exports = {
  main
};

