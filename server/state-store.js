const fs = require('fs');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');
const AppShell = require('../public/js/app-shell.js');

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

    function normalizeTask(row) {
        if (!row) return null;
        const output = safeParseJson(row.outputPayload, null) || {};
        return {
            taskId: row.taskId,
            userId: row.userId || null,
            feature: row.feature,
            status: row.status,
            progress: row.progress,
            url: output.url,
            duration: output.duration,
            size: output.size,
            error: row.error || undefined,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
            inputPayload: safeParseJson(row.inputPayload, null),
            outputPayload: output
        };
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

    function normalizeTemplateRow(row, kind, favorites = new Set()) {
        if (!row) return null;
        const payload = safeParseJson(row.payload, {}) || {};
        return {
            id: row.id,
            feature: row.feature,
            category: row.category,
            label: row.label,
            description: row.description || '',
            source: kind,
            favorite: favorites.has(`${kind}:${row.id}`),
            ...payload
        };
    }

    function groupTemplates(items) {
        const groups = new Map();
        items.forEach(item => {
            if (!groups.has(item.category)) {
                groups.set(item.category, { category: item.category, items: [] });
            }
            groups.get(item.category).items.push(item);
        });
        return Array.from(groups.values());
    }

    function buildSystemTemplateSeed() {
        const library = AppShell.TEMPLATE_LIBRARY || {};
        const rows = [];
        Object.entries(library).forEach(([feature, groups]) => {
            groups.forEach((group, groupIndex) => {
                (group.items || []).forEach((item, itemIndex) => {
                    rows.push({
                        id: `sys_${feature}_${groupIndex}_${itemIndex}`,
                        feature,
                        category: group.category || '系统模板',
                        label: item.label || `模板 ${itemIndex + 1}`,
                        description: item.description || '',
                        payload: item.message ? { message: item.message } : { values: item.values || {} },
                        sortOrder: groupIndex * 100 + itemIndex
                    });
                });
            });
        });
        return rows;
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

    return {
        getUserByUsername(username) {
            return normalizeUserRecord(findUserByUsernameStmt.get(username));
        },

        getUserById(userId) {
            return normalizeUserRecord(db.prepare(`
                SELECT id, username, email, display_name AS displayName, status, role, plan_code AS planCode,
                       timezone, locale, last_login_at AS lastLoginAt, created_at AS createdAt, updated_at AS updatedAt
                FROM users
                WHERE id = ? AND deleted_at IS NULL
            `).get(userId));
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

        close() {
            db.close();
        }
    };
}

module.exports = {
    createStateStore
};
