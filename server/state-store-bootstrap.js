'use strict';

function createStateStoreBootstrap(options) {
    const settings = options || {};
    const fs = settings.fs;
    const crypto = settings.crypto;
    const db = settings.db;
    const legacyFilePath = settings.legacyFilePath;
    const sessionTtlMs = settings.sessionTtlMs;
    const seedUser = settings.seedUser;
    const hashPassword = settings.hashPassword || function (value) { return value; };
    const safeParseJson = settings.safeParseJson || function () { return { sessions: {}, history: {} }; };
    const normalizeUserRecord = settings.normalizeUserRecord || function (value) { return value; };
    const normalizeCredentialRecord = settings.normalizeCredentialRecord || function (value) { return value; };
    const buildSystemTemplateSeed = settings.buildSystemTemplateSeed || function () { return []; };
    const findUserByUsernameStmt = settings.findUserByUsernameStmt;
    const getCredentialStmt = settings.getCredentialStmt;
    const insertUserStmt = settings.insertUserStmt;
    const upsertCredentialStmt = settings.upsertCredentialStmt;
    const countSessionsStmt = settings.countSessionsStmt;
    const countHistoryStmt = settings.countHistoryStmt;
    const insertSessionStmt = settings.insertSessionStmt;
    const insertHistoryStmt = settings.insertHistoryStmt;
    const countSystemTemplatesStmt = settings.countSystemTemplatesStmt;
    const insertSystemTemplateStmt = settings.insertSystemTemplateStmt;
    const markInterruptedTasksStmt = settings.markInterruptedTasksStmt;

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

    function seedSystemTemplatesIfNeeded() {
        if ((countSystemTemplatesStmt.get().count || 0) !== 0) {
            return;
        }

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

    function markInterruptedTasks(now = Date.now()) {
        markInterruptedTasksStmt.run(now);
    }

    function runStartupBootstrap() {
        ensureSeedUser();
        migrateLegacyJsonIfNeeded();
        seedSystemTemplatesIfNeeded();
        markInterruptedTasks(Date.now());
    }

    return {
        ensureSeedUser,
        migrateLegacyJsonIfNeeded,
        seedSystemTemplatesIfNeeded,
        markInterruptedTasks,
        runStartupBootstrap
    };
}

module.exports = {
    createStateStoreBootstrap
};
