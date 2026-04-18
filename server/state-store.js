const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

function safeParseJson(value, fallback) {
    if (!value) return fallback;
    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
}

function createStateStore({ dbPath, legacyFilePath, sessionTtlMs, maxHistoryItems }) {
    const db = new DatabaseSync(dbPath);
    db.exec(`
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;
        PRAGMA busy_timeout = 5000;

        CREATE TABLE IF NOT EXISTS sessions (
            token TEXT PRIMARY KEY,
            username TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            expires_at INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions (expires_at);

        CREATE TABLE IF NOT EXISTS history_entries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            feature TEXT NOT NULL,
            payload TEXT NOT NULL,
            created_at INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_history_lookup ON history_entries (username, feature, created_at DESC, id DESC);
    `);

    const getSessionStmt = db.prepare(`
        SELECT token, username, created_at AS createdAt, expires_at AS expiresAt
        FROM sessions
        WHERE token = ?
    `);
    const insertSessionStmt = db.prepare(`
        INSERT INTO sessions (token, username, created_at, expires_at)
        VALUES (?, ?, ?, ?)
    `);
    const deleteSessionStmt = db.prepare(`DELETE FROM sessions WHERE token = ?`);
    const deleteExpiredSessionsStmt = db.prepare(`DELETE FROM sessions WHERE expires_at <= ?`);

    const selectHistoryStmt = db.prepare(`
        SELECT payload
        FROM history_entries
        WHERE username = ? AND feature = ?
        ORDER BY created_at DESC, id DESC
        LIMIT ?
    `);
    const insertHistoryStmt = db.prepare(`
        INSERT INTO history_entries (username, feature, payload, created_at)
        VALUES (?, ?, ?, ?)
    `);
    const pruneHistoryStmt = db.prepare(`
        DELETE FROM history_entries
        WHERE username = ? AND feature = ?
          AND id NOT IN (
            SELECT id
            FROM history_entries
            WHERE username = ? AND feature = ?
            ORDER BY created_at DESC, id DESC
            LIMIT ?
          )
    `);
    const countSessionsStmt = db.prepare(`SELECT COUNT(*) AS count FROM sessions`);
    const countHistoryStmt = db.prepare(`SELECT COUNT(*) AS count FROM history_entries`);

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
            Object.entries(legacy.sessions || {}).forEach(([token, session]) => {
                if (!token || !session?.username) return;
                insertSessionStmt.run(
                    token,
                    session.username,
                    Number(session.createdAt || Date.now()),
                    Number(session.expiresAt || Date.now() + sessionTtlMs)
                );
            });

            Object.entries(legacy.history || {}).forEach(([username, features]) => {
                Object.entries(features || {}).forEach(([feature, entries]) => {
                    (entries || []).slice().reverse().forEach((entry, index) => {
                        insertHistoryStmt.run(
                            username,
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

    migrateLegacyJsonIfNeeded();

    function cleanupExpiredSessions() {
        deleteExpiredSessionsStmt.run(Date.now());
    }

    return {
        getSession(token) {
            if (!token) return null;
            cleanupExpiredSessions();
            return getSessionStmt.get(token) || null;
        },

        createSession(username) {
            cleanupExpiredSessions();
            const token = require('crypto').randomBytes(24).toString('hex');
            const createdAt = Date.now();
            const expiresAt = createdAt + sessionTtlMs;
            insertSessionStmt.run(token, username, createdAt, expiresAt);
            return { token, username, createdAt, expiresAt };
        },

        clearSession(token) {
            if (!token) return;
            deleteSessionStmt.run(token);
        },

        getHistory(username, feature) {
            return selectHistoryStmt.all(username, feature, maxHistoryItems)
                .map(row => safeParseJson(row.payload, null))
                .filter(Boolean);
        },

        appendHistory(username, feature, entry) {
            const now = Number(entry?.timestamp || Date.now());
            db.exec('BEGIN');
            try {
                insertHistoryStmt.run(username, feature, JSON.stringify(entry), now);
                pruneHistoryStmt.run(username, feature, username, feature, maxHistoryItems);
                const items = selectHistoryStmt.all(username, feature, maxHistoryItems)
                    .map(row => safeParseJson(row.payload, null))
                    .filter(Boolean);
                db.exec('COMMIT');
                return items;
            } catch (error) {
                db.exec('ROLLBACK');
                throw error;
            }
        },

        close() {
            db.close();
        }
    };
}

module.exports = {
    createStateStore
};
