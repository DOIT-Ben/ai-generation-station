const fs = require('fs');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');
const {
    hashPassword,
    hashPasswordAsync,
    verifyPassword,
    verifyPasswordAsync
} = require('./lib/passwords');
const {
    safeParseJson,
    hashOpaqueToken,
    createOpaqueToken,
    normalizeUserRecord,
    getDefaultPreferences,
    normalizeCredentialRecord,
    normalizePreferences,
    buildConversationTitle,
    buildConversationPreview,
    normalizeConversation,
    normalizeConversationMessage,
    buildConversationTimeline,
    buildDisplayedConversationMessages,
    getUsageDate,
    normalizeTask,
    normalizeAuditLog,
    normalizeAuthTokenRecord,
    buildAuthTokenSummary,
    getEmptyUsage,
    normalizeTemplateRow,
    groupTemplates,
    buildAuditLogQuery,
    buildSystemTemplateSeed
} = require('./state-store-helpers');
const { createStateStoreMutations } = require('./state-store-mutations');
const { createStateStoreAuth } = require('./state-store-auth');
const { createStateStoreMaintenance } = require('./state-store-maintenance');
const { createStateStoreQueries } = require('./state-store-queries');
const { createStateStoreConversations } = require('./state-store-conversations');
const { createStateStoreSnapshots } = require('./state-store-snapshots');
const { createStateStoreUsers } = require('./state-store-users');

const LOGIN_FAILURE_LOCK_THRESHOLD = 5;
const LOGIN_FAILURE_LOCK_MS = 15 * 60 * 1000;
const SCHEMA_MIGRATION_CONVERSATION_MESSAGE_METADATA = '2026-04-25-conversation-message-metadata';
const SCHEMA_MIGRATION_USER_HISTORY_FOREIGN_KEY = '2026-04-25-user-history-foreign-key';

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

