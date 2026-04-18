const fs = require('fs');
const crypto = require('crypto');

function ensureStateFile(filePath) {
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify({ sessions: {}, history: {} }, null, 2));
    }
}

function readState(filePath) {
    ensureStateFile(filePath);
    try {
        const raw = fs.readFileSync(filePath, 'utf8');
        const parsed = JSON.parse(raw || '{}');
        return {
            sessions: parsed.sessions || {},
            history: parsed.history || {}
        };
    } catch {
        return { sessions: {}, history: {} };
    }
}

function writeState(filePath, state) {
    fs.writeFileSync(filePath, JSON.stringify(state, null, 2));
}

function createStateStore({ filePath, sessionTtlMs, maxHistoryItems }) {
    function cleanupExpiredSessions(state) {
        const now = Date.now();
        Object.keys(state.sessions).forEach(token => {
            if ((state.sessions[token]?.expiresAt || 0) <= now) {
                delete state.sessions[token];
            }
        });
    }

    return {
        getSession(token) {
            if (!token) return null;
            const state = readState(filePath);
            cleanupExpiredSessions(state);
            writeState(filePath, state);
            return state.sessions[token] || null;
        },

        createSession(username) {
            const state = readState(filePath);
            cleanupExpiredSessions(state);
            const token = crypto.randomBytes(24).toString('hex');
            const session = {
                username,
                createdAt: Date.now(),
                expiresAt: Date.now() + sessionTtlMs
            };
            state.sessions[token] = session;
            writeState(filePath, state);
            return { token, ...session };
        },

        clearSession(token) {
            if (!token) return;
            const state = readState(filePath);
            delete state.sessions[token];
            writeState(filePath, state);
        },

        getHistory(username, feature) {
            const state = readState(filePath);
            return state.history?.[username]?.[feature] || [];
        },

        appendHistory(username, feature, entry) {
            const state = readState(filePath);
            state.history[username] = state.history[username] || {};
            const current = state.history[username][feature] || [];
            const next = [entry].concat(current).slice(0, maxHistoryItems);
            state.history[username][feature] = next;
            writeState(filePath, state);
            return next;
        }
    };
}

module.exports = {
    createStateStore
};
