const fs = require('fs');
const os = require('os');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const { createStateStore } = require('./server/state-store');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function createTempPaths() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aigs-state-fk-'));
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

function assertThrowsForeignKey(fn, label) {
  let threw = false;
  try {
    fn();
  } catch (error) {
    threw = true;
    assert(
      /foreign key/i.test(String(error?.message || '')),
      `${label} should fail with a foreign key error, got: ${error?.message}`
    );
  }
  assert(threw, `${label} should be rejected by SQLite foreign key enforcement`);
}

function getHistoryForeignKeys(dbPath) {
  const db = new DatabaseSync(dbPath);
  try {
    return db.prepare(`PRAGMA foreign_key_list(user_history_entries)`).all();
  } finally {
    db.close();
  }
}

function testForeignKeysRejectInvalidSessionUser() {
  const paths = createTempPaths();
  const stateStore = createTestStore(paths);
  try {
    assertThrowsForeignKey(() => {
      stateStore.createSession({
        id: 'missing-user',
        username: 'missing'
      });
    }, 'createSession with a missing user');
  } finally {
    stateStore.close();
    cleanupTempPaths(paths);
  }
}

function testForeignKeysRejectInvalidHistoryUser() {
  const paths = createTempPaths();
  const stateStore = createTestStore(paths);
  try {
    assertThrowsForeignKey(() => {
      stateStore.appendHistory('missing-user', 'chat', {
        id: 'history_missing_user',
        timestamp: Date.now(),
        prompt: 'orphan history'
      });
    }, 'appendHistory with a missing user');
  } finally {
    stateStore.close();
    cleanupTempPaths(paths);
  }
}

function seedLegacyHistorySchema(dbPath) {
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

function testLegacyHistoryTableMigratesToForeignKey() {
  const paths = createTempPaths();
  seedLegacyHistorySchema(paths.dbPath);
  const stateStore = createTestStore(paths);
  try {
    const foreignKeys = getHistoryForeignKeys(paths.dbPath);
    assert(
      foreignKeys.some(row => row.table === 'users' && row.from === 'user_id' && row.on_delete === 'CASCADE'),
      'expected migrated user_history_entries to reference users(id) ON DELETE CASCADE'
    );

    const validHistory = stateStore.getHistory('valid-user', 'chat');
    assert(validHistory.length === 1, 'expected valid user history to survive migration');
    assert(validHistory[0].prompt === 'keep me', 'expected valid user history payload to survive migration');

    const summary = stateStore.getMaintenanceSummary();
    assert(summary.historyEntries === 1, `expected orphan history to be cleaned, got ${summary.historyEntries}`);
  } finally {
    stateStore.close();
    cleanupTempPaths(paths);
  }
}

function main() {
  testForeignKeysRejectInvalidSessionUser();
  testForeignKeysRejectInvalidHistoryUser();
  testLegacyHistoryTableMigratesToForeignKey();
  console.log('State foreign key tests passed');
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
