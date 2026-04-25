const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { normalizeChatModelOptions } = require('./server/routes/service');

function extractFunction(source, functionName, nextFunctionName) {
  const start = source.indexOf(`function ${functionName}`);
  const end = source.indexOf(`\n  function ${nextFunctionName}`, start);
  assert.ok(start >= 0, `${functionName} should exist`);
  assert.ok(end > start, `${functionName} should end before ${nextFunctionName}`);
  return source.slice(start, end);
}

function main() {
  const appJs = fs.readFileSync(path.join(__dirname, 'public', 'js', 'app.js'), 'utf8');
  const context = {};
  vm.createContext(context);
  vm.runInContext(extractFunction(appJs, 'formatChatModelDropdownLabel', 'readCachedChatModelOptions'), context);

  assert.ok(
    appJs.includes("const CHAT_MODEL_OPTIONS_CACHE_VERSION = 2;"),
    'chat model option cache should use a versioned envelope'
  );
  assert.ok(
    appJs.includes('Number(cached.version || 0) !== CHAT_MODEL_OPTIONS_CACHE_VERSION'),
    'stale model option cache should be ignored'
  );
  assert.strictEqual(
    context.formatChatModelDropdownLabel('gpt-5.2-pro-2025-12-11', 'gpt-5.2-pro-2025-12-11'),
    'GPT-5.2 Pro 2025-12-11',
    'frontend should normalize stale cached lowercase GPT labels'
  );
  assert.strictEqual(
    context.formatChatModelDropdownLabel('chatgpt-4o-latest', 'chatgpt-4o-latest'),
    'ChatGPT-4o Latest',
    'frontend should normalize stale cached ChatGPT labels'
  );
  assert.strictEqual(
    context.formatChatModelDropdownLabel('o4-mini', 'o4-mini'),
    'o4 Mini',
    'frontend should normalize stale cached o-series labels'
  );

  const consistencyCases = [
    ['gpt-5.2-2025-12-11', 'GPT-5.2 2025-12-11'],
    ['gpt-5.2-pro-2025-12-11', 'GPT-5.2 Pro 2025-12-11'],
    ['gpt-5.4-2026-03-05', 'GPT-5.4 2026-03-05'],
    ['chatgpt-4o-latest', 'ChatGPT-4o Latest'],
    ['o4-mini', 'o4 Mini']
  ];

  const serverModels = normalizeChatModelOptions({
    data: consistencyCases.map(([id]) => ({ id, display_name: id }))
  });
  for (const [id, expectedLabel] of consistencyCases) {
    const frontendLabel = context.formatChatModelDropdownLabel(id, id);
    const serverLabel = serverModels.find(item => item.id === id)?.label;
    assert.strictEqual(frontendLabel, expectedLabel, `frontend label should match expected case for ${id}`);
    assert.strictEqual(serverLabel, expectedLabel, `server label should match expected case for ${id}`);
    assert.strictEqual(frontendLabel, serverLabel, `frontend and server labels should stay consistent for ${id}`);
  }

  console.log('Chat model dropdown label cache tests passed');
}

if (require.main === module) {
  main();
}

module.exports = {
  main
};
