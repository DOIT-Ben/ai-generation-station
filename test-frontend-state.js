const assert = require('assert');
const AppShell = require('./public/js/app-shell.js');

function testAuth() {
  assert.equal(AppShell.authenticate('studio', 'AIGS2026!'), true, 'fixed credentials should authenticate');
  assert.equal(AppShell.authenticate('studio', 'wrong'), false, 'wrong password should fail');
}

function testTemplates() {
  const library = AppShell.TEMPLATE_LIBRARY;
  const features = ['chat', 'lyrics', 'cover', 'speech', 'music', 'covervoice'];

  for (const feature of features) {
    assert.ok(Array.isArray(library[feature]), `${feature} should have template categories`);
    assert.ok(library[feature].length >= 2, `${feature} should have multiple categories`);
    const totalItems = library[feature].reduce((sum, category) => sum + category.items.length, 0);
    assert.ok(totalItems >= 6, `${feature} should have enough templates`);
  }
}

function testRemotePersistenceShape() {
  const remote = AppShell.createRemotePersistence(async () => ({
    ok: true,
    status: 200,
    async json() {
      return {};
    }
  }));

  ['loadSession', 'login', 'logout', 'getHistory', 'appendHistory', 'getPreferences', 'savePreferences', 'getUsageToday', 'getTemplates', 'createTemplate', 'toggleTemplateFavorite', 'getAdminUsers', 'updateAdminUser', 'getConversations', 'createConversation', 'getConversation', 'sendChatMessage']
    .forEach(method => {
      assert.equal(typeof remote[method], 'function', `${method} should exist on remote persistence`);
    });
}

function testPersistence() {
  const storage = AppShell.createMemoryStorage();
  const persistence = AppShell.createPersistence(storage);

  persistence.saveSession({ username: 'studio' });
  assert.deepEqual(persistence.loadSession(), { username: 'studio' }, 'session should round-trip');

  for (let i = 0; i < AppShell.MAX_HISTORY_ITEMS + 3; i++) {
    persistence.appendHistory('studio', 'chat', { id: i, title: `entry-${i}` });
  }

  const history = persistence.getHistory('studio', 'chat');
  assert.equal(history.length, AppShell.MAX_HISTORY_ITEMS, 'history should be trimmed to max size');
  assert.equal(history[0].id, AppShell.MAX_HISTORY_ITEMS + 2, 'newest history item should be first');

  const conversation = persistence.createConversation('studio', { title: 'Test Chat', model: 'MiniMax-M2.7-highspeed' });
  assert.ok(conversation.id, 'conversation should get an id');
  assert.equal(conversation.title, 'Test Chat', 'conversation should store title');
  assert.equal(conversation.model, 'MiniMax-M2.7-highspeed', 'conversation should store model');

  persistence.saveConversationMessages('studio', conversation.id, [
    { role: 'user', content: 'hello' },
    { role: 'assistant', content: 'hi' }
  ]);
  const messages = persistence.getConversationMessages('studio', conversation.id);
  assert.equal(messages.length, 2, 'conversation messages should round-trip');
  assert.equal(persistence.getConversation('studio', conversation.id)?.id, conversation.id, 'conversation lookup should work');
}

function main() {
  testAuth();
  testTemplates();
  testRemotePersistenceShape();
  testPersistence();
  console.log('✅ Frontend state tests passed');
}

if (require.main === module) {
  main();
}

module.exports = {
  main
};
