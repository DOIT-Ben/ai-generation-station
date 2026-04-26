'use strict';

function createStateStoreCore(options) {
    const settings = options || {};
    const db = settings.db;
    const insertAuditLogStmt = settings.insertAuditLogStmt;

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

    return {
        runInTransaction,
        appendAuditLogRecord
    };
}

module.exports = {
    createStateStoreCore
};
