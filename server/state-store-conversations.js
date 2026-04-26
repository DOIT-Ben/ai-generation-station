'use strict';

function createStateStoreConversations(options) {
    const settings = options || {};
    const normalizeConversation = settings.normalizeConversation || function (value) { return value; };
    const normalizeConversationMessage = settings.normalizeConversationMessage || function (value) { return value; };
    const buildConversationTimeline = settings.buildConversationTimeline || function (items) { return items; };
    const buildDisplayedConversationMessages = settings.buildDisplayedConversationMessages || function (items) { return items; };
    const listConversationsStmt = settings.listConversationsStmt;
    const listArchivedConversationsStmt = settings.listArchivedConversationsStmt;
    const selectConversationByIdStmt = settings.selectConversationByIdStmt;
    const selectArchivedConversationByIdStmt = settings.selectArchivedConversationByIdStmt;
    const listConversationMessagesStmt = settings.listConversationMessagesStmt;
    const selectConversationMessageByIdStmt = settings.selectConversationMessageByIdStmt;
    const updateConversationMessageMetadataStmt = settings.updateConversationMessageMetadataStmt;

    function listConversations(userId, limit = 40) {
        return listConversationsStmt.all(userId, Number(limit || 40))
            .map(row => normalizeConversation(row))
            .filter(Boolean);
    }

    function listArchivedConversations(userId, limit = 40) {
        return listArchivedConversationsStmt.all(userId, Number(limit || 40))
            .map(row => normalizeConversation(row))
            .filter(Boolean);
    }

    function getConversation(userId, conversationId) {
        return normalizeConversation(selectConversationByIdStmt.get(conversationId, userId));
    }

    function getArchivedConversation(userId, conversationId) {
        return normalizeConversation(selectArchivedConversationByIdStmt.get(conversationId, userId));
    }

    function getConversationMessageTimeline(userId, conversationId, limit = 400) {
        const conversation = getConversation(userId, conversationId);
        if (!conversation) return null;
        return buildConversationTimeline(
            listConversationMessagesStmt.all(conversationId, Number(limit || 400))
                .map(row => normalizeConversationMessage(row))
                .filter(Boolean)
        );
    }

    function getConversationMessages(userId, conversationId, limit = 200) {
        const timeline = getConversationMessageTimeline(userId, conversationId, limit);
        if (!timeline) return null;
        return buildDisplayedConversationMessages(timeline);
    }

    function getConversationMessage(userId, conversationId, messageId) {
        const conversation = getConversation(userId, conversationId);
        if (!conversation || !messageId) return null;
        const row = selectConversationMessageByIdStmt.get(messageId, conversationId);
        if (!row) return null;
        const message = normalizeConversationMessage(row);
        if (!message) return null;
        const timeline = getConversationMessageTimeline(userId, conversationId, 400) || [];
        return timeline.find(item => item.id === message.id) || message;
    }

    function getConversationPromptMessages(userId, conversationId, options = {}) {
        const displayedMessages = getConversationMessages(userId, conversationId, 400);
        if (!displayedMessages) return null;
        const targetTurnId = options.untilTurnId ? String(options.untilTurnId) : '';
        const promptMessages = [];

        for (const message of displayedMessages) {
            promptMessages.push({
                role: message.role,
                content: message.content
            });

            if (targetTurnId && message.role === 'user' && String(message.metadata?.turnId || '') === targetTurnId) {
                break;
            }
        }

        return promptMessages;
    }

    function setConversationTurnActiveAssistant(userId, conversationId, assistantMessageId) {
        const timeline = getConversationMessageTimeline(userId, conversationId, 400);
        if (!timeline || !assistantMessageId) return null;

        const assistantMessage = timeline.find(item => item.id === assistantMessageId && item.role === 'assistant');
        if (!assistantMessage) return null;

        const turnId = String(assistantMessage.metadata?.turnId || '');
        if (!turnId) return null;

        const userMessage = timeline.find(item => item.role === 'user' && String(item.metadata?.turnId || '') === turnId);
        if (!userMessage) return null;

        const nextMetadata = {
            ...(userMessage.metadata || {}),
            turnId,
            activeAssistantMessageId: assistantMessageId
        };

        updateConversationMessageMetadataStmt.run(JSON.stringify(nextMetadata), userMessage.id, conversationId);
        return getConversationMessages(userId, conversationId, 400);
    }

    return {
        listConversations,
        listArchivedConversations,
        getConversation,
        getArchivedConversation,
        getConversationMessageTimeline,
        getConversationMessages,
        getConversationMessage,
        getConversationPromptMessages,
        setConversationTurnActiveAssistant
    };
}

module.exports = {
    createStateStoreConversations
};
