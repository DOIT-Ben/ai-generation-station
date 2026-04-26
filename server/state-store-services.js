'use strict';

const { createStateStoreAuth } = require('./state-store-auth');
const { createStateStoreMaintenance } = require('./state-store-maintenance');
const { createStateStoreQueries } = require('./state-store-queries');
const { createStateStoreConversations } = require('./state-store-conversations');
const { createStateStoreBootstrap } = require('./state-store-bootstrap');
const { createStateStoreCore } = require('./state-store-core');
const { createStateStoreFacade } = require('./state-store-facade');
const { createStateStoreSnapshots } = require('./state-store-snapshots');
const { createStateStoreUsers } = require('./state-store-users');
const { createStateStoreMutations } = require('./state-store-mutations');

function createStateStoreServices(options) {
    const settings = options || {};
    const stateStoreCore = createStateStoreCore({
        db: settings.db,
        insertAuditLogStmt: settings.insertAuditLogStmt
    });

    const stateStoreBootstrap = createStateStoreBootstrap({
        fs: settings.fs,
        crypto: settings.crypto,
        db: settings.db,
        legacyFilePath: settings.legacyFilePath,
        sessionTtlMs: settings.sessionTtlMs,
        seedUser: settings.seedUser,
        hashPassword: settings.hashPassword,
        safeParseJson: settings.safeParseJson,
        normalizeUserRecord: settings.normalizeUserRecord,
        normalizeCredentialRecord: settings.normalizeCredentialRecord,
        buildSystemTemplateSeed: settings.buildSystemTemplateSeed,
        findUserByUsernameStmt: settings.findUserByUsernameStmt,
        getCredentialStmt: settings.getCredentialStmt,
        insertUserStmt: settings.insertUserStmt,
        upsertCredentialStmt: settings.upsertCredentialStmt,
        countSessionsStmt: settings.countSessionsStmt,
        countHistoryStmt: settings.countHistoryStmt,
        insertSessionStmt: settings.insertSessionStmt,
        insertHistoryStmt: settings.insertHistoryStmt,
        countSystemTemplatesStmt: settings.countSystemTemplatesStmt,
        insertSystemTemplateStmt: settings.insertSystemTemplateStmt,
        markInterruptedTasksStmt: settings.markInterruptedTasksStmt
    });

    stateStoreBootstrap.runStartupBootstrap();

    const stateStoreSnapshots = createStateStoreSnapshots({
        deleteExpiredSessionsStmt: settings.deleteExpiredSessionsStmt,
        deleteExpiredAuthTokensStmt: settings.deleteExpiredAuthTokensStmt,
        cleanupExpiredRateLimitEventsStmt: settings.cleanupExpiredRateLimitEventsStmt,
        normalizeConversation: settings.normalizeConversation,
        normalizeConversationMessage: settings.normalizeConversationMessage,
        buildConversationTimeline: settings.buildConversationTimeline,
        selectConversationByIdStmt: settings.selectConversationByIdStmt,
        listConversationMessagesStmt: settings.listConversationMessagesStmt,
        selectConversationMessageByIdStmt: settings.selectConversationMessageByIdStmt
    });

    const stateStoreAuth = createStateStoreAuth({
        sessionTtlMs: settings.sessionTtlMs,
        LOGIN_FAILURE_LOCK_THRESHOLD: settings.LOGIN_FAILURE_LOCK_THRESHOLD,
        LOGIN_FAILURE_LOCK_MS: settings.LOGIN_FAILURE_LOCK_MS,
        hashPassword: settings.hashPassword,
        hashPasswordAsync: settings.hashPasswordAsync,
        verifyPassword: settings.verifyPassword,
        verifyPasswordAsync: settings.verifyPasswordAsync,
        hashOpaqueToken: settings.hashOpaqueToken,
        createOpaqueToken: settings.createOpaqueToken,
        normalizeUserRecord: settings.normalizeUserRecord,
        normalizeCredentialRecord: settings.normalizeCredentialRecord,
        normalizeAuthTokenRecord: settings.normalizeAuthTokenRecord,
        buildAuthTokenSummary: settings.buildAuthTokenSummary,
        cleanupExpiredSessions: stateStoreSnapshots.cleanupExpiredSessions,
        cleanupAuthTokens: stateStoreSnapshots.cleanupAuthTokens,
        runInTransaction: stateStoreCore.runInTransaction,
        appendAuditLogRecord: stateStoreCore.appendAuditLogRecord,
        getUserByUsername: username => settings.normalizeUserRecord(settings.findUserByUsernameStmt.get(username)),
        getUserById: userId => settings.normalizeUserRecord(settings.findUserByIdStmt.get(userId)),
        insertUserStmt: settings.insertUserStmt,
        upsertCredentialStmt: settings.upsertCredentialStmt,
        findUserByUsernameStmt: settings.findUserByUsernameStmt,
        getCredentialStmt: settings.getCredentialStmt,
        incrementFailedLoginStmt: settings.incrementFailedLoginStmt,
        resetFailedLoginStmt: settings.resetFailedLoginStmt,
        updateUserLoginStmt: settings.updateUserLoginStmt,
        insertSessionStmt: settings.insertSessionStmt,
        getSessionStmt: settings.getSessionStmt,
        deleteSessionStmt: settings.deleteSessionStmt,
        deleteUserSessionsStmt: settings.deleteUserSessionsStmt,
        deleteUserSessionsExceptStmt: settings.deleteUserSessionsExceptStmt,
        insertAuthTokenStmt: settings.insertAuthTokenStmt,
        findAuthTokenByHashStmt: settings.findAuthTokenByHashStmt,
        findLatestAuthTokenByUserPurposeStmt: settings.findLatestAuthTokenByUserPurposeStmt,
        findActiveAuthTokenByUserPurposeStmt: settings.findActiveAuthTokenByUserPurposeStmt,
        markAuthTokenUsedStmt: settings.markAuthTokenUsedStmt,
        markUserPurposeTokensUsedStmt: settings.markUserPurposeTokensUsedStmt
    });

    const stateStoreMaintenance = createStateStoreMaintenance({
        runInTransaction: stateStoreCore.runInTransaction,
        cleanupExpiredRateLimitEvents: stateStoreSnapshots.cleanupExpiredRateLimitEvents,
        countUsersStmt: settings.countUsersStmt,
        countSessionsStmt: settings.countSessionsStmt,
        countActiveSessionsStmt: settings.countActiveSessionsStmt,
        countAuthTokensStmt: settings.countAuthTokensStmt,
        countActiveAuthTokensStmt: settings.countActiveAuthTokensStmt,
        countRateLimitEventsStmt: settings.countRateLimitEventsStmt,
        countHistoryStmt: settings.countHistoryStmt,
        countTasksStmt: settings.countTasksStmt,
        countAuditLogsSummaryStmt: settings.countAuditLogsSummaryStmt,
        deleteAuditLogsBeforeStmt: settings.deleteAuditLogsBeforeStmt,
        selectRateLimitWindowStmt: settings.selectRateLimitWindowStmt,
        insertRateLimitEventStmt: settings.insertRateLimitEventStmt
    });

    const stateStoreQueries = createStateStoreQueries({
        db: settings.db,
        normalizeAuditLog: settings.normalizeAuditLog,
        normalizeTemplateRow: settings.normalizeTemplateRow,
        groupTemplates: settings.groupTemplates,
        buildAuditLogQuery: settings.buildAuditLogQuery,
        listTemplateFavoritesStmt: settings.listTemplateFavoritesStmt,
        selectSystemTemplatesStmt: settings.selectSystemTemplatesStmt,
        selectUserTemplatesStmt: settings.selectUserTemplatesStmt,
        listAuditLogsStmt: settings.listAuditLogsStmt
    });

    const stateStoreConversations = createStateStoreConversations({
        normalizeConversation: settings.normalizeConversation,
        normalizeConversationMessage: settings.normalizeConversationMessage,
        buildConversationTimeline: settings.buildConversationTimeline,
        buildDisplayedConversationMessages: settings.buildDisplayedConversationMessages,
        listConversationsStmt: settings.listConversationsStmt,
        listArchivedConversationsStmt: settings.listArchivedConversationsStmt,
        selectConversationByIdStmt: settings.selectConversationByIdStmt,
        selectArchivedConversationByIdStmt: settings.selectArchivedConversationByIdStmt,
        listConversationMessagesStmt: settings.listConversationMessagesStmt,
        selectConversationMessageByIdStmt: settings.selectConversationMessageByIdStmt,
        updateConversationMessageMetadataStmt: settings.updateConversationMessageMetadataStmt
    });

    const stateStoreUsers = createStateStoreUsers({
        normalizeUserRecord: settings.normalizeUserRecord,
        runInTransaction: stateStoreCore.runInTransaction,
        appendAuditLogRecord: stateStoreCore.appendAuditLogRecord,
        findUserByUsernameStmt: settings.findUserByUsernameStmt,
        findUserByIdStmt: settings.findUserByIdStmt,
        findUserByEmailStmt: settings.findUserByEmailStmt,
        listUsersStmt: settings.listUsersStmt,
        countActiveAdminsStmt: settings.countActiveAdminsStmt,
        updateUserAdminStmt: settings.updateUserAdminStmt
    });

    const stateStoreMutations = createStateStoreMutations({
        db: settings.db,
        maxHistoryItems: settings.maxHistoryItems,
        buildConversationTitle: settings.buildConversationTitle,
        normalizeConversationMessage: settings.normalizeConversationMessage,
        safeParseJson: settings.safeParseJson,
        normalizePreferences: settings.normalizePreferences,
        normalizeTask: settings.normalizeTask,
        getUsageDate: settings.getUsageDate,
        groupTemplates: settings.groupTemplates,
        normalizeTemplateRow: settings.normalizeTemplateRow,
        getConversation: (userId, conversationId) => settings.normalizeConversation(settings.selectConversationByIdStmt.get(conversationId, userId)),
        getArchivedConversation: (userId, conversationId) => settings.normalizeConversation(settings.selectArchivedConversationByIdStmt.get(conversationId, userId)),
        getConversationMessage: stateStoreSnapshots.getConversationMessageSnapshot,
        getConversationTimeline: stateStoreSnapshots.getConversationTimelineSnapshot,
        getConversationMessages: (userId, conversationId, limit = 200) => {
            const timeline = stateStoreSnapshots.getConversationTimelineSnapshot(userId, conversationId, limit);
            if (!timeline) return null;
            return settings.buildDisplayedConversationMessages(timeline);
        },
        getPreferences: userId => settings.normalizePreferences(settings.getPreferencesStmt.get(userId)),
        getUsageDaily: (userId, usageDate = settings.getUsageDate()) => settings.getUsageDailyStmt.get(userId, usageDate) || settings.getEmptyUsage(usageDate),
        getTask: taskId => settings.normalizeTask(settings.getTaskStmt.get(taskId)),
        listTemplates: (feature, userId) => stateStoreQueries.listTemplates(feature, userId),
        insertConversationStmt: settings.insertConversationStmt,
        updateConversationStmt: settings.updateConversationStmt,
        archiveConversationStmt: settings.archiveConversationStmt,
        restoreConversationStmt: settings.restoreConversationStmt,
        deleteArchivedConversationStmt: settings.deleteArchivedConversationStmt,
        insertConversationMessageStmt: settings.insertConversationMessageStmt,
        listConversationMessagesStmt: settings.listConversationMessagesStmt,
        insertHistoryStmt: settings.insertHistoryStmt,
        pruneHistoryStmt: settings.pruneHistoryStmt,
        selectHistoryStmt: settings.selectHistoryStmt,
        getPreferencesStmt: settings.getPreferencesStmt,
        upsertPreferencesStmt: settings.upsertPreferencesStmt,
        getUsageDailyStmt: settings.getUsageDailyStmt,
        upsertUsageStmt: settings.upsertUsageStmt,
        insertTaskStmt: settings.insertTaskStmt,
        updateTaskStmt: settings.updateTaskStmt,
        getTaskStmt: settings.getTaskStmt,
        listTemplateFavoritesStmt: settings.listTemplateFavoritesStmt,
        selectSystemTemplatesStmt: settings.selectSystemTemplatesStmt,
        selectUserTemplatesStmt: settings.selectUserTemplatesStmt,
        insertUserTemplateStmt: settings.insertUserTemplateStmt,
        getTemplateFavoriteStmt: settings.getTemplateFavoriteStmt,
        deleteTemplateFavoriteStmt: settings.deleteTemplateFavoriteStmt,
        insertTemplateFavoriteStmt: settings.insertTemplateFavoriteStmt
    });

    const facade = createStateStoreFacade({
        db: settings.db,
        stateStoreUsers,
        stateStoreAuth,
        stateStoreMaintenance,
        stateStoreConversations,
        stateStoreMutations,
        stateStoreQueries,
        normalizeCredentialRecord: settings.normalizeCredentialRecord,
        getCredentialStmt: settings.getCredentialStmt,
        normalizePreferences: settings.normalizePreferences,
        getPreferencesStmt: settings.getPreferencesStmt,
        getUsageDate: settings.getUsageDate,
        getUsageDailyStmt: settings.getUsageDailyStmt,
        getEmptyUsage: settings.getEmptyUsage,
        normalizeTask: settings.normalizeTask,
        getTaskStmt: settings.getTaskStmt
    });

    return {
        facade
    };
}

module.exports = {
    createStateStoreServices
};
