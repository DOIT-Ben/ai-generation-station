'use strict';

function createStateStoreMaintenance(options) {
    const settings = options || {};
    const runInTransaction = settings.runInTransaction || function (work) { return work(); };
    const cleanupExpiredRateLimitEvents = settings.cleanupExpiredRateLimitEvents || function () {};
    const countUsersStmt = settings.countUsersStmt;
    const countSessionsStmt = settings.countSessionsStmt;
    const countActiveSessionsStmt = settings.countActiveSessionsStmt;
    const countAuthTokensStmt = settings.countAuthTokensStmt;
    const countActiveAuthTokensStmt = settings.countActiveAuthTokensStmt;
    const countRateLimitEventsStmt = settings.countRateLimitEventsStmt;
    const countHistoryStmt = settings.countHistoryStmt;
    const countTasksStmt = settings.countTasksStmt;
    const countAuditLogsSummaryStmt = settings.countAuditLogsSummaryStmt;
    const deleteAuditLogsBeforeStmt = settings.deleteAuditLogsBeforeStmt;
    const selectRateLimitWindowStmt = settings.selectRateLimitWindowStmt;
    const insertRateLimitEventStmt = settings.insertRateLimitEventStmt;

    function consumeRateLimit(ruleName, bucketKey, config) {
        const nextConfig = config || {};
        const max = Math.max(0, Number(nextConfig.max || 0));
        const windowMs = Math.max(0, Number(nextConfig.windowMs || 0));
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
    }

    function getMaintenanceSummary(now) {
        const timestamp = Number(now || Date.now());
        const auditLogs = countAuditLogsSummaryStmt.get() || {};
        return {
            users: Number(countUsersStmt.get()?.count || 0),
            sessions: {
                total: Number(countSessionsStmt.get()?.count || 0),
                active: Number(countActiveSessionsStmt.get(timestamp)?.count || 0)
            },
            authTokens: {
                total: Number(countAuthTokensStmt.get()?.count || 0),
                active: Number(countActiveAuthTokensStmt.get(timestamp)?.count || 0)
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

    function pruneAuditLogs(options) {
        const nextOptions = options || {};
        const now = Number(nextOptions.now || Date.now());
        const retentionDays = Number(nextOptions.olderThanDays || 0);
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
        consumeRateLimit,
        getMaintenanceSummary,
        pruneAuditLogs
    };
}

module.exports = {
    createStateStoreMaintenance
};