function createStateStore({ dbPath, legacyFilePath, sessionTtlMs, maxHistoryItems, seedUser }) {
    const db = new DatabaseSync(dbPath);
    db.exec(`
        PRAGMA foreign_keys = ON;
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;
        PRAGMA busy_timeout = 5000;

        CREATE TABLE IF NOT EXISTS schema_migrations (
            id TEXT PRIMARY KEY,
            applied_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS users (
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

        CREATE TABLE IF NOT EXISTS user_credentials (
            user_id TEXT PRIMARY KEY,
            password_hash TEXT NOT NULL,
            password_algo TEXT NOT NULL DEFAULT 'scrypt',
            password_updated_at INTEGER NOT NULL,
            must_reset_password INTEGER NOT NULL DEFAULT 0,
            failed_login_count INTEGER NOT NULL DEFAULT 0,
            locked_until INTEGER,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS user_sessions (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            session_token_hash TEXT NOT NULL UNIQUE,
            ip TEXT,
            user_agent TEXT,
            device_label TEXT,
            created_at INTEGER NOT NULL,
            last_seen_at INTEGER NOT NULL,
            expires_at INTEGER NOT NULL,
            revoked_at INTEGER,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_user_sessions_lookup ON user_sessions (session_token_hash);
        CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions (expires_at);

        CREATE TABLE IF NOT EXISTS auth_tokens (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            purpose TEXT NOT NULL,
            token_hash TEXT NOT NULL UNIQUE,
            requested_identity TEXT,
            created_by_user_id TEXT,
            metadata_json TEXT,
            created_at INTEGER NOT NULL,
            expires_at INTEGER NOT NULL,
            used_at INTEGER,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
            FOREIGN KEY (created_by_user_id) REFERENCES users (id) ON DELETE SET NULL
        );

        CREATE INDEX IF NOT EXISTS idx_auth_tokens_lookup ON auth_tokens (purpose, token_hash);
        CREATE INDEX IF NOT EXISTS idx_auth_tokens_user_purpose ON auth_tokens (user_id, purpose, expires_at DESC);
        CREATE INDEX IF NOT EXISTS idx_auth_tokens_expiry ON auth_tokens (expires_at);

        CREATE TABLE IF NOT EXISTS rate_limit_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            rule_name TEXT NOT NULL,
            bucket_key TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            expires_at INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_rate_limit_events_lookup
            ON rate_limit_events (rule_name, bucket_key, created_at ASC);
        CREATE INDEX IF NOT EXISTS idx_rate_limit_events_expiry
            ON rate_limit_events (expires_at);

        CREATE TABLE IF NOT EXISTS user_preferences (
            user_id TEXT PRIMARY KEY,
            theme TEXT,
            default_model_chat TEXT,
            default_voice TEXT,
            default_music_style TEXT,
            default_cover_ratio TEXT,
            template_preferences_json TEXT,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS user_usage_daily (
            user_id TEXT NOT NULL,
            usage_date TEXT NOT NULL,
            chat_count INTEGER NOT NULL DEFAULT 0,
            lyrics_count INTEGER NOT NULL DEFAULT 0,
            music_count INTEGER NOT NULL DEFAULT 0,
            image_count INTEGER NOT NULL DEFAULT 0,
            speech_count INTEGER NOT NULL DEFAULT 0,
            cover_count INTEGER NOT NULL DEFAULT 0,
            input_tokens INTEGER NOT NULL DEFAULT 0,
            output_tokens INTEGER NOT NULL DEFAULT 0,
            storage_bytes INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (user_id, usage_date),
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS user_history_entries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            feature TEXT NOT NULL,
            payload TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_user_history_lookup ON user_history_entries (user_id, feature, created_at DESC, id DESC);

        CREATE TABLE IF NOT EXISTS conversations (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            feature TEXT NOT NULL DEFAULT 'chat',
            title TEXT NOT NULL,
            model TEXT NOT NULL DEFAULT 'gpt-4.1-mini',
            message_count INTEGER NOT NULL DEFAULT 0,
            last_message_at INTEGER,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            archived_at INTEGER,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_conversations_user_lookup
            ON conversations (user_id, archived_at, COALESCE(last_message_at, created_at) DESC, updated_at DESC);

        CREATE TABLE IF NOT EXISTS conversation_messages (
            id TEXT PRIMARY KEY,
            conversation_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            tokens_json TEXT,
            metadata_json TEXT,
            created_at INTEGER NOT NULL,
            FOREIGN KEY (conversation_id) REFERENCES conversations (id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_conversation_messages_lookup
            ON conversation_messages (conversation_id, created_at ASC);

        CREATE TABLE IF NOT EXISTS system_templates (
            id TEXT PRIMARY KEY,
            feature TEXT NOT NULL,
            category TEXT NOT NULL,
            label TEXT NOT NULL,
            description TEXT,
            payload TEXT NOT NULL,
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_system_templates_feature_sort ON system_templates (feature, sort_order, category);

        CREATE TABLE IF NOT EXISTS user_templates (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            feature TEXT NOT NULL,
            category TEXT NOT NULL,
            label TEXT NOT NULL,
            description TEXT,
            payload TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_user_templates_feature_user ON user_templates (user_id, feature, created_at DESC);

        CREATE TABLE IF NOT EXISTS user_template_favorites (
            user_id TEXT NOT NULL,
            feature TEXT NOT NULL,
            template_kind TEXT NOT NULL,
            template_id TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            PRIMARY KEY (user_id, template_kind, template_id),
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_user_template_favorites_feature ON user_template_favorites (user_id, feature);

        CREATE TABLE IF NOT EXISTS tasks (
            task_id TEXT PRIMARY KEY,
            user_id TEXT,
            feature TEXT NOT NULL,
            status TEXT NOT NULL,
            progress INTEGER NOT NULL DEFAULT 0,
            input_payload TEXT,
            output_payload TEXT,
            error TEXT,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
        );

        CREATE INDEX IF NOT EXISTS idx_tasks_feature_status ON tasks (feature, status, updated_at DESC);

        CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            action TEXT NOT NULL,
            actor_user_id TEXT,
            target_user_id TEXT,
            actor_username TEXT,
            target_username TEXT,
            actor_role TEXT,
            target_role TEXT,
            actor_ip TEXT,
            actor_user_agent TEXT,
            details_json TEXT,
            created_at INTEGER NOT NULL,
            FOREIGN KEY (actor_user_id) REFERENCES users (id) ON DELETE SET NULL,
            FOREIGN KEY (target_user_id) REFERENCES users (id) ON DELETE SET NULL
        );

        CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at DESC, id DESC);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_action_created_at ON audit_logs (action, created_at DESC, id DESC);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_target_created_at ON audit_logs (target_user_id, created_at DESC, id DESC);
    `);

    runSchemaMigration(db, SCHEMA_MIGRATION_CONVERSATION_MESSAGE_METADATA, () => {
        migrateConversationMessageMetadata(db);
    });
    runSchemaMigration(db, SCHEMA_MIGRATION_USER_HISTORY_FOREIGN_KEY, () => {
        migrateUserHistoryForeignKey(db);
    });

    const findUserByUsernameStmt = db.prepare(`
        SELECT id, username, email, display_name AS displayName, status, role, plan_code AS planCode,
               timezone, locale, last_login_at AS lastLoginAt, created_at AS createdAt, updated_at AS updatedAt
        FROM users
        WHERE username = ? AND deleted_at IS NULL
    `);
    const findUserByEmailStmt = db.prepare(`
        SELECT id, username, email, display_name AS displayName, status, role, plan_code AS planCode,
               timezone, locale, last_login_at AS lastLoginAt, created_at AS createdAt, updated_at AS updatedAt
        FROM users
        WHERE email = ? AND deleted_at IS NULL
    `);
    const findUserByIdStmt = db.prepare(`
        SELECT id, username, email, display_name AS displayName, status, role, plan_code AS planCode,
               timezone, locale, last_login_at AS lastLoginAt, created_at AS createdAt, updated_at AS updatedAt
        FROM users
        WHERE id = ? AND deleted_at IS NULL
    `);
    const listUsersStmt = db.prepare(`
        SELECT id, username, email, display_name AS displayName, status, role, plan_code AS planCode,
               timezone, locale, last_login_at AS lastLoginAt, created_at AS createdAt, updated_at AS updatedAt
        FROM users
        WHERE deleted_at IS NULL
        ORDER BY created_at DESC, username ASC
    `);
    const countActiveAdminsStmt = db.prepare(`
        SELECT COUNT(*) AS count
        FROM users
        WHERE role = 'admin' AND status = 'active' AND deleted_at IS NULL
    `);
    const insertUserStmt = db.prepare(`
        INSERT INTO users (id, username, email, display_name, status, role, plan_code, timezone, locale, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const updateUserAdminStmt = db.prepare(`
        UPDATE users
        SET email = ?, status = ?, role = ?, plan_code = ?, updated_at = ?
        WHERE id = ? AND deleted_at IS NULL
    `);
    const updateUserLoginStmt = db.prepare(`
        UPDATE users
        SET last_login_at = ?, updated_at = ?
        WHERE id = ?
    `);
    const getCredentialStmt = db.prepare(`
        SELECT user_id AS userId, password_hash AS passwordHash, password_updated_at AS passwordUpdatedAt,
               must_reset_password AS mustResetPassword, failed_login_count AS failedLoginCount,
               locked_until AS lockedUntil
        FROM user_credentials
        WHERE user_id = ?
    `);
    const upsertCredentialStmt = db.prepare(`
        INSERT INTO user_credentials (
            user_id, password_hash, password_updated_at, must_reset_password, failed_login_count, locked_until
        ) VALUES (?, ?, ?, ?, 0, NULL)
        ON CONFLICT(user_id) DO UPDATE SET
            password_hash = excluded.password_hash,
            password_updated_at = excluded.password_updated_at,
            must_reset_password = excluded.must_reset_password,
            failed_login_count = 0,
            locked_until = NULL
    `);
    const resetFailedLoginStmt = db.prepare(`
        UPDATE user_credentials
        SET failed_login_count = 0, locked_until = NULL
        WHERE user_id = ?
    `);
    const incrementFailedLoginStmt = db.prepare(`
        UPDATE user_credentials
        SET failed_login_count = failed_login_count + 1,
            locked_until = CASE
                WHEN failed_login_count + 1 >= ? THEN ?
                ELSE NULL
            END
        WHERE user_id = ?
    `);
    const getPreferencesStmt = db.prepare(`
        SELECT theme, default_model_chat AS defaultModelChat, default_voice AS defaultVoice,
               default_music_style AS defaultMusicStyle, default_cover_ratio AS defaultCoverRatio,
               template_preferences_json AS templatePreferencesJson,
               created_at AS createdAt, updated_at AS updatedAt
        FROM user_preferences
        WHERE user_id = ?
    `);
    const upsertPreferencesStmt = db.prepare(`
        INSERT INTO user_preferences (
            user_id, theme, default_model_chat, default_voice, default_music_style, default_cover_ratio,
            template_preferences_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
            theme = excluded.theme,
            default_model_chat = excluded.default_model_chat,
            default_voice = excluded.default_voice,
            default_music_style = excluded.default_music_style,
            default_cover_ratio = excluded.default_cover_ratio,
            template_preferences_json = excluded.template_preferences_json,
            updated_at = excluded.updated_at
    `);
    const getUsageDailyStmt = db.prepare(`
        SELECT usage_date AS usageDate, chat_count AS chatCount, lyrics_count AS lyricsCount,
               music_count AS musicCount, image_count AS imageCount, speech_count AS speechCount,
               cover_count AS coverCount, input_tokens AS inputTokens, output_tokens AS outputTokens,
               storage_bytes AS storageBytes
        FROM user_usage_daily
        WHERE user_id = ? AND usage_date = ?
    `);
    const upsertUsageStmt = db.prepare(`
        INSERT INTO user_usage_daily (
            user_id, usage_date, chat_count, lyrics_count, music_count, image_count, speech_count, cover_count,
            input_tokens, output_tokens, storage_bytes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, usage_date) DO UPDATE SET
            chat_count = chat_count + excluded.chat_count,
            lyrics_count = lyrics_count + excluded.lyrics_count,
            music_count = music_count + excluded.music_count,
            image_count = image_count + excluded.image_count,
            speech_count = speech_count + excluded.speech_count,
            cover_count = cover_count + excluded.cover_count,
            input_tokens = input_tokens + excluded.input_tokens,
            output_tokens = output_tokens + excluded.output_tokens,
            storage_bytes = storage_bytes + excluded.storage_bytes
    `);

    const getSessionStmt = db.prepare(`
        SELECT s.id, s.user_id AS userId, s.created_at AS createdAt, s.expires_at AS expiresAt,
               s.last_seen_at AS lastSeenAt, u.username, u.role, u.plan_code AS planCode, u.status
        FROM user_sessions s
        JOIN users u ON u.id = s.user_id
        WHERE s.session_token_hash = ? AND s.revoked_at IS NULL
    `);
    const insertSessionStmt = db.prepare(`
        INSERT INTO user_sessions (id, user_id, session_token_hash, created_at, last_seen_at, expires_at)
        VALUES (?, ?, ?, ?, ?, ?)
    `);
    const deleteSessionStmt = db.prepare(`DELETE FROM user_sessions WHERE session_token_hash = ?`);
    const deleteUserSessionsStmt = db.prepare(`DELETE FROM user_sessions WHERE user_id = ?`);
    const deleteUserSessionsExceptStmt = db.prepare(`DELETE FROM user_sessions WHERE user_id = ? AND id <> ?`);
    const deleteExpiredSessionsStmt = db.prepare(`DELETE FROM user_sessions WHERE expires_at <= ? OR revoked_at IS NOT NULL`);
    const findAuthTokenByHashStmt = db.prepare(`
        SELECT id, user_id AS userId, purpose, requested_identity AS requestedIdentity,
               created_by_user_id AS createdByUserId, metadata_json AS metadataJson,
               created_at AS createdAt, expires_at AS expiresAt, used_at AS usedAt
        FROM auth_tokens
        WHERE purpose = ? AND token_hash = ?
    `);
    const findLatestAuthTokenByUserPurposeStmt = db.prepare(`
        SELECT id, user_id AS userId, purpose, requested_identity AS requestedIdentity,
               created_by_user_id AS createdByUserId, metadata_json AS metadataJson,
               created_at AS createdAt, expires_at AS expiresAt, used_at AS usedAt
        FROM auth_tokens
        WHERE user_id = ? AND purpose = ?
        ORDER BY created_at DESC
        LIMIT 1
    `);
    const findActiveAuthTokenByUserPurposeStmt = db.prepare(`
        SELECT id, user_id AS userId, purpose, requested_identity AS requestedIdentity,
               created_by_user_id AS createdByUserId, metadata_json AS metadataJson,
               created_at AS createdAt, expires_at AS expiresAt, used_at AS usedAt
        FROM auth_tokens
        WHERE user_id = ? AND purpose = ? AND used_at IS NULL AND expires_at > ?
        ORDER BY created_at DESC
        LIMIT 1
    `);
    const insertAuthTokenStmt = db.prepare(`
        INSERT INTO auth_tokens (
            id, user_id, purpose, token_hash, requested_identity, created_by_user_id,
            metadata_json, created_at, expires_at, used_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
    `);
    const markUserPurposeTokensUsedStmt = db.prepare(`
        UPDATE auth_tokens
        SET used_at = COALESCE(used_at, ?)
        WHERE user_id = ? AND purpose = ? AND used_at IS NULL
    `);
    const markAuthTokenUsedStmt = db.prepare(`
        UPDATE auth_tokens
        SET used_at = ?
        WHERE id = ? AND used_at IS NULL
    `);
    const deleteExpiredAuthTokensStmt = db.prepare(`
        DELETE FROM auth_tokens
        WHERE expires_at <= ? OR used_at IS NOT NULL
    `);
    const cleanupExpiredRateLimitEventsStmt = db.prepare(`
        DELETE FROM rate_limit_events
        WHERE expires_at <= ?
    `);
    const selectRateLimitWindowStmt = db.prepare(`
        SELECT COUNT(*) AS count, MIN(created_at) AS oldestCreatedAt
        FROM rate_limit_events
        WHERE rule_name = ? AND bucket_key = ? AND created_at > ?
    `);
    const insertRateLimitEventStmt = db.prepare(`
        INSERT INTO rate_limit_events (rule_name, bucket_key, created_at, expires_at)
        VALUES (?, ?, ?, ?)
    `);

    const selectHistoryStmt = db.prepare(`
        SELECT payload
        FROM user_history_entries
        WHERE user_id = ? AND feature = ?
        ORDER BY created_at DESC, id DESC
        LIMIT ?
    `);
    const insertHistoryStmt = db.prepare(`
        INSERT INTO user_history_entries (user_id, feature, payload, created_at)
        VALUES (?, ?, ?, ?)
    `);
    const pruneHistoryStmt = db.prepare(`
        DELETE FROM user_history_entries
        WHERE user_id = ? AND feature = ?
          AND id NOT IN (
            SELECT id
            FROM user_history_entries
            WHERE user_id = ? AND feature = ?
            ORDER BY created_at DESC, id DESC
            LIMIT ?
          )
    `);
    const countUsersStmt = db.prepare(`
        SELECT COUNT(*) AS count
        FROM users
        WHERE deleted_at IS NULL
    `);
    const countSessionsStmt = db.prepare(`SELECT COUNT(*) AS count FROM user_sessions`);
    const countActiveSessionsStmt = db.prepare(`
        SELECT COUNT(*) AS count
        FROM user_sessions
        WHERE revoked_at IS NULL AND expires_at > ?
    `);
    const countAuthTokensStmt = db.prepare(`SELECT COUNT(*) AS count FROM auth_tokens`);
    const countActiveAuthTokensStmt = db.prepare(`
        SELECT COUNT(*) AS count
        FROM auth_tokens
        WHERE used_at IS NULL AND expires_at > ?
    `);
    const countRateLimitEventsStmt = db.prepare(`SELECT COUNT(*) AS count FROM rate_limit_events`);
    const countHistoryStmt = db.prepare(`SELECT COUNT(*) AS count FROM user_history_entries`);
    const countTasksStmt = db.prepare(`SELECT COUNT(*) AS count FROM tasks`);
    const countAuditLogsSummaryStmt = db.prepare(`
        SELECT COUNT(*) AS count, MIN(created_at) AS oldestCreatedAt, MAX(created_at) AS newestCreatedAt
        FROM audit_logs
    `);
    const deleteAuditLogsBeforeStmt = db.prepare(`
        DELETE FROM audit_logs
        WHERE created_at < ?
    `);
    const selectConversationByIdStmt = db.prepare(`
        SELECT id, user_id AS userId, feature, title, model, message_count AS messageCount,
               last_message_at AS lastMessageAt, created_at AS createdAt, updated_at AS updatedAt,
               archived_at AS archivedAt,
               (
                   SELECT content
                   FROM conversation_messages
                   WHERE conversation_id = conversations.id
                   ORDER BY created_at DESC, id DESC
                   LIMIT 1
               ) AS preview
        FROM conversations
        WHERE id = ? AND user_id = ? AND archived_at IS NULL
    `);
    const selectArchivedConversationByIdStmt = db.prepare(`
        SELECT id, user_id AS userId, feature, title, model, message_count AS messageCount,
               last_message_at AS lastMessageAt, created_at AS createdAt, updated_at AS updatedAt,
               archived_at AS archivedAt,
               (
                   SELECT content
                   FROM conversation_messages
                   WHERE conversation_id = conversations.id
                   ORDER BY created_at DESC, id DESC
                   LIMIT 1
               ) AS preview
        FROM conversations
        WHERE id = ? AND user_id = ? AND archived_at IS NOT NULL
    `);
    const listConversationsStmt = db.prepare(`
        SELECT id, user_id AS userId, feature, title, model, message_count AS messageCount,
               last_message_at AS lastMessageAt, created_at AS createdAt, updated_at AS updatedAt,
               archived_at AS archivedAt,
               (
                   SELECT content
                   FROM conversation_messages
                   WHERE conversation_id = conversations.id
                   ORDER BY created_at DESC, id DESC
                   LIMIT 1
               ) AS preview
        FROM conversations
        WHERE user_id = ? AND archived_at IS NULL
        ORDER BY COALESCE(last_message_at, created_at) DESC, updated_at DESC
        LIMIT ?
    `);
    const listArchivedConversationsStmt = db.prepare(`
        SELECT id, user_id AS userId, feature, title, model, message_count AS messageCount,
               last_message_at AS lastMessageAt, created_at AS createdAt, updated_at AS updatedAt,
               archived_at AS archivedAt,
               (
                   SELECT content
                   FROM conversation_messages
                   WHERE conversation_id = conversations.id
                   ORDER BY created_at DESC, id DESC
                   LIMIT 1
               ) AS preview
        FROM conversations
        WHERE user_id = ? AND archived_at IS NOT NULL
        ORDER BY archived_at DESC, updated_at DESC
        LIMIT ?
    `);
    const insertConversationStmt = db.prepare(`
        INSERT INTO conversations (
            id, user_id, feature, title, model, message_count, last_message_at, created_at, updated_at, archived_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
    `);
    const updateConversationStmt = db.prepare(`
        UPDATE conversations
        SET title = ?, model = ?, message_count = ?, last_message_at = ?, updated_at = ?
        WHERE id = ? AND user_id = ? AND archived_at IS NULL
    `);
    const archiveConversationStmt = db.prepare(`
        UPDATE conversations
        SET archived_at = ?, updated_at = ?
        WHERE id = ? AND user_id = ? AND archived_at IS NULL
    `);
    const restoreConversationStmt = db.prepare(`
        UPDATE conversations
        SET archived_at = NULL, updated_at = ?
        WHERE id = ? AND user_id = ? AND archived_at IS NOT NULL
    `);
    const deleteArchivedConversationStmt = db.prepare(`
        DELETE FROM conversations
        WHERE id = ? AND user_id = ? AND archived_at IS NOT NULL
    `);
    const listConversationMessagesStmt = db.prepare(`
        SELECT id, conversation_id AS conversationId, role, content, tokens_json AS tokensJson,
               metadata_json AS metadataJson, created_at AS createdAt
        FROM conversation_messages
        WHERE conversation_id = ?
        ORDER BY created_at ASC, id ASC
        LIMIT ?
    `);
    const selectConversationMessageByIdStmt = db.prepare(`
        SELECT id, conversation_id AS conversationId, role, content, tokens_json AS tokensJson,
               metadata_json AS metadataJson, created_at AS createdAt
        FROM conversation_messages
        WHERE id = ? AND conversation_id = ?
        LIMIT 1
    `);
    const insertConversationMessageStmt = db.prepare(`
        INSERT INTO conversation_messages (id, conversation_id, role, content, tokens_json, metadata_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const updateConversationMessageMetadataStmt = db.prepare(`
        UPDATE conversation_messages
        SET metadata_json = ?
        WHERE id = ? AND conversation_id = ?
    `);
    const countSystemTemplatesStmt = db.prepare(`SELECT COUNT(*) AS count FROM system_templates`);
    const insertSystemTemplateStmt = db.prepare(`
        INSERT INTO system_templates (id, feature, category, label, description, payload, sort_order, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            feature = excluded.feature,
            category = excluded.category,
            label = excluded.label,
            description = excluded.description,
            payload = excluded.payload,
            sort_order = excluded.sort_order,
            updated_at = excluded.updated_at
    `);
    const selectSystemTemplatesStmt = db.prepare(`
        SELECT id, feature, category, label, description, payload, sort_order AS sortOrder
        FROM system_templates
        WHERE feature = ?
        ORDER BY sort_order ASC, category ASC, label ASC
    `);
    const insertUserTemplateStmt = db.prepare(`
        INSERT INTO user_templates (id, user_id, feature, category, label, description, payload, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const selectUserTemplatesStmt = db.prepare(`
        SELECT id, user_id AS userId, feature, category, label, description, payload, created_at AS createdAt
        FROM user_templates
        WHERE user_id = ? AND feature = ?
        ORDER BY created_at DESC
    `);
    const getTemplateFavoriteStmt = db.prepare(`
        SELECT created_at AS createdAt
        FROM user_template_favorites
        WHERE user_id = ? AND template_kind = ? AND template_id = ?
    `);
    const insertTemplateFavoriteStmt = db.prepare(`
        INSERT INTO user_template_favorites (user_id, feature, template_kind, template_id, created_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(user_id, template_kind, template_id) DO NOTHING
    `);
    const deleteTemplateFavoriteStmt = db.prepare(`
        DELETE FROM user_template_favorites
        WHERE user_id = ? AND template_kind = ? AND template_id = ?
    `);
    const listTemplateFavoritesStmt = db.prepare(`
        SELECT template_kind AS templateKind, template_id AS templateId
        FROM user_template_favorites
        WHERE user_id = ? AND feature = ?
    `);
    const insertTaskStmt = db.prepare(`
        INSERT INTO tasks (
            task_id, user_id, feature, status, progress, input_payload, output_payload, error, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(task_id) DO UPDATE SET
            user_id = excluded.user_id,
            feature = excluded.feature,
            status = excluded.status,
            progress = excluded.progress,
            input_payload = excluded.input_payload,
            output_payload = excluded.output_payload,
            error = excluded.error,
            updated_at = excluded.updated_at
    `);
    const getTaskStmt = db.prepare(`
        SELECT task_id AS taskId, user_id AS userId, feature, status, progress, input_payload AS inputPayload,
               output_payload AS outputPayload, error, created_at AS createdAt, updated_at AS updatedAt
        FROM tasks
        WHERE task_id = ?
    `);
    const updateTaskStmt = db.prepare(`
        UPDATE tasks
        SET status = ?, progress = ?, output_payload = ?, error = ?, updated_at = ?
        WHERE task_id = ?
    `);
    const markInterruptedTasksStmt = db.prepare(`
        UPDATE tasks
        SET status = 'error',
            error = COALESCE(error, 'Server restarted before task completion'),
            updated_at = ?
        WHERE status IN ('pending', 'processing')
    `);
    const insertAuditLogStmt = db.prepare(`
        INSERT INTO audit_logs (
            action, actor_user_id, target_user_id, actor_username, target_username,
            actor_role, target_role, actor_ip, actor_user_agent, details_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const listAuditLogsStmt = db.prepare(`
        SELECT id, action, actor_user_id AS actorUserId, target_user_id AS targetUserId,
               actor_username AS actorUsername, target_username AS targetUsername,
               actor_role AS actorRole, target_role AS targetRole, actor_ip AS actorIp,
               actor_user_agent AS actorUserAgent, details_json AS detailsJson,
               created_at AS createdAt
        FROM audit_logs
        ORDER BY created_at DESC, id DESC
        LIMIT ?
    `);

    function runInTransaction(work) {
        db.exec('BEGIN');
        try {
            const result = work();
            db.exec('COMMIT');
            return result;
        } catch (error) {
            db.exec('ROLLBACK');
            throw error;
        }
    }

    function appendAuditLogRecord(event = {}) {
        const action = String(event.action || '').trim();
        if (!action) {
            throw new Error('audit action is required');
        }
        const createdAt = Number(event.createdAt || Date.now());
        insertAuditLogStmt.run(
            action,
            event.actorUserId || null,
            event.targetUserId || null,
            event.actorUsername || null,
            event.targetUsername || null,
            event.actorRole || null,
            event.targetRole || null,
            event.actorIp || null,
            event.actorUserAgent || null,
            JSON.stringify(event.details || {}),
            createdAt
        );
        return {
            action,
            actorUserId: event.actorUserId || null,
            targetUserId: event.targetUserId || null,
            actorUsername: event.actorUsername || null,
            targetUsername: event.targetUsername || null,
            actorRole: event.actorRole || null,
            targetRole: event.targetRole || null,
            actorIp: event.actorIp || null,
            actorUserAgent: event.actorUserAgent || null,
            details: event.details || {},
            createdAt
        };
    }

    function ensureSeedUser() {
        if (!seedUser?.username || !seedUser?.password) return;
        const existing = normalizeUserRecord(findUserByUsernameStmt.get(seedUser.username));
        const now = Date.now();
        if (!existing) {
            const userId = crypto.randomUUID();
            insertUserStmt.run(
                userId,
                seedUser.username,
                seedUser.email || null,
                seedUser.displayName || seedUser.username,
                'active',
                seedUser.role || 'admin',
                seedUser.planCode || 'internal',
                'Asia/Shanghai',
                'zh-CN',
                now,
                now
            );
            upsertCredentialStmt.run(userId, hashPassword(seedUser.password), now, 0);
            return;
        }

        if (!normalizeCredentialRecord(getCredentialStmt.get(existing.id))) {
            upsertCredentialStmt.run(existing.id, hashPassword(seedUser.password), now, 0);
        }
    }

    function migrateLegacyJsonIfNeeded() {
        if (!legacyFilePath || !fs.existsSync(legacyFilePath)) {
            return;
        }

        const hasRows = (countSessionsStmt.get().count || 0) > 0 || (countHistoryStmt.get().count || 0) > 0;
        if (hasRows) {
            return;
        }

        const legacy = safeParseJson(fs.readFileSync(legacyFilePath, 'utf8'), { sessions: {}, history: {} });
        db.exec('BEGIN');
        try {
            const defaultUser = normalizeUserRecord(findUserByUsernameStmt.get(seedUser?.username || 'studio'));
            Object.entries(legacy.sessions || {}).forEach(([token, session]) => {
                if (!token || !session?.username || !defaultUser || session.username !== defaultUser.username) return;
                insertSessionStmt.run(
                    crypto.randomUUID(),
                    defaultUser.id,
                    token,
                    Number(session.createdAt || Date.now()),
                    Number(session.createdAt || Date.now()),
                    Number(session.expiresAt || Date.now() + sessionTtlMs)
                );
            });

            Object.entries(legacy.history || {}).forEach(([username, features]) => {
                if (!defaultUser || username !== defaultUser.username) return;
                Object.entries(features || {}).forEach(([feature, entries]) => {
                    (entries || []).slice().reverse().forEach((entry, index) => {
                        insertHistoryStmt.run(
                            defaultUser.id,
                            feature,
                            JSON.stringify(entry),
                            Number(entry?.timestamp || Date.now() - index)
                        );
                    });
                });
            });
            db.exec('COMMIT');
        } catch (error) {
            db.exec('ROLLBACK');
            throw error;
        }
    }

    ensureSeedUser();
    migrateLegacyJsonIfNeeded();
    if ((countSystemTemplatesStmt.get().count || 0) === 0) {
        const now = Date.now();
        buildSystemTemplateSeed().forEach(template => {
            insertSystemTemplateStmt.run(
                template.id,
                template.feature,
                template.category,
                template.label,
                template.description,
                JSON.stringify(template.payload || {}),
                template.sortOrder,
                now,
                now
            );
        });
    }
    markInterruptedTasksStmt.run(Date.now());

    const stateStoreSnapshots = createStateStoreSnapshots({
        deleteExpiredSessionsStmt,
        deleteExpiredAuthTokensStmt,
        cleanupExpiredRateLimitEventsStmt,
        normalizeConversation,
        normalizeConversationMessage,
        buildConversationTimeline,
        selectConversationByIdStmt,
        listConversationMessagesStmt,
        selectConversationMessageByIdStmt
    });

    const stateStoreAuth = createStateStoreAuth({
        sessionTtlMs,
        LOGIN_FAILURE_LOCK_THRESHOLD,
        LOGIN_FAILURE_LOCK_MS,
        hashPassword,
        hashPasswordAsync,
        verifyPassword,
        verifyPasswordAsync,
        hashOpaqueToken,
        createOpaqueToken,
        normalizeUserRecord,
        normalizeCredentialRecord,
        normalizeAuthTokenRecord,
        buildAuthTokenSummary,
        cleanupExpiredSessions: stateStoreSnapshots.cleanupExpiredSessions,
        cleanupAuthTokens: stateStoreSnapshots.cleanupAuthTokens,
        runInTransaction,
        appendAuditLogRecord,
        getUserByUsername: username => normalizeUserRecord(findUserByUsernameStmt.get(username)),
        getUserById: userId => normalizeUserRecord(findUserByIdStmt.get(userId)),
        insertUserStmt,
        upsertCredentialStmt,
        findUserByUsernameStmt,
        getCredentialStmt,
        incrementFailedLoginStmt,
        resetFailedLoginStmt,
        updateUserLoginStmt,
        insertSessionStmt,
        getSessionStmt,
        deleteSessionStmt,
        deleteUserSessionsStmt,
        deleteUserSessionsExceptStmt,
        insertAuthTokenStmt,
        findAuthTokenByHashStmt,
        findLatestAuthTokenByUserPurposeStmt,
        findActiveAuthTokenByUserPurposeStmt,
        markAuthTokenUsedStmt,
        markUserPurposeTokensUsedStmt
    });

    const stateStoreMaintenance = createStateStoreMaintenance({
        runInTransaction,
        cleanupExpiredRateLimitEvents: stateStoreSnapshots.cleanupExpiredRateLimitEvents,
        countUsersStmt,
        countSessionsStmt,
        countActiveSessionsStmt,
        countAuthTokensStmt,
        countActiveAuthTokensStmt,
        countRateLimitEventsStmt,
        countHistoryStmt,
        countTasksStmt,
        countAuditLogsSummaryStmt,
        deleteAuditLogsBeforeStmt,
        selectRateLimitWindowStmt,
        insertRateLimitEventStmt
    });

    const stateStoreQueries = createStateStoreQueries({
        db,
        normalizeAuditLog,
        normalizeTemplateRow,
        groupTemplates,
        buildAuditLogQuery,
        listTemplateFavoritesStmt,
        selectSystemTemplatesStmt,
        selectUserTemplatesStmt,
        listAuditLogsStmt
    });

    const stateStoreConversations = createStateStoreConversations({
        normalizeConversation,
        normalizeConversationMessage,
        buildConversationTimeline,
        buildDisplayedConversationMessages,
        listConversationsStmt,
        listArchivedConversationsStmt,
        selectConversationByIdStmt,
        selectArchivedConversationByIdStmt,
        listConversationMessagesStmt,
        selectConversationMessageByIdStmt,
        updateConversationMessageMetadataStmt
    });

    const stateStoreUsers = createStateStoreUsers({
        normalizeUserRecord,
        runInTransaction,
        appendAuditLogRecord,
        findUserByUsernameStmt,
        findUserByIdStmt,
        findUserByEmailStmt,
        listUsersStmt,
        countActiveAdminsStmt,
        updateUserAdminStmt
    });

    const stateStoreMutations = createStateStoreMutations({
        db,
        maxHistoryItems,
        buildConversationTitle,
        normalizeConversationMessage,
        safeParseJson,
        normalizePreferences,
        normalizeTask,
        getUsageDate,
        groupTemplates,
        normalizeTemplateRow,
        getConversation: (userId, conversationId) => normalizeConversation(selectConversationByIdStmt.get(conversationId, userId)),
        getArchivedConversation: (userId, conversationId) => normalizeConversation(selectArchivedConversationByIdStmt.get(conversationId, userId)),
        getConversationMessage: stateStoreSnapshots.getConversationMessageSnapshot,
        getConversationTimeline: stateStoreSnapshots.getConversationTimelineSnapshot,
        getConversationMessages: (userId, conversationId, limit = 200) => {
            const timeline = stateStoreSnapshots.getConversationTimelineSnapshot(userId, conversationId, limit);
            if (!timeline) return null;
            return buildDisplayedConversationMessages(timeline);
        },
        getPreferences: userId => normalizePreferences(getPreferencesStmt.get(userId)),
        getUsageDaily: (userId, usageDate = getUsageDate()) => getUsageDailyStmt.get(userId, usageDate) || getEmptyUsage(usageDate),
        getTask: taskId => normalizeTask(getTaskStmt.get(taskId)),
        listTemplates: (feature, userId) => stateStoreQueries.listTemplates(feature, userId),
        insertConversationStmt,
        updateConversationStmt,
        archiveConversationStmt,
        restoreConversationStmt,
        deleteArchivedConversationStmt,
        insertConversationMessageStmt,
        listConversationMessagesStmt,
        insertHistoryStmt,
        pruneHistoryStmt,
        selectHistoryStmt,
        getPreferencesStmt,
        upsertPreferencesStmt,
        getUsageDailyStmt,
        upsertUsageStmt,
        insertTaskStmt,
        updateTaskStmt,
        getTaskStmt,
        listTemplateFavoritesStmt,
        selectSystemTemplatesStmt,
        selectUserTemplatesStmt,
        insertUserTemplateStmt,
        getTemplateFavoriteStmt,
        deleteTemplateFavoriteStmt,
        insertTemplateFavoriteStmt
    });

    return {
        getUserByUsername(username) {
            return stateStoreUsers.getUserByUsername(username);
        },

        getUserById(userId) {
            return stateStoreUsers.getUserById(userId);
        },

        getUserByEmail(email) {
            return stateStoreUsers.getUserByEmail(email);
        },

        listUsers() {
            return stateStoreUsers.listUsers();
        },

        countActiveAdmins() {
            return stateStoreUsers.countActiveAdmins();
        },

        createUser(user = {}, options = {}) {
            return stateStoreAuth.createUser(user, options);
        },

        async createUserAsync(user = {}, options = {}) {
            return stateStoreAuth.createUserAsync(user, options);
        },

        updateUser(userId, patch = {}, options = {}) {
            return stateStoreUsers.updateUser(userId, patch, options);
        },

        authenticateUser(username, password) {
            return stateStoreAuth.authenticateUser(username, password);
        },

        async authenticateUserAsync(username, password) {
            return stateStoreAuth.authenticateUserAsync(username, password);
        },

        getSession(token) {
            return stateStoreAuth.getSession(token);
        },

        createSession(user) {
            return stateStoreAuth.createSession(user);
        },

        clearSession(token) {
            return stateStoreAuth.clearSession(token);
        },

        issueUserToken(userId, purpose, options = {}) {
            return stateStoreAuth.issueUserToken(userId, purpose, options);
        },

        getUserToken(purpose, token) {
            return stateStoreAuth.getUserToken(purpose, token);
        },

        consumeUserToken(purpose, token) {
            return stateStoreAuth.consumeUserToken(purpose, token);
        },

        getLatestUserTokenSummary(userId, purpose) {
            return stateStoreAuth.getLatestUserTokenSummary(userId, purpose);
        },

        getActiveUserTokenSummary(userId, purpose) {
            return stateStoreAuth.getActiveUserTokenSummary(userId, purpose);
        },

        revokeUserTokens(userId, purpose) {
            return stateStoreAuth.revokeUserTokens(userId, purpose);
        },

        consumeRateLimit(ruleName, bucketKey, config = {}) {
            return stateStoreMaintenance.consumeRateLimit(ruleName, bucketKey, config);
        },

        isPasswordResetRequired(userId) {
            return Boolean(normalizeCredentialRecord(getCredentialStmt.get(userId))?.mustResetPassword);
        },

        changeCurrentUserPassword(userId, currentPassword, nextPassword, options = {}) {
            return stateStoreAuth.changeCurrentUserPassword(userId, currentPassword, nextPassword, options);
        },

        async changeCurrentUserPasswordAsync(userId, currentPassword, nextPassword, options = {}) {
            return stateStoreAuth.changeCurrentUserPasswordAsync(userId, currentPassword, nextPassword, options);
        },

        resetUserPassword(userId, password, options = {}) {
            return stateStoreAuth.resetUserPassword(userId, password, options);
        },

        async resetUserPasswordAsync(userId, password, options = {}) {
            return stateStoreAuth.resetUserPasswordAsync(userId, password, options);
        },

        listConversations(userId, limit = 40) {
            return stateStoreConversations.listConversations(userId, limit);
        },

        listArchivedConversations(userId, limit = 40) {
            return stateStoreConversations.listArchivedConversations(userId, limit);
        },

        createConversation(userId, payload = {}) {
            return stateStoreMutations.createConversation(userId, payload);
        },

        getConversation(userId, conversationId) {
            return stateStoreConversations.getConversation(userId, conversationId);
        },

        getArchivedConversation(userId, conversationId) {
            return stateStoreConversations.getArchivedConversation(userId, conversationId);
        },

        updateConversation(userId, conversationId, payload = {}) {
            return stateStoreMutations.updateConversation(userId, conversationId, payload);
        },

        archiveConversation(userId, conversationId) {
            return stateStoreMutations.archiveConversation(userId, conversationId);
        },

        restoreConversation(userId, conversationId) {
            return stateStoreMutations.restoreConversation(userId, conversationId);
        },

        deleteArchivedConversation(userId, conversationId) {
            return stateStoreMutations.deleteArchivedConversation(userId, conversationId);
        },

        getConversationMessageTimeline(userId, conversationId, limit = 400) {
            return stateStoreConversations.getConversationMessageTimeline(userId, conversationId, limit);
        },

        getConversationMessages(userId, conversationId, limit = 200) {
            return stateStoreConversations.getConversationMessages(userId, conversationId, limit);
        },

        getConversationMessage(userId, conversationId, messageId) {
            return stateStoreConversations.getConversationMessage(userId, conversationId, messageId);
        },

        getConversationPromptMessages(userId, conversationId, options = {}) {
            return stateStoreConversations.getConversationPromptMessages(userId, conversationId, options);
        },

        setConversationTurnActiveAssistant(userId, conversationId, assistantMessageId) {
            return stateStoreConversations.setConversationTurnActiveAssistant(userId, conversationId, assistantMessageId);
        },

        appendConversationMessage(userId, conversationId, message = {}) {
            return stateStoreMutations.appendConversationMessage(userId, conversationId, message);
        },

        getHistory(userId, feature) {
            return stateStoreMutations.getHistory(userId, feature);
        },

        appendHistory(userId, feature, entry) {
            return stateStoreMutations.appendHistory(userId, feature, entry);
        },

        getPreferences(userId) {
            return normalizePreferences(getPreferencesStmt.get(userId));
        },

        getOrCreatePreferences(userId) {
            return this.getPreferences(userId);
        },

        updatePreferences(userId, patch = {}) {
            return stateStoreMutations.updatePreferences(userId, patch);
        },

        getUsageDaily(userId, usageDate = getUsageDate()) {
            return getUsageDailyStmt.get(userId, usageDate) || getEmptyUsage(usageDate);
        },

        incrementUsageDaily(userId, feature, metrics = {}) {
            return stateStoreMutations.incrementUsageDaily(userId, feature, metrics);
        },

        createTask(task) {
            return stateStoreMutations.createTask(task);
        },

        updateTask(taskId, patch = {}) {
            return stateStoreMutations.updateTask(taskId, patch);
        },

        getTask(taskId) {
            return normalizeTask(getTaskStmt.get(taskId));
        },

        listTemplates(feature, userId) {
            return stateStoreQueries.listTemplates(feature, userId);
        },

        createUserTemplate(userId, feature, template) {
            return stateStoreMutations.createUserTemplate(userId, feature, template);
        },

        toggleTemplateFavorite(userId, feature, templateId) {
            return stateStoreMutations.toggleTemplateFavorite(userId, feature, templateId);
        },

        appendAuditLog(event = {}) {
            return stateStoreUsers.appendAuditLog(event);
        },

        listAuditLogs(limit = 100) {
            return stateStoreQueries.listAuditLogs(limit);
        },

        queryAuditLogs(filters = {}) {
            return stateStoreQueries.queryAuditLogs(filters);
        },

        getMaintenanceSummary(options = {}) {
            const now = Number(options.now || Date.now());
            return stateStoreMaintenance.getMaintenanceSummary(now);
        },

        pruneAuditLogs(options = {}) {
            return stateStoreMaintenance.pruneAuditLogs(options);
        },

        close() {
            db.close();
        }
    };
}

module.exports = {
    createStateStore
};
