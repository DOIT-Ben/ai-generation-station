const fs = require('fs');
const os = require('os');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const { createStateStore } = require('./server/state-store');

const MIGRATION_METADATA = '2026-04-25-conversation-message-metadata';
const MIGRATION_HISTORY_FK = '2026-04-25-user-history-foreign-key';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function createTempPaths() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aigs-state-migrations-'));
  return {
    tempRoot,
    dbPath: path.join(tempRoot, 'app-state.sqlite'),
    legacyPath: path.join(tempRoot, 'app-state.json')
  };
}

function cleanupTempPaths(paths) {
  if (!paths) return;
  fs.rmSync(paths.tempRoot, { recursive: true, force: true });
}

function createTestStore(paths) {
  return createStateStore({
    dbPath: paths.dbPath,
    legacyFilePath: paths.legacyPath,
    sessionTtlMs: 7 * 24 * 60 * 60 * 1000,
    maxHistoryItems: 12,
    seedUser: {
      username: 'studio',
      password: 'AIGS2026!',
      displayName: 'Studio Admin',
      role: 'admin',
      planCode: 'internal'
    }
  });
}

function seedLegacySchema(dbPath) {
  const db = new DatabaseSync(dbPath);
  try {
    const now = Date.now();
    db.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        email TEXT UNIQUE,
        display_name TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        role TEXT NOT NULL DEFAULT 'user',
        plan_code TEXT NOT NULL DEFAULT 'free',
        timezone TEXT NOT NULL DEFAULT 'Asia/Shanghai',
        locale TEXT NOT NULL DEFAULT 'zh-CN',
        last_login_at INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        deleted_at INTEGER
      );

      CREATE TABLE conversations (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        feature TEXT NOT NULL DEFAULT 'chat',
        title TEXT NOT NULL,
        model TEXT NOT NULL DEFAULT 'gpt-4.1-mini',
        message_count INTEGER NOT NULL DEFAULT 0,
        last_message_at INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        archived_at INTEGER
      );

      CREATE TABLE conversation_messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        tokens_json TEXT,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE user_history_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        feature TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
    `);

    db.prepare(`
      INSERT INTO users (id, username, display_name, status, role, plan_code, timezone, locale, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'valid-user',
      'valid',
      'Valid User',
      'active',
      'user',
      'free',
      'Asia/Shanghai',
      'zh-CN',
      now,
      now
    );

    db.prepare(`
      INSERT INTO conversations (id, user_id, title, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run('conv_legacy', 'valid-user', 'Legacy Conversation', now, now);

    db.prepare(`
      INSERT INTO conversation_messages (id, conversation_id, role, content, tokens_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('msg_legacy', 'conv_legacy', 'user', 'legacy message', null, now);

    const insertHistory = db.prepare(`
      INSERT INTO user_history_entries (user_id, feature, payload, created_at)
      VALUES (?, ?, ?, ?)
    `);
    insertHistory.run('valid-user', 'chat', JSON.stringify({ prompt: 'keep me' }), now);
    insertHistory.run('missing-user', 'chat', JSON.stringify({ prompt: 'remove me' }), now + 1);
  } finally {
    db.close();
  }
}

function inspectDatabase(dbPath) {
  const db = new DatabaseSync(dbPath);
  try {
    return {
      migrationRows: db.prepare(`SELECT id FROM schema_migrations ORDER BY id`).all(),
      messageColumns: db.prepare(`PRAGMA table_info(conversation_messages)`).all(),
      historyForeignKeys: db.prepare(`PRAGMA foreign_key_list(user_history_entries)`).all(),
      historyCount: db.prepare(`SELECT COUNT(*) AS count FROM user_history_entries`).get().count,
      legacyMessage: db.prepare(`SELECT id, content, metadata_json AS metadataJson FROM conversation_messages WHERE id = ?`).get('msg_legacy')
    };
  } finally {
    db.close();
  }
}

function testLegacySchemaMigrationsAreRecordedAndIdempotent() {
  const paths = createTempPaths();
  seedLegacySchema(paths.dbPath);

  let stateStore = createTestStore(paths);
  try {
    const validHistory = stateStore.getHistory('valid-user', 'chat');
    assert(validHistory.length === 1, 'expected valid user history to survive migration');
    assert(validHistory[0].prompt === 'keep me', 'expected valid history payload to survive migration');
  } finally {
    stateStore.close();
  }

  const firstInspection = inspectDatabase(paths.dbPath);
  const migrationIds = firstInspection.migrationRows.map(row => row.id);

  assert(migrationIds.includes(MIGRATION_METADATA), 'expected metadata column migration to be recorded');
  assert(migrationIds.includes(MIGRATION_HISTORY_FK), 'expected history foreign key migration to be recorded');
  assert(
    firstInspection.messageColumns.some(row => row.name === 'metadata_json'),
    'expected old conversation_messages table to gain metadata_json'
  );
  assert(
    firstInspection.historyForeignKeys.some(row => row.table === 'users' && row.from === 'user_id' && row.on_delete === 'CASCADE'),
    'expected old user_history_entries table to gain user_id foreign key'
  );
  assert(firstInspection.historyCount === 1, `expected orphan history to be removed, got ${firstInspection.historyCount}`);
  assert(firstInspection.legacyMessage?.content === 'legacy message', 'expected existing conversation message to survive migration');
  assert(firstInspection.legacyMessage?.metadataJson === null, 'expected migrated metadata_json to default to null');

  stateStore = createTestStore(paths);
  stateStore.close();

  const secondInspection = inspectDatabase(paths.dbPath);
  assert(
    secondInspection.migrationRows.length === firstInspection.migrationRows.length,
    'expected second initialization to leave migration record count unchanged'
  );

  cleanupTempPaths(paths);
}

function main() {
  testLegacySchemaMigrationsAreRecordedAndIdempotent();
  console.log('State migration tests passed');
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = {
  main
};
