'use strict';

function createStateStoreFacade(options) {
    const settings = options || {};
    const db = settings.db;
    const stateStoreUsers = settings.stateStoreUsers;
    const stateStoreAuth = settings.stateStoreAuth;
    const stateStoreMaintenance = settings.stateStoreMaintenance;
    const stateStoreConversations = settings.stateStoreConversations;
    const stateStoreMutations = settings.stateStoreMutations;
    const stateStoreQueries = settings.stateStoreQueries;
    const normalizeCredentialRecord = settings.normalizeCredentialRecord || function (value) { return value; };
    const getCredentialStmt = settings.getCredentialStmt;
    const normalizePreferences = settings.normalizePreferences || function (value) { return value; };
    const getPreferencesStmt = settings.getPreferencesStmt;
    const getUsageDate = settings.getUsageDate || function () { return ''; };
    const getUsageDailyStmt = settings.getUsageDailyStmt;
    const getEmptyUsage = settings.getEmptyUsage || function () { return {}; };
    const normalizeTask = settings.normalizeTask || function (value) { return value; };
    const getTaskStmt = settings.getTaskStmt;

    return {
        getUserByUsername(username) {
            return stateStoreUsers.getUserByUsername(username);
        },

        getUserById(userId) {
            return stateStoreUsers.getUserById(userId);
        },

        getUserByEmail(email) {
            return stateStoreUsers.getUserByEmail(email);
        },

        listUsers() {
            return stateStoreUsers.listUsers();
        },

        countActiveAdmins() {
            return stateStoreUsers.countActiveAdmins();
        },

        createUser(user = {}, options = {}) {
            return stateStoreAuth.createUser(user, options);
        },

        async createUserAsync(user = {}, options = {}) {
            return stateStoreAuth.createUserAsync(user, options);
        },

        updateUser(userId, patch = {}, options = {}) {
            return stateStoreUsers.updateUser(userId, patch, options);
        },

        authenticateUser(username, password) {
            return stateStoreAuth.authenticateUser(username, password);
        },

        async authenticateUserAsync(username, password) {
            return stateStoreAuth.authenticateUserAsync(username, password);
        },

        getSession(token) {
            return stateStoreAuth.getSession(token);
        },

        createSession(user) {
            return stateStoreAuth.createSession(user);
        },

        clearSession(token) {
            return stateStoreAuth.clearSession(token);
        },

        issueUserToken(userId, purpose, options = {}) {
            return stateStoreAuth.issueUserToken(userId, purpose, options);
        },

        getUserToken(purpose, token) {
            return stateStoreAuth.getUserToken(purpose, token);
        },

        consumeUserToken(purpose, token) {
            return stateStoreAuth.consumeUserToken(purpose, token);
        },

        getLatestUserTokenSummary(userId, purpose) {
            return stateStoreAuth.getLatestUserTokenSummary(userId, purpose);
        },

        getActiveUserTokenSummary(userId, purpose) {
            return stateStoreAuth.getActiveUserTokenSummary(userId, purpose);
        },

        revokeUserTokens(userId, purpose) {
            return stateStoreAuth.revokeUserTokens(userId, purpose);
        },

        consumeRateLimit(ruleName, bucketKey, config = {}) {
            return stateStoreMaintenance.consumeRateLimit(ruleName, bucketKey, config);
        },

        isPasswordResetRequired(userId) {
            return Boolean(normalizeCredentialRecord(getCredentialStmt.get(userId))?.mustResetPassword);
        },

        changeCurrentUserPassword(userId, currentPassword, nextPassword, options = {}) {
            return stateStoreAuth.changeCurrentUserPassword(userId, currentPassword, nextPassword, options);
        },

        async changeCurrentUserPasswordAsync(userId, currentPassword, nextPassword, options = {}) {
            return stateStoreAuth.changeCurrentUserPasswordAsync(userId, currentPassword, nextPassword, options);
        },

        resetUserPassword(userId, password, options = {}) {
            return stateStoreAuth.resetUserPassword(userId, password, options);
        },

        async resetUserPasswordAsync(userId, password, options = {}) {
            return stateStoreAuth.resetUserPasswordAsync(userId, password, options);
        },

        listConversations(userId, limit = 40) {
            return stateStoreConversations.listConversations(userId, limit);
        },

        listArchivedConversations(userId, limit = 40) {
            return stateStoreConversations.listArchivedConversations(userId, limit);
        },

        createConversation(userId, payload = {}) {
            return stateStoreMutations.createConversation(userId, payload);
        },

        getConversation(userId, conversationId) {
            return stateStoreConversations.getConversation(userId, conversationId);
        },

        getArchivedConversation(userId, conversationId) {
            return stateStoreConversations.getArchivedConversation(userId, conversationId);
        },

        updateConversation(userId, conversationId, payload = {}) {
            return stateStoreMutations.updateConversation(userId, conversationId, payload);
        },

        archiveConversation(userId, conversationId) {
            return stateStoreMutations.archiveConversation(userId, conversationId);
        },

        restoreConversation(userId, conversationId) {
            return stateStoreMutations.restoreConversation(userId, conversationId);
        },

        deleteArchivedConversation(userId, conversationId) {
            return stateStoreMutations.deleteArchivedConversation(userId, conversationId);
        },

        getConversationMessageTimeline(userId, conversationId, limit = 400) {
            return stateStoreConversations.getConversationMessageTimeline(userId, conversationId, limit);
        },

        getConversationMessages(userId, conversationId, limit = 200) {
            return stateStoreConversations.getConversationMessages(userId, conversationId, limit);
        },

        getConversationMessage(userId, conversationId, messageId) {
            return stateStoreConversations.getConversationMessage(userId, conversationId, messageId);
        },

        getConversationPromptMessages(userId, conversationId, options = {}) {
            return stateStoreConversations.getConversationPromptMessages(userId, conversationId, options);
        },

        setConversationTurnActiveAssistant(userId, conversationId, assistantMessageId) {
            return stateStoreConversations.setConversationTurnActiveAssistant(userId, conversationId, assistantMessageId);
        },

        appendConversationMessage(userId, conversationId, message = {}) {
            return stateStoreMutations.appendConversationMessage(userId, conversationId, message);
        },

        getHistory(userId, feature) {
            return stateStoreMutations.getHistory(userId, feature);
        },

        appendHistory(userId, feature, entry) {
            return stateStoreMutations.appendHistory(userId, feature, entry);
        },

        getPreferences(userId) {
            return normalizePreferences(getPreferencesStmt.get(userId));
        },

        getOrCreatePreferences(userId) {
            return this.getPreferences(userId);
        },

        updatePreferences(userId, patch = {}) {
            return stateStoreMutations.updatePreferences(userId, patch);
        },

        getUsageDaily(userId, usageDate = getUsageDate()) {
            return getUsageDailyStmt.get(userId, usageDate) || getEmptyUsage(usageDate);
        },

        incrementUsageDaily(userId, feature, metrics = {}) {
            return stateStoreMutations.incrementUsageDaily(userId, feature, metrics);
        },

        createTask(task) {
            return stateStoreMutations.createTask(task);
        },

        updateTask(taskId, patch = {}) {
            return stateStoreMutations.updateTask(taskId, patch);
        },

        getTask(taskId) {
            return normalizeTask(getTaskStmt.get(taskId));
        },

        listTemplates(feature, userId) {
            return stateStoreQueries.listTemplates(feature, userId);
        },

        createUserTemplate(userId, feature, template) {
            return stateStoreMutations.createUserTemplate(userId, feature, template);
        },

        toggleTemplateFavorite(userId, feature, templateId) {
            return stateStoreMutations.toggleTemplateFavorite(userId, feature, templateId);
        },

        appendAuditLog(event = {}) {
            return stateStoreUsers.appendAuditLog(event);
        },

        listAuditLogs(limit = 100) {
            return stateStoreQueries.listAuditLogs(limit);
        },

        queryAuditLogs(filters = {}) {
            return stateStoreQueries.queryAuditLogs(filters);
        },

        getMaintenanceSummary(options = {}) {
            const now = Number(options.now || Date.now());
            return stateStoreMaintenance.getMaintenanceSummary(now);
        },

        pruneAuditLogs(options = {}) {
            return stateStoreMaintenance.pruneAuditLogs(options);
        },

        close() {
            db.close();
        }
    };
}

module.exports = {
    createStateStoreFacade
};
