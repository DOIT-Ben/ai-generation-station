'use strict';

function tableHasColumn(db, tableName, columnName) {
    return db.prepare(`PRAGMA table_info(${tableName})`)
        .all()
        .some(row => row.name === columnName);
}

function runSchemaMigration(db, id, migrate) {
    const existing = db.prepare(`SELECT id FROM schema_migrations WHERE id = ?`).get(id);
    if (existing) return;

    migrate();
    db.prepare(`
        INSERT OR IGNORE INTO schema_migrations (id, applied_at)
        VALUES (?, ?)
    `).run(id, Date.now());
}

function migrateConversationMessageMetadata(db) {
    if (tableHasColumn(db, 'conversation_messages', 'metadata_json')) return;
    db.exec(`ALTER TABLE conversation_messages ADD COLUMN metadata_json TEXT;`);
}

function hasUserHistoryUserForeignKey(db) {
    return db.prepare(`PRAGMA foreign_key_list(user_history_entries)`)
        .all()
        .some(row => row.table === 'users' && row.from === 'user_id' && row.to === 'id');
}

function migrateUserHistoryForeignKey(db) {
    if (hasUserHistoryUserForeignKey(db)) return;

    db.exec(`
        BEGIN;

        DROP TABLE IF EXISTS user_history_entries_migrated;

        CREATE TABLE user_history_entries_migrated (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            feature TEXT NOT NULL,
            payload TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        );

        INSERT INTO user_history_entries_migrated (id, user_id, feature, payload, created_at)
        SELECT h.id, h.user_id, h.feature, h.payload, h.created_at
        FROM user_history_entries h
        WHERE EXISTS (
            SELECT 1
            FROM users u
            WHERE u.id = h.user_id
        );

        DROP TABLE user_history_entries;
        ALTER TABLE user_history_entries_migrated RENAME TO user_history_entries;

        CREATE INDEX IF NOT EXISTS idx_user_history_lookup
            ON user_history_entries (user_id, feature, created_at DESC, id DESC);

        COMMIT;
    `);
}

module.exports = {
    tableHasColumn,
    runSchemaMigration,
    migrateConversationMessageMetadata,
    hasUserHistoryUserForeignKey,
    migrateUserHistoryForeignKey
};
