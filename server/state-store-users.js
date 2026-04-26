'use strict';

function createStateStoreUsers(options) {
    const settings = options || {};
    const normalizeUserRecord = settings.normalizeUserRecord || function (value) { return value; };
    const runInTransaction = settings.runInTransaction || function (work) { return work(); };
    const appendAuditLogRecord = settings.appendAuditLogRecord || function () {};
    const findUserByUsernameStmt = settings.findUserByUsernameStmt;
    const findUserByIdStmt = settings.findUserByIdStmt;
    const findUserByEmailStmt = settings.findUserByEmailStmt;
    const listUsersStmt = settings.listUsersStmt;
    const countActiveAdminsStmt = settings.countActiveAdminsStmt;
    const updateUserAdminStmt = settings.updateUserAdminStmt;

    function getUserByUsername(username) {
        return normalizeUserRecord(findUserByUsernameStmt.get(username));
    }

    function getUserById(userId) {
        return normalizeUserRecord(findUserByIdStmt.get(userId));
    }

    function getUserByEmail(email) {
        return normalizeUserRecord(findUserByEmailStmt.get(email));
    }

    function listUsers() {
        return listUsersStmt.all().map(row => normalizeUserRecord(row));
    }

    function countActiveAdmins() {
        return Number(countActiveAdminsStmt.get()?.count || 0);
    }

    function updateUser(userId, patch = {}, options = {}) {
        const current = getUserById(userId);
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
            const updatedUser = getUserById(userId);
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
    }

    function appendAuditLog(event = {}) {
        const action = String(event.action || '').trim();
        if (!action) {
            throw new Error('audit action is required');
        }
        return appendAuditLogRecord({ ...event, action });
    }

    return {
        getUserByUsername,
        getUserById,
        getUserByEmail,
        listUsers,
        countActiveAdmins,
        updateUser,
        appendAuditLog
    };
}

module.exports = {
    createStateStoreUsers
};
