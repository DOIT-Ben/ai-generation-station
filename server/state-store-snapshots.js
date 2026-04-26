'use strict';

function createStateStoreSnapshots(options) {
    const settings = options || {};
    const deleteExpiredSessionsStmt = settings.deleteExpiredSessionsStmt;
    const deleteExpiredAuthTokensStmt = settings.deleteExpiredAuthTokensStmt;
    const cleanupExpiredRateLimitEventsStmt = settings.cleanupExpiredRateLimitEventsStmt;
    const normalizeConversation = settings.normalizeConversation || function (value) { return value; };
    const normalizeConversationMessage = settings.normalizeConversationMessage || function (value) { return value; };
    const buildConversationTimeline = settings.buildConversationTimeline || function (items) { return items; };
    const selectConversationByIdStmt = settings.selectConversationByIdStmt;
    const listConversationMessagesStmt = settings.listConversationMessagesStmt;
    const selectConversationMessageByIdStmt = settings.selectConversationMessageByIdStmt;

    function cleanupExpiredSessions(now = Date.now()) {
        deleteExpiredSessionsStmt.run(now);
    }

    function cleanupAuthTokens(now = Date.now()) {
        deleteExpiredAuthTokensStmt.run(now);
    }

    function cleanupExpiredRateLimitEvents(now = Date.now()) {
        cleanupExpiredRateLimitEventsStmt.run(now);
    }

    function getConversationTimelineSnapshot(userId, conversationId, limit = 400) {
        const conversation = normalizeConversation(selectConversationByIdStmt.get(conversationId, userId));
        if (!conversation) return null;

        return buildConversationTimeline(
            listConversationMessagesStmt.all(conversationId, Number(limit || 400))
                .map(row => normalizeConversationMessage(row))
                .filter(Boolean)
        );
    }

    function getConversationMessageSnapshot(userId, conversationId, messageId) {
        const conversation = normalizeConversation(selectConversationByIdStmt.get(conversationId, userId));
        if (!conversation || !messageId) return null;

        const row = selectConversationMessageByIdStmt.get(messageId, conversationId);
        if (!row) return null;

        const message = normalizeConversationMessage(row);
        if (!message) return null;

        const timeline = getConversationTimelineSnapshot(userId, conversationId, 400) || [];
        return timeline.find(item => item.id === message.id) || message;
    }

    return {
        cleanupExpiredSessions,
        cleanupAuthTokens,
        cleanupExpiredRateLimitEvents,
        getConversationTimelineSnapshot,
        getConversationMessageSnapshot
    };
}

module.exports = {
    createStateStoreSnapshots
};
