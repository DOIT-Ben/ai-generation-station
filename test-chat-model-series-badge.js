const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function extractFunction(source, functionName, nextFunctionName) {
  const start = source.indexOf(`function ${functionName}`);
  const end = source.indexOf(`\n  function ${nextFunctionName}`, start);
  assert.ok(start >= 0, `${functionName} should exist`);
  assert.ok(end > start, `${functionName} should end before ${nextFunctionName}`);
  return source.slice(start, end);
}

function main() {
  const appJs = fs.readFileSync(path.join(__dirname, 'public', 'js', 'app.js'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, 'public', 'css', 'style.css'), 'utf8');
  const context = {};
  vm.createContext(context);
  vm.runInContext(extractFunction(appJs, 'getChatModelGroupLabel', 'getChatModelSeriesLabel'), context);
  vm.runInContext(extractFunction(appJs, 'getChatModelSeriesLabel', 'getChatModelSeriesClass'), context);
  vm.runInContext(extractFunction(appJs, 'getChatModelSeriesClass', 'getChatModelTagClass'), context);

  assert.strictEqual(context.getChatModelSeriesLabel('gpt-5.4'), 'GPT-5.x', 'gpt-5 models should expose a GPT-5.x series badge');
  assert.strictEqual(context.getChatModelSeriesLabel('gpt-4.1-mini'), 'GPT-4.1', 'gpt-4.1 models should expose a GPT-4.1 series badge');
  assert.strictEqual(context.getChatModelSeriesLabel('chatgpt-4o-latest'), 'ChatGPT-4o', 'chatgpt-4o models should expose a ChatGPT-4o series badge');
  assert.strictEqual(context.getChatModelSeriesLabel('o4-mini'), 'o Series', 'o-series models should expose an o Series badge');

  assert.strictEqual(context.getChatModelSeriesClass('GPT-5.x'), 'series-gpt5', 'GPT-5.x should map to the dedicated series class');
  assert.strictEqual(context.getChatModelSeriesClass('GPT-4.1'), 'series-gpt41', 'GPT-4.1 should map to the dedicated series class');
  assert.strictEqual(context.getChatModelSeriesClass('ChatGPT-4o'), 'series-chatgpt4o', 'ChatGPT-4o should map to the dedicated series class');
  assert.strictEqual(context.getChatModelSeriesClass('o Series'), 'series-o', 'o Series should map to the dedicated series class');

  assert.ok(
    appJs.includes('<span class="dropdown-option-series ${getChatModelSeriesClass(seriesLabel)}">${escapeHtml(seriesLabel)}</span>'),
    'chat model dropdown items should render an explicit series badge'
  );
  assert.ok(
    appJs.includes('<span class="dropdown-option-meta">${seriesBadge}${capabilityTags}</span>'),
    'chat model dropdown items should render series identity and capability tags in separate meta slots'
  );

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
