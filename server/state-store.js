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

    function cleanupExpiredSessions() {
        deleteExpiredSessionsStmt.run(Date.now());
    }

    function cleanupAuthTokens(now = Date.now()) {
        deleteExpiredAuthTokensStmt.run(now);
    }

    function cleanupExpiredRateLimitEvents(now = Date.now()) {
        cleanupExpiredRateLimitEventsStmt.run(now);
    }

    function getMaintenanceSummary(now = Date.now()) {
        const auditLogs = countAuditLogsSummaryStmt.get() || {};
        return {
            users: Number(countUsersStmt.get()?.count || 0),
            sessions: {
                total: Number(countSessionsStmt.get()?.count || 0),
                active: Number(countActiveSessionsStmt.get(now)?.count || 0)
            },
            authTokens: {
                total: Number(countAuthTokensStmt.get()?.count || 0),
                active: Number(countActiveAuthTokensStmt.get(now)?.count || 0)
            },
            rateLimitEvents: Number(countRateLimitEventsStmt.get()?.count || 0),
            historyEntries: Number(countHistoryStmt.get()?.count || 0),
            tasks: Number(countTasksStmt.get()?.count || 0),
            auditLogs: {
                total: Number(auditLogs.count || 0),
                oldestCreatedAt: auditLogs.oldestCreatedAt || null,
                newestCreatedAt: auditLogs.newestCreatedAt || null
            }
        };
    }

    function pruneAuditLogs({ olderThanDays, now = Date.now() } = {}) {
        const retentionDays = Number(olderThanDays || 0);
        if (!Number.isFinite(retentionDays) || retentionDays <= 0) {
            throw new Error('olderThanDays must be a positive number');
        }
        const cutoff = now - (retentionDays * 24 * 60 * 60 * 1000);
        const result = deleteAuditLogsBeforeStmt.run(cutoff);
        return {
            olderThanDays: retentionDays,
            cutoff,
            deletedCount: Number(result?.changes || 0)
        };
    }

    return {
        getUserByUsername(username) {
            return normalizeUserRecord(findUserByUsernameStmt.get(username));
        },

        getUserById(userId) {
            return normalizeUserRecord(findUserByIdStmt.get(userId));
        },

        getUserByEmail(email) {
            return normalizeUserRecord(findUserByEmailStmt.get(email));
        },

        listUsers() {
            return listUsersStmt.all().map(row => normalizeUserRecord(row));
        },

        countActiveAdmins() {
            return Number(countActiveAdminsStmt.get()?.count || 0);
        },

        createUser(user = {}, options = {}) {
            const username = String(user.username || '').trim();
            const password = String(user.password || '').trim();
            if (!username || !password) {
                throw new Error('username and password are required');
            }
            const existing = this.getUserByUsername(username);
            if (existing) return existing;

            const now = Date.now();
            const userId = crypto.randomUUID();
            return runInTransaction(() => {
                insertUserStmt.run(
                    userId,
                    username,
                    user.email || null,
                    user.displayName || username,
                    user.status || 'active',
                    user.role || 'user',
                    user.planCode || 'free',
                    user.timezone || 'Asia/Shanghai',
                    user.locale || 'zh-CN',
                    now,
                    now
                );
                upsertCredentialStmt.run(userId, hashPassword(password), now, user.mustResetPassword ? 1 : 0);
                const createdUser = this.getUserById(userId);
                if (options.auditLog && createdUser) {
                    appendAuditLogRecord({
                        ...options.auditLog,
                        targetUserId: options.auditLog.targetUserId || createdUser.id,
                        targetUsername: options.auditLog.targetUsername || createdUser.username,
                        targetRole: options.auditLog.targetRole || createdUser.role
                    });
                }
                return createdUser;
            });
        },

        async createUserAsync(user = {}, options = {}) {
            const username = String(user.username || '').trim();
            const password = String(user.password || '').trim();
            if (!username || !password) {
                throw new Error('username and password are required');
            }
            const existing = this.getUserByUsername(username);
            if (existing) return existing;

            const passwordHash = await hashPasswordAsync(password);
            const now = Date.now();
            const userId = crypto.randomUUID();
            return runInTransaction(() => {
                insertUserStmt.run(
                    userId,
                    username,
                    user.email || null,
                    user.displayName || username,
                    user.status || 'active',
                    user.role || 'user',
                    user.planCode || 'free',
                    user.timezone || 'Asia/Shanghai',
                    user.locale || 'zh-CN',
                    now,
                    now
                );
                upsertCredentialStmt.run(userId, passwordHash, now, user.mustResetPassword ? 1 : 0);
                const createdUser = this.getUserById(userId);
                if (options.auditLog && createdUser) {
                    appendAuditLogRecord({
                        ...options.auditLog,
                        targetUserId: options.auditLog.targetUserId || createdUser.id,
                        targetUsername: options.auditLog.targetUsername || createdUser.username,
                        targetRole: options.auditLog.targetRole || createdUser.role
                    });
                }
                return createdUser;
            });
        },

        updateUser(userId, patch = {}, options = {}) {
            const current = this.getUserById(userId);
            if (!current) return null;

            const next = {
                email: Object.prototype.hasOwnProperty.call(patch, 'email') ? (patch.email || null) : current.email,
                status: patch.status || current.status,
                role: patch.role || current.role,
                planCode: patch.planCode || current.planCode
            };

            if (!['active', 'disabled'].includes(next.status)) {
                throw new Error('invalid status');
            }
            if (!['admin', 'user'].includes(next.role)) {
                throw new Error('invalid role');
            }

            return runInTransaction(() => {
                updateUserAdminStmt.run(
                    next.email,
                    next.status,
                    next.role,
                    next.planCode,
                    Date.now(),
                    userId
                );
                const updatedUser = this.getUserById(userId);
                (options.auditLogs || []).filter(Boolean).forEach(event => {
                    appendAuditLogRecord({
                        ...event,
                        targetUserId: event.targetUserId || updatedUser?.id || current.id,
                        targetUsername: event.targetUsername || updatedUser?.username || current.username,
                        targetRole: event.targetRole || updatedUser?.role || next.role
                    });
                });
                return updatedUser;
            });
        },

        authenticateUser(username, password) {
            const user = normalizeUserRecord(findUserByUsernameStmt.get(username));
            if (!user) return null;
            if (user.status !== 'active') {
                return {
                    errorCode: 'user_disabled',
                    error: '账号已被禁用，请联系管理员',
                    status: 403
                };
            }
            const credential = normalizeCredentialRecord(getCredentialStmt.get(user.id));
            const now = Date.now();
            if (!credential) return null;
            if (credential.lockedUntil && credential.lockedUntil > now) {
                return {
                    errorCode: 'login_locked',
                    error: '账号已被临时锁定，请 15 分钟后重试',
                    status: 423
                };
            }
            if (!verifyPassword(password, credential.passwordHash)) {
                const failedCount = Number(credential.failedLoginCount || 0) + 1;
                const lockedUntil = failedCount >= LOGIN_FAILURE_LOCK_THRESHOLD ? now + LOGIN_FAILURE_LOCK_MS : null;
                incrementFailedLoginStmt.run(LOGIN_FAILURE_LOCK_THRESHOLD, lockedUntil, user.id);
                if (lockedUntil) {
                    return {
                        errorCode: 'login_locked',
                        error: '账号已被临时锁定，请 15 分钟后重试',
                        status: 423
                    };
                }
                return null;
            }
            resetFailedLoginStmt.run(user.id);
            updateUserLoginStmt.run(now, now, user.id);
            user.lastLoginAt = now;
            user.mustResetPassword = Boolean(credential.mustResetPassword);
            return user;
        },

        async authenticateUserAsync(username, password) {
            const user = normalizeUserRecord(findUserByUsernameStmt.get(username));
            if (!user) return null;
            if (user.status !== 'active') {
                return {
                    errorCode: 'user_disabled',
                    error: '账号已被禁用，请联系管理员',
                    status: 403
                };
            }
            const credential = normalizeCredentialRecord(getCredentialStmt.get(user.id));
            const now = Date.now();
            if (!credential) return null;
            if (credential.lockedUntil && credential.lockedUntil > now) {
                return {
                    errorCode: 'login_locked',
                    error: '账号已被临时锁定，请 15 分钟后重试',
                    status: 423
                };
            }
            const verified = await verifyPasswordAsync(password, credential.passwordHash);
            if (!verified) {
                incrementFailedLoginStmt.run(LOGIN_FAILURE_LOCK_THRESHOLD, now + LOGIN_FAILURE_LOCK_MS, user.id);
                const updatedCredential = normalizeCredentialRecord(getCredentialStmt.get(user.id));
                if (updatedCredential?.lockedUntil && updatedCredential.lockedUntil > now) {
                    return {
                        errorCode: 'login_locked',
                        error: '账号已被临时锁定，请 15 分钟后重试',
                        status: 423
                    };
                }
                return null;
            }
            resetFailedLoginStmt.run(user.id);
            updateUserLoginStmt.run(now, now, user.id);
            user.lastLoginAt = now;
            user.mustResetPassword = Boolean(credential.mustResetPassword);
            return user;
        },

        getSession(token) {
            if (!token) return null;
            cleanupExpiredSessions();
            const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
            return getSessionStmt.get(tokenHash) || null;
        },

        createSession(user) {
            cleanupExpiredSessions();
            const token = require('crypto').randomBytes(24).toString('hex');
            const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
            const createdAt = Date.now();
            const expiresAt = createdAt + sessionTtlMs;
            insertSessionStmt.run(crypto.randomUUID(), user.id, tokenHash, createdAt, createdAt, expiresAt);
            return { token, userId: user.id, username: user.username, createdAt, expiresAt };
        },

        clearSession(token) {
            if (!token) return;
            const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
            deleteSessionStmt.run(tokenHash);
        },

        issueUserToken(userId, purpose, options = {}) {
            const user = this.getUserById(userId);
            if (!user) return null;

            const ttlMs = Math.max(60 * 1000, Number(options.ttlMs || 60 * 60 * 1000));
            return runInTransaction(() => {
                const now = Date.now();
                cleanupAuthTokens(now);
                markUserPurposeTokensUsedStmt.run(now, userId, purpose);
                const token = createOpaqueToken();
                const expiresAt = now + ttlMs;
                insertAuthTokenStmt.run(
                    crypto.randomUUID(),
                    userId,
                    purpose,
                    hashOpaqueToken(token),
                    options.requestedIdentity || user.username,
                    options.createdByUserId || null,
                    JSON.stringify(options.metadata || {}),
                    now,
                    expiresAt
                );
                return {
                    token,
                    userId,
                    purpose,
                    requestedIdentity: options.requestedIdentity || user.username,
                    metadata: options.metadata || {},
                    createdAt: now,
                    expiresAt
                };
            });
        },

        getUserToken(purpose, token) {
            const rawToken = String(token || '').trim();
            if (!rawToken) return null;
            const now = Date.now();
            cleanupAuthTokens(now);
            const record = normalizeAuthTokenRecord(findAuthTokenByHashStmt.get(purpose, hashOpaqueToken(rawToken)));
            if (!record || record.usedAt || record.expiresAt < now) {
                return null;
            }
            const user = this.getUserById(record.userId);
            if (!user) return null;
            return {
                ...record,
                user
            };
        },

        consumeUserToken(purpose, token) {
            const rawToken = String(token || '').trim();
            if (!rawToken) return null;
            return runInTransaction(() => {
                const now = Date.now();
                cleanupAuthTokens(now);
                const record = normalizeAuthTokenRecord(findAuthTokenByHashStmt.get(purpose, hashOpaqueToken(rawToken)));
                if (!record || record.usedAt || record.expiresAt < now) {
                    return null;
                }
                const user = this.getUserById(record.userId);
                if (!user) return null;
                const result = markAuthTokenUsedStmt.run(now, record.id);
                if (Number(result?.changes || 0) < 1) {
                    return null;
                }
                return {
                    ...record,
                    usedAt: now,
                    user
                };
            });
        },

        getLatestUserTokenSummary(userId, purpose) {
            if (!userId || !purpose) return null;
            const now = Date.now();
            cleanupAuthTokens(now);
            const record = normalizeAuthTokenRecord(findLatestAuthTokenByUserPurposeStmt.get(userId, purpose));
            return buildAuthTokenSummary(record, { now });
        },

        getActiveUserTokenSummary(userId, purpose) {
            if (!userId || !purpose) return null;
            const now = Date.now();
            cleanupAuthTokens(now);
            const record = normalizeAuthTokenRecord(findActiveAuthTokenByUserPurposeStmt.get(userId, purpose, now));
            return buildAuthTokenSummary(record, { now, status: record ? 'active' : null });
        },

        revokeUserTokens(userId, purpose) {
            if (!userId || !purpose) {
                return {
                    revoked: false,
                    count: 0,
                    summary: null
                };
            }
            return runInTransaction(() => {
                const now = Date.now();
                cleanupAuthTokens(now);
                const record = normalizeAuthTokenRecord(findActiveAuthTokenByUserPurposeStmt.get(userId, purpose, now));
                if (!record) {
                    return {
                        revoked: false,
                        count: 0,
                        summary: null
                    };
                }
                const result = markUserPurposeTokensUsedStmt.run(now, userId, purpose);
                return {
                    revoked: Number(result?.changes || 0) > 0,
                    count: Number(result?.changes || 0),
                    summary: buildAuthTokenSummary({
                        ...record,
                        usedAt: now
                    }, { now, status: 'revoked' })
                };
            });
        },

        consumeRateLimit(ruleName, bucketKey, config = {}) {
            const max = Math.max(0, Number(config.max || 0));
            const windowMs = Math.max(0, Number(config.windowMs || 0));
            if (!max || !windowMs) {
                return { allowed: true, retryAfterSeconds: 0 };
            }

            const normalizedRuleName = String(ruleName || '').trim();
            const normalizedBucketKey = String(bucketKey || '').trim() || 'anonymous';
            return runInTransaction(() => {
                const now = Date.now();
                cleanupExpiredRateLimitEvents(now);
                const currentWindow = selectRateLimitWindowStmt.get(
                    normalizedRuleName,
                    normalizedBucketKey,
                    now - windowMs
                ) || {};
                const eventCount = Number(currentWindow.count || 0);
                const oldestCreatedAt = Number(currentWindow.oldestCreatedAt || 0);

                if (eventCount >= max) {
                    return {
                        allowed: false,
                        retryAfterSeconds: Math.max(1, Math.ceil((windowMs - (now - oldestCreatedAt)) / 1000))
                    };
                }

                insertRateLimitEventStmt.run(
                    normalizedRuleName,
                    normalizedBucketKey,
                    now,
                    now + windowMs
                );
                return {
                    allowed: true,
                    retryAfterSeconds: 0
                };
            });
        },

        isPasswordResetRequired(userId) {
            return Boolean(normalizeCredentialRecord(getCredentialStmt.get(userId))?.mustResetPassword);
        },

        changeCurrentUserPassword(userId, currentPassword, nextPassword, options = {}) {
            const user = this.getUserById(userId);
            if (!user) return null;

            const credential = normalizeCredentialRecord(getCredentialStmt.get(userId));
            if (!credential) {
                return {
                    errorCode: 'credential_missing',
                    error: '当前账号暂时无法修改密码',
                    status: 409
                };
            }

            if (!verifyPassword(currentPassword, credential.passwordHash)) {
                return {
                    errorCode: 'current_password_incorrect',
                    error: '当前密码不正确',
                    status: 400
                };
            }

            if (verifyPassword(nextPassword, credential.passwordHash)) {
                return {
                    errorCode: 'password_unchanged',
                    error: '新密码不能与当前密码相同',
                    status: 400
                };
            }

            const now = Date.now();
            upsertCredentialStmt.run(userId, hashPassword(nextPassword), now, 0);
            if (options.keepSessionId) {
                deleteUserSessionsExceptStmt.run(userId, options.keepSessionId);
            } else {
                deleteUserSessionsStmt.run(userId);
            }
            return this.getUserById(userId);
        },

        async changeCurrentUserPasswordAsync(userId, currentPassword, nextPassword, options = {}) {
            const user = this.getUserById(userId);
            if (!user) return null;

            const credential = normalizeCredentialRecord(getCredentialStmt.get(userId));
            if (!credential) {
                return {
                    errorCode: 'credential_missing',
                    error: '当前账号暂时无法修改密码',
                    status: 409
                };
            }

            if (!await verifyPasswordAsync(currentPassword, credential.passwordHash)) {
                return {
                    errorCode: 'current_password_incorrect',
                    error: '当前密码不正确',
                    status: 400
                };
            }

            if (await verifyPasswordAsync(nextPassword, credential.passwordHash)) {
                return {
                    errorCode: 'password_unchanged',
                    error: '新密码不能与当前密码相同',
                    status: 400
                };
            }

            const now = Date.now();
            const nextPasswordHash = await hashPasswordAsync(nextPassword);
            upsertCredentialStmt.run(userId, nextPasswordHash, now, 0);
            if (options.keepSessionId) {
                deleteUserSessionsExceptStmt.run(userId, options.keepSessionId);
            } else {
                deleteUserSessionsStmt.run(userId);
            }
            return this.getUserById(userId);
        },

        resetUserPassword(userId, password, options = {}) {
            const user = this.getUserById(userId);
            if (!user) return null;

            const nextPassword = String(password || '');
            if (!nextPassword.trim()) {
                throw new Error('password is required');
            }

            return runInTransaction(() => {
                const now = Date.now();
                upsertCredentialStmt.run(userId, hashPassword(nextPassword), now, options.requirePasswordChange ? 1 : 0);
                if (options.keepSessionId) {
                    deleteUserSessionsExceptStmt.run(userId, options.keepSessionId);
                } else {
                    deleteUserSessionsStmt.run(userId);
                }
                const updatedUser = this.getUserById(userId);
                if (options.auditLog && updatedUser) {
                    appendAuditLogRecord({
                        ...options.auditLog,
                        targetUserId: options.auditLog.targetUserId || updatedUser.id,
                        targetUsername: options.auditLog.targetUsername || updatedUser.username,
                        targetRole: options.auditLog.targetRole || updatedUser.role
                    });
                }
                return updatedUser;
            });
        },

        async resetUserPasswordAsync(userId, password, options = {}) {
            const user = this.getUserById(userId);
            if (!user) return null;

            const nextPassword = String(password || '');
            if (!nextPassword.trim()) {
                throw new Error('password is required');
            }

            const nextPasswordHash = await hashPasswordAsync(nextPassword);
            return runInTransaction(() => {
                const now = Date.now();
                upsertCredentialStmt.run(userId, nextPasswordHash, now, options.requirePasswordChange ? 1 : 0);
                if (options.keepSessionId) {
                    deleteUserSessionsExceptStmt.run(userId, options.keepSessionId);
                } else {
                    deleteUserSessionsStmt.run(userId);
                }
                const updatedUser = this.getUserById(userId);
                if (options.auditLog && updatedUser) {
                    appendAuditLogRecord({
                        ...options.auditLog,
                        targetUserId: options.auditLog.targetUserId || updatedUser.id,
                        targetUsername: options.auditLog.targetUsername || updatedUser.username,
                        targetRole: options.auditLog.targetRole || updatedUser.role
                    });
                }
                return updatedUser;
            });
        },

        listConversations(userId, limit = 40) {
            return listConversationsStmt.all(userId, Number(limit || 40))
                .map(row => normalizeConversation(row))
                .filter(Boolean);
        },

        listArchivedConversations(userId, limit = 40) {
            return listArchivedConversationsStmt.all(userId, Number(limit || 40))
                .map(row => normalizeConversation(row))
                .filter(Boolean);
        },

        createConversation(userId, payload = {}) {
            const now = Date.now();
            const id = `conv_${crypto.randomUUID()}`;
            insertConversationStmt.run(
                id,
                userId,
                'chat',
                buildConversationTitle(payload.title || '新对话'),
                payload.model || 'gpt-4.1-mini',
                0,
                null,
                now,
                now
            );
            return this.getConversation(userId, id);
        },

        getConversation(userId, conversationId) {
            return normalizeConversation(selectConversationByIdStmt.get(conversationId, userId));
        },

        getArchivedConversation(userId, conversationId) {
            return normalizeConversation(selectArchivedConversationByIdStmt.get(conversationId, userId));
        },

        updateConversation(userId, conversationId, payload = {}) {
            const conversation = this.getConversation(userId, conversationId);
            if (!conversation) return null;

            const nextTitle = Object.prototype.hasOwnProperty.call(payload, 'title')
                ? buildConversationTitle(payload.title)
                : conversation.title;
            const nextModel = Object.prototype.hasOwnProperty.call(payload, 'model') && String(payload.model || '').trim()
                ? String(payload.model || '').trim()
                : conversation.model;
            const now = Date.now();

            updateConversationStmt.run(
                nextTitle,
                nextModel,
                conversation.messageCount,
                conversation.lastMessageAt,
                now,
                conversationId,
                userId
            );

            return this.getConversation(userId, conversationId);
        },

        archiveConversation(userId, conversationId) {
            const conversation = this.getConversation(userId, conversationId);
            if (!conversation) return null;

            const now = Date.now();
            archiveConversationStmt.run(now, now, conversationId, userId);
            return this.getArchivedConversation(userId, conversationId);
        },

        restoreConversation(userId, conversationId) {
            const conversation = this.getArchivedConversation(userId, conversationId);
            if (!conversation) return null;

            const now = Date.now();
            restoreConversationStmt.run(now, conversationId, userId);
            return this.getConversation(userId, conversationId);
        },

        deleteArchivedConversation(userId, conversationId) {
            const conversation = this.getArchivedConversation(userId, conversationId);
            if (!conversation) return null;

            deleteArchivedConversationStmt.run(conversationId, userId);
            return conversation;
        },

        getConversationMessageTimeline(userId, conversationId, limit = 400) {
            const conversation = this.getConversation(userId, conversationId);
            if (!conversation) return null;
            return buildConversationTimeline(
                listConversationMessagesStmt.all(conversationId, Number(limit || 400))
                    .map(row => normalizeConversationMessage(row))
                    .filter(Boolean)
            );
        },

        getConversationMessages(userId, conversationId, limit = 200) {
            const timeline = this.getConversationMessageTimeline(userId, conversationId, limit);
            if (!timeline) return null;
            return buildDisplayedConversationMessages(timeline);
        },

        getConversationMessage(userId, conversationId, messageId) {
            const conversation = this.getConversation(userId, conversationId);
            if (!conversation || !messageId) return null;

            const row = selectConversationMessageByIdStmt.get(messageId, conversationId);
            if (!row) return null;

            const message = normalizeConversationMessage(row);
            if (!message) return null;

            const timeline = this.getConversationMessageTimeline(userId, conversationId, 400) || [];
            return timeline.find(item => item.id === message.id) || message;
        },

        getConversationPromptMessages(userId, conversationId, options = {}) {
            const displayedMessages = this.getConversationMessages(userId, conversationId, 400);
            if (!displayedMessages) return null;

            const targetTurnId = options.untilTurnId ? String(options.untilTurnId) : '';
            const promptMessages = [];

            for (const message of displayedMessages) {
                promptMessages.push({
                    role: message.role,
                    content: message.content
                });

                if (targetTurnId && message.role === 'user' && String(message.metadata?.turnId || '') === targetTurnId) {
                    break;
                }
            }

            return promptMessages;
        },

        setConversationTurnActiveAssistant(userId, conversationId, assistantMessageId) {
            const timeline = this.getConversationMessageTimeline(userId, conversationId, 400);
            if (!timeline || !assistantMessageId) return null;

            const assistantMessage = timeline.find(item => item.id === assistantMessageId && item.role === 'assistant');
            if (!assistantMessage) return null;

            const turnId = String(assistantMessage.metadata?.turnId || '');
            if (!turnId) return null;

            const userMessage = timeline.find(item => item.role === 'user' && String(item.metadata?.turnId || '') === turnId);
            if (!userMessage) return null;

            const nextMetadata = {
                ...(userMessage.metadata || {}),
                turnId,
                activeAssistantMessageId: assistantMessageId
            };

            updateConversationMessageMetadataStmt.run(JSON.stringify(nextMetadata), userMessage.id, conversationId);
            return this.getConversationMessages(userId, conversationId, 400);
        },

        appendConversationMessage(userId, conversationId, message = {}) {
            const conversation = this.getConversation(userId, conversationId);
            if (!conversation) return null;

            const role = String(message.role || '').trim();
            const content = String(message.content || '').trim();
            if (!['user', 'assistant'].includes(role) || !content) {
                throw new Error('invalid conversation message');
            }

            const metadata = message.metadata && typeof message.metadata === 'object'
                ? { ...message.metadata }
                : {};
            const now = Number(message.createdAt || Date.now());
            const nextMessageCount = conversation.messageCount + 1;
            const nextTitle = conversation.messageCount === 0 && role === 'user'
                ? buildConversationTitle(content)
                : conversation.title;
            const nextModel = message.model || conversation.model || 'gpt-4.1-mini';
            const messageId = crypto.randomUUID();

            db.exec('BEGIN');
            try {
                insertConversationMessageStmt.run(
                    messageId,
                    conversationId,
                    role,
                    content,
                    JSON.stringify(message.tokens || null),
                    JSON.stringify(metadata),
                    now
                );
                updateConversationStmt.run(
                    nextTitle,
                    nextModel,
                    nextMessageCount,
                    now,
                    now,
                    conversationId,
                    userId
                );
                db.exec('COMMIT');
            } catch (error) {
                db.exec('ROLLBACK');
                throw error;
            }

            return {
                conversation: this.getConversation(userId, conversationId),
                message: this.getConversationMessage(userId, conversationId, messageId)
            };
        },

        getHistory(userId, feature) {
            return selectHistoryStmt.all(userId, feature, maxHistoryItems)
                .map(row => safeParseJson(row.payload, null))
                .filter(Boolean);
        },

        appendHistory(userId, feature, entry) {
            const now = Number(entry?.timestamp || Date.now());
            db.exec('BEGIN');
            try {
                insertHistoryStmt.run(userId, feature, JSON.stringify(entry), now);
                pruneHistoryStmt.run(userId, feature, userId, feature, maxHistoryItems);
                const items = selectHistoryStmt.all(userId, feature, maxHistoryItems)
                    .map(row => safeParseJson(row.payload, null))
                    .filter(Boolean);
                db.exec('COMMIT');
                return items;
            } catch (error) {
                db.exec('ROLLBACK');
                throw error;
            }
        },

        getPreferences(userId) {
            return normalizePreferences(getPreferencesStmt.get(userId));
        },

        getOrCreatePreferences(userId) {
            return this.getPreferences(userId);
        },

        updatePreferences(userId, patch = {}) {
            const current = this.getPreferences(userId);
            const next = {
                ...current,
                ...patch
            };
            const now = Date.now();
            upsertPreferencesStmt.run(
                userId,
                next.theme,
                next.defaultModelChat,
                next.defaultVoice,
                next.defaultMusicStyle,
                next.defaultCoverRatio,
                typeof next.templatePreferencesJson === 'string' ? next.templatePreferencesJson : JSON.stringify(next.templatePreferencesJson || {}),
                current.createdAt || now,
                now
            );
            return this.getPreferences(userId);
        },

        getUsageDaily(userId, usageDate = getUsageDate()) {
            return getUsageDailyStmt.get(userId, usageDate) || getEmptyUsage(usageDate);
        },

        incrementUsageDaily(userId, feature, metrics = {}) {
            const counters = {
                chat: [1, 0, 0, 0, 0, 0],
                lyrics: [0, 1, 0, 0, 0, 0],
                music: [0, 0, 1, 0, 0, 0],
                image: [0, 0, 0, 1, 0, 0],
                speech: [0, 0, 0, 0, 1, 0],
                cover: [0, 0, 0, 0, 0, 1]
            }[feature] || [0, 0, 0, 0, 0, 0];

            const usageDate = metrics.usageDate || getUsageDate();
            upsertUsageStmt.run(
                userId,
                usageDate,
                counters[0],
                counters[1],
                counters[2],
                counters[3],
                counters[4],
                counters[5],
                Number(metrics.inputTokens || 0),
                Number(metrics.outputTokens || 0),
                Number(metrics.storageBytes || 0)
            );
            return this.getUsageDaily(userId, usageDate);
        },

        createTask(task) {
            const now = Date.now();
            insertTaskStmt.run(
                task.taskId,
                task.userId || null,
                task.feature,
                task.status || 'pending',
                Number(task.progress || 0),
                JSON.stringify(task.inputPayload || {}),
                JSON.stringify(task.outputPayload || {}),
                task.error || null,
                task.createdAt || now,
                now
            );
            return this.getTask(task.taskId);
        },

        updateTask(taskId, patch = {}) {
            const current = this.getTask(taskId);
            if (!current) return null;
            const nextOutput = patch.outputPayload !== undefined
                ? patch.outputPayload
                : current.outputPayload || {};
            updateTaskStmt.run(
                patch.status || current.status,
                patch.progress != null ? Number(patch.progress) : Number(current.progress || 0),
                JSON.stringify(nextOutput || {}),
                patch.error !== undefined ? patch.error : current.error || null,
                Date.now(),
                taskId
            );
            return this.getTask(taskId);
        },

        getTask(taskId) {
            return normalizeTask(getTaskStmt.get(taskId));
        },

        listTemplates(feature, userId) {
            const favorites = new Set(
                listTemplateFavoritesStmt.all(userId, feature)
                    .map(row => `${row.templateKind}:${row.templateId}`)
            );
            const systemTemplates = selectSystemTemplatesStmt.all(feature)
                .map(row => normalizeTemplateRow(row, 'system', favorites))
                .filter(Boolean);
            const userTemplates = userId
                ? selectUserTemplatesStmt.all(userId, feature)
                    .map(row => normalizeTemplateRow(row, 'user', favorites))
                    .filter(Boolean)
                : [];

            return {
                feature,
                groups: groupTemplates(systemTemplates.concat(userTemplates))
            };
        },

        createUserTemplate(userId, feature, template) {
            const payload = template.message ? { message: String(template.message) } : { values: template.values || {} };
            const now = Date.now();
            const id = `usr_${crypto.randomUUID()}`;
            insertUserTemplateStmt.run(
                id,
                userId,
                feature,
                template.category || '我的模板',
                template.label,
                template.description || '',
                JSON.stringify(payload),
                now,
                now
            );
            return this.listTemplates(feature, userId).groups
                .flatMap(group => group.items)
                .find(item => item.id === id) || null;
        },

        toggleTemplateFavorite(userId, feature, templateId) {
            const templateKind = String(templateId || '').startsWith('usr_') ? 'user' : 'system';
            const existing = getTemplateFavoriteStmt.get(userId, templateKind, templateId);
            if (existing) {
                deleteTemplateFavoriteStmt.run(userId, templateKind, templateId);
                return { favorite: false, templateId, templateKind };
            }
            insertTemplateFavoriteStmt.run(userId, feature, templateKind, templateId, Date.now());
            return { favorite: true, templateId, templateKind };
        },

        appendAuditLog(event = {}) {
            const action = String(event.action || '').trim();
            if (!action) {
                throw new Error('audit action is required');
            }
            return appendAuditLogRecord({ ...event, action });
        },

        listAuditLogs(limit = 100) {
            return listAuditLogsStmt.all(Number(limit || 100))
                .map(row => normalizeAuditLog(row))
                .filter(Boolean);
        },

        queryAuditLogs(filters = {}) {
            const pageSize = Math.min(100, Math.max(1, Number(filters.pageSize || 10)));
            const page = Math.max(1, Number(filters.page || 1));
            const offset = (page - 1) * pageSize;
            const query = buildAuditLogQuery(filters);
            const countStmt = db.prepare(`
                SELECT COUNT(*) AS count
                FROM audit_logs
                ${query.whereSql}
            `);
            const itemsStmt = db.prepare(`
                SELECT id, action, actor_user_id AS actorUserId, target_user_id AS targetUserId,
                       actor_username AS actorUsername, target_username AS targetUsername,
                       actor_role AS actorRole, target_role AS targetRole, actor_ip AS actorIp,
                       actor_user_agent AS actorUserAgent, details_json AS detailsJson,
                       created_at AS createdAt
                FROM audit_logs
                ${query.whereSql}
                ORDER BY created_at DESC, id DESC
                LIMIT ? OFFSET ?
            `);
            const total = Number(countStmt.get(...query.params)?.count || 0);
            const items = itemsStmt.all(...query.params, pageSize, offset)
                .map(row => normalizeAuditLog(row))
                .filter(Boolean);

            return {
                items,
                page,
                pageSize,
                total,
                totalPages: Math.max(1, Math.ceil(total / pageSize)),
                hasMore: offset + items.length < total
            };
        },

        getMaintenanceSummary(options = {}) {
            const now = Number(options.now || Date.now());
            return getMaintenanceSummary(now);
        },

        pruneAuditLogs(options = {}) {
            return pruneAuditLogs(options);
        },

        close() {
            db.close();
        }
    };
}

module.exports = {
    createStateStore
};
