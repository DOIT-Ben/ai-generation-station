const fs = require('fs');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');

function safeParseJson(value, fallback) {
    if (!value) return fallback;
    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
    const [salt, expected] = String(storedHash || '').split(':');
    if (!salt || !expected) return false;
    const actual = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'));
}

function createStateStore({ dbPath, legacyFilePath, sessionTtlMs, maxHistoryItems, seedUser }) {
    const db = new DatabaseSync(dbPath);
    db.exec(`
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;
        PRAGMA busy_timeout = 5000;

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
            created_at INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_user_history_lookup ON user_history_entries (user_id, feature, created_at DESC, id DESC);
    `);

    const findUserByUsernameStmt = db.prepare(`
        SELECT id, username, email, display_name AS displayName, status, role, plan_code AS planCode,
               timezone, locale, last_login_at AS lastLoginAt, created_at AS createdAt, updated_at AS updatedAt
        FROM users
        WHERE username = ? AND deleted_at IS NULL
    `);
    const insertUserStmt = db.prepare(`
        INSERT INTO users (id, username, email, display_name, status, role, plan_code, timezone, locale, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const updateUserLoginStmt = db.prepare(`
        UPDATE users
        SET last_login_at = ?, updated_at = ?
        WHERE id = ?
    `);
    const getCredentialStmt = db.prepare(`
        SELECT user_id AS userId, password_hash AS passwordHash, failed_login_count AS failedLoginCount,
               locked_until AS lockedUntil
        FROM user_credentials
        WHERE user_id = ?
    `);
    const upsertCredentialStmt = db.prepare(`
        INSERT INTO user_credentials (user_id, password_hash, password_updated_at, failed_login_count, locked_until)
        VALUES (?, ?, ?, 0, NULL)
        ON CONFLICT(user_id) DO UPDATE SET
            password_hash = excluded.password_hash,
            password_updated_at = excluded.password_updated_at,
            failed_login_count = 0,
            locked_until = NULL
    `);
    const setFailedLoginStmt = db.prepare(`
        UPDATE user_credentials
        SET failed_login_count = ?, locked_until = ?
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
    const deleteExpiredSessionsStmt = db.prepare(`DELETE FROM user_sessions WHERE expires_at <= ? OR revoked_at IS NOT NULL`);

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
    const countSessionsStmt = db.prepare(`SELECT COUNT(*) AS count FROM user_sessions`);
    const countHistoryStmt = db.prepare(`SELECT COUNT(*) AS count FROM user_history_entries`);

    function normalizeUserRecord(row) {
        if (!row) return null;
        return {
            id: row.id,
            username: row.username,
            email: row.email || null,
            displayName: row.displayName || row.username,
            status: row.status,
            role: row.role,
            planCode: row.planCode,
            timezone: row.timezone,
            locale: row.locale,
            lastLoginAt: row.lastLoginAt || null,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt
        };
    }

    function getDefaultPreferences() {
        return {
            theme: 'dark',
            defaultModelChat: 'MiniMax-M2.7',
            defaultVoice: 'male-qn-qingse',
            defaultMusicStyle: '',
            defaultCoverRatio: '1:1',
            templatePreferencesJson: '{}'
        };
    }

    function normalizePreferences(row) {
        return {
            ...getDefaultPreferences(),
            ...(row || {})
        };
    }

    function getUsageDate(date = new Date()) {
        return date.toISOString().slice(0, 10);
    }

    function getEmptyUsage(usageDate) {
        return {
            usageDate,
            chatCount: 0,
            lyricsCount: 0,
            musicCount: 0,
            imageCount: 0,
            speechCount: 0,
            coverCount: 0,
            inputTokens: 0,
            outputTokens: 0,
            storageBytes: 0
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
            upsertCredentialStmt.run(userId, hashPassword(seedUser.password), now);
            return;
        }
        upsertCredentialStmt.run(existing.id, hashPassword(seedUser.password), now);
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

    function cleanupExpiredSessions() {
        deleteExpiredSessionsStmt.run(Date.now());
    }

    return {
        getUserByUsername(username) {
            return normalizeUserRecord(findUserByUsernameStmt.get(username));
        },

        authenticateUser(username, password) {
            const user = normalizeUserRecord(findUserByUsernameStmt.get(username));
            if (!user || user.status !== 'active') return null;
            const credential = getCredentialStmt.get(user.id);
            const now = Date.now();
            if (!credential) return null;
            if (credential.lockedUntil && credential.lockedUntil > now) {
                return { error: '账号已被临时锁定，请稍后重试' };
            }
            if (!verifyPassword(password, credential.passwordHash)) {
                const failedCount = Number(credential.failedLoginCount || 0) + 1;
                const lockedUntil = failedCount >= 5 ? now + 15 * 60 * 1000 : null;
                setFailedLoginStmt.run(failedCount, lockedUntil, user.id);
                return null;
            }
            setFailedLoginStmt.run(0, null, user.id);
            updateUserLoginStmt.run(now, now, user.id);
            user.lastLoginAt = now;
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

        close() {
            db.close();
        }
    };
}

module.exports = {
    createStateStore
};
