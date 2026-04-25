const assert = require('assert');

const { normalizeChatModelOptions } = require('./server/routes/service');

function main() {
  const models = normalizeChatModelOptions({
    data: [
      { id: 'gpt-5.5', display_name: 'GPT-5.5' },
      { id: 'gpt-5.4', display_name: 'GPT-5.4' },
      { id: 'gpt-5.2-pro-2025-12-11', display_name: 'gpt-5.2-pro-2025-12-11' },
      { id: 'chatgpt-4o-latest', display_name: 'chatgpt-4o-latest' },
      { id: 'gpt-4.1-mini', display_name: 'GPT-4.1 Mini' },
      { id: 'o4-mini', display_name: 'o4-mini' },
      { id: 'o3', display_name: 'o3' },
      { id: 'image-gen', display_name: 'Image Gen' }
    ]
  }, 'gpt-4.1-mini');

  assert.ok(Array.isArray(models), 'normalized models should be an array');
  assert.ok(models.every(item => item.id !== 'gpt-5.5'), 'blocked chat models should be removed');
  assert.ok(models.every(item => item.id !== 'image-gen'), 'non-chat models should be removed');
  assert.deepStrictEqual(
    models.map(item => item.id),
    ['gpt-5.4', 'gpt-5.2-pro-2025-12-11', 'gpt-4.1-mini', 'chatgpt-4o-latest', 'o3', 'o4-mini'],
    'supported chat models should keep the expected order after filtering'
  );
  assert.strictEqual(
    models.find(item => item.id === 'gpt-5.2-pro-2025-12-11')?.label,
    'GPT-5.2 Pro 2025-12-11',
    'dated GPT model ids should render with unified GPT casing and readable suffixes'
  );
  assert.strictEqual(
    models.find(item => item.id === 'chatgpt-4o-latest')?.label,
    'ChatGPT-4o Latest',
    'ChatGPT model ids should render with consistent casing'
  );
  assert.strictEqual(
    models.find(item => item.id === 'o4-mini')?.label,
    'o4 Mini',
    'o-series model ids should render suffixes consistently'
  );

  console.log('Chat model normalization tests passed');
}

if (require.main === module) {
  main();
}

module.exports = {
  main
};
