const crypto = require('crypto');

function createStateStoreMutations(options) {
    const settings = options || {};
    const db = settings.db;
    const maxHistoryItems = Number(settings.maxHistoryItems || 12);
    const buildConversationTitle = settings.buildConversationTitle;
    const normalizeConversationMessage = settings.normalizeConversationMessage;
    const safeParseJson = settings.safeParseJson;
    const normalizePreferences = settings.normalizePreferences;
    const normalizeTask = settings.normalizeTask;
    const getUsageDate = settings.getUsageDate;
    const groupTemplates = settings.groupTemplates;
    const normalizeTemplateRow = settings.normalizeTemplateRow;

    const getConversation = settings.getConversation;
    const getArchivedConversation = settings.getArchivedConversation;
    const getConversationMessage = settings.getConversationMessage;
    const getConversationTimeline = settings.getConversationTimeline;
    const getConversationMessages = settings.getConversationMessages;
    const getPreferences = settings.getPreferences;
    const getUsageDaily = settings.getUsageDaily;
    const getTask = settings.getTask;
    const listTemplates = settings.listTemplates;

    const insertConversationStmt = settings.insertConversationStmt;
    const updateConversationStmt = settings.updateConversationStmt;
    const archiveConversationStmt = settings.archiveConversationStmt;
    const restoreConversationStmt = settings.restoreConversationStmt;
    const deleteArchivedConversationStmt = settings.deleteArchivedConversationStmt;
    const insertConversationMessageStmt = settings.insertConversationMessageStmt;
    const listConversationMessagesStmt = settings.listConversationMessagesStmt;
    const insertHistoryStmt = settings.insertHistoryStmt;
    const pruneHistoryStmt = settings.pruneHistoryStmt;
    const selectHistoryStmt = settings.selectHistoryStmt;
    const getPreferencesStmt = settings.getPreferencesStmt;
    const upsertPreferencesStmt = settings.upsertPreferencesStmt;
    const getUsageDailyStmt = settings.getUsageDailyStmt;
    const upsertUsageStmt = settings.upsertUsageStmt;
    const insertTaskStmt = settings.insertTaskStmt;
    const updateTaskStmt = settings.updateTaskStmt;
    const getTaskStmt = settings.getTaskStmt;
    const listTemplateFavoritesStmt = settings.listTemplateFavoritesStmt;
    const selectSystemTemplatesStmt = settings.selectSystemTemplatesStmt;
    const selectUserTemplatesStmt = settings.selectUserTemplatesStmt;
    const insertUserTemplateStmt = settings.insertUserTemplateStmt;
    const getTemplateFavoriteStmt = settings.getTemplateFavoriteStmt;
    const deleteTemplateFavoriteStmt = settings.deleteTemplateFavoriteStmt;
    const insertTemplateFavoriteStmt = settings.insertTemplateFavoriteStmt;

    function createConversation(userId, payload = {}) {
        const now = Date.now();
        const id = `conv_${crypto.randomUUID()}`;
        insertConversationStmt.run(
            id,
            userId,
            'chat',
            buildConversationTitle(payload.title || '新对话'),
            payload.model || 'gpt-4.1-mini',
            0,
            null,
            now,
            now
        );
        return getConversation(userId, id);
    }

    function updateConversation(userId, conversationId, payload = {}) {
        const conversation = getConversation(userId, conversationId);
        if (!conversation) return null;

        const nextTitle = Object.prototype.hasOwnProperty.call(payload, 'title')
            ? buildConversationTitle(payload.title)
            : conversation.title;
        const nextModel = Object.prototype.hasOwnProperty.call(payload, 'model') && String(payload.model || '').trim()
            ? String(payload.model || '').trim()
            : conversation.model;
        const now = Date.now();

        updateConversationStmt.run(
            nextTitle,
            nextModel,
            conversation.messageCount,
            conversation.lastMessageAt,
            now,
            conversationId,
            userId
        );

        return getConversation(userId, conversationId);
    }

    function archiveConversation(userId, conversationId) {
        const conversation = getConversation(userId, conversationId);
        if (!conversation) return null;

        const now = Date.now();
        archiveConversationStmt.run(now, now, conversationId, userId);
        return getArchivedConversation(userId, conversationId);
    }

    function restoreConversation(userId, conversationId) {
        const conversation = getArchivedConversation(userId, conversationId);
        if (!conversation) return null;

        const now = Date.now();
        restoreConversationStmt.run(now, conversationId, userId);
        return getConversation(userId, conversationId);
    }

    function deleteArchivedConversation(userId, conversationId) {
        const conversation = getArchivedConversation(userId, conversationId);
        if (!conversation) return null;

        deleteArchivedConversationStmt.run(conversationId, userId);
        return conversation;
    }

    function appendConversationMessage(userId, conversationId, message = {}) {
        const conversation = getConversation(userId, conversationId);
        if (!conversation) return null;

        const role = String(message.role || '').trim();
        const content = String(message.content || '').trim();
        if (!['user', 'assistant'].includes(role) || !content) {
            throw new Error('invalid conversation message');
        }

        const metadata = message.metadata && typeof message.metadata === 'object'
            ? { ...message.metadata }
            : {};
        const now = Number(message.createdAt || Date.now());
        const nextMessageCount = conversation.messageCount + 1;
        const nextTitle = conversation.messageCount === 0 && role === 'user'
            ? buildConversationTitle(content)
            : conversation.title;
        const nextModel = message.model || conversation.model || 'gpt-4.1-mini';
        const messageId = crypto.randomUUID();

        db.exec('BEGIN');
        try {
            insertConversationMessageStmt.run(
                messageId,
                conversationId,
                role,
                content,
                JSON.stringify(message.tokens || null),
                JSON.stringify(metadata),
                now
            );
            updateConversationStmt.run(
                nextTitle,
                nextModel,
                nextMessageCount,
                now,
                now,
                conversationId,
                userId
            );
            db.exec('COMMIT');
        } catch (error) {
            db.exec('ROLLBACK');
            throw error;
        }

        return {
            conversation: getConversation(userId, conversationId),
            message: getConversationMessage(userId, conversationId, messageId)
        };
    }

    function getHistory(userId, feature) {
        return selectHistoryStmt.all(userId, feature, maxHistoryItems)
            .map(row => safeParseJson(row.payload, null))
            .filter(Boolean);
    }

    function appendHistory(userId, feature, entry) {
        const now = Number(entry?.timestamp || Date.now());
        db.exec('BEGIN');
        try {
            insertHistoryStmt.run(userId, feature, JSON.stringify(entry), now);
            pruneHistoryStmt.run(userId, feature, userId, feature, maxHistoryItems);
            const items = getHistory(userId, feature);
            db.exec('COMMIT');
            return items;
        } catch (error) {
            db.exec('ROLLBACK');
            throw error;
        }
    }

    function getPreferencesInternal(userId) {
        return normalizePreferences(getPreferencesStmt.get(userId));
    }

    function updatePreferences(userId, patch = {}) {
        const current = getPreferences(userId);
        const next = {
            ...current,
            ...patch
        };
        const now = Date.now();
        upsertPreferencesStmt.run(
            userId,
            next.theme,
            next.defaultModelChat,
            next.defaultVoice,
            next.defaultMusicStyle,
            next.defaultCoverRatio,
            typeof next.templatePreferencesJson === 'string' ? next.templatePreferencesJson : JSON.stringify(next.templatePreferencesJson || {}),
            current.createdAt || now,
            now
        );
        return getPreferencesInternal(userId);
    }

    function getUsageDailyInternal(userId, usageDate = getUsageDate()) {
        return getUsageDailyStmt.get(userId, usageDate) || getUsageDaily(userId, usageDate);
    }

    function incrementUsageDaily(userId, feature, metrics = {}) {
        const counters = {
            chat: [1, 0, 0, 0, 0, 0],
            lyrics: [0, 1, 0, 0, 0, 0],
            music: [0, 0, 1, 0, 0, 0],
            image: [0, 0, 0, 1, 0, 0],
            speech: [0, 0, 0, 0, 1, 0],
            cover: [0, 0, 0, 0, 0, 1]
        }[feature] || [0, 0, 0, 0, 0, 0];

        const usageDate = metrics.usageDate || getUsageDate();
        upsertUsageStmt.run(
            userId,
            usageDate,
            counters[0],
            counters[1],
            counters[2],
            counters[3],
            counters[4],
            counters[5],
            Number(metrics.inputTokens || 0),
            Number(metrics.outputTokens || 0),
            Number(metrics.storageBytes || 0)
        );
        return getUsageDailyInternal(userId, usageDate);
    }

    function createTask(task) {
        const now = Date.now();
        insertTaskStmt.run(
            task.taskId,
            task.userId || null,
            task.feature,
            task.status || 'pending',
            Number(task.progress || 0),
            JSON.stringify(task.inputPayload || {}),
            JSON.stringify(task.outputPayload || {}),
            task.error || null,
            task.createdAt || now,
            now
        );
        return getTask(task.taskId);
    }

    function updateTask(taskId, patch = {}) {
        const current = getTask(taskId);
        if (!current) return null;
        const nextOutput = patch.outputPayload !== undefined
            ? patch.outputPayload
            : current.outputPayload || {};
        updateTaskStmt.run(
            patch.status || current.status,
            patch.progress != null ? Number(patch.progress) : Number(current.progress || 0),
            JSON.stringify(nextOutput || {}),
            patch.error !== undefined ? patch.error : current.error || null,
            Date.now(),
            taskId
        );
        return getTask(taskId);
    }

    function createUserTemplate(userId, feature, template) {
        const payload = template.message ? { message: String(template.message) } : { values: template.values || {} };
        const now = Date.now();
        const id = `usr_${crypto.randomUUID()}`;
        insertUserTemplateStmt.run(
            id,
            userId,
            feature,
            template.category || '我的模板',
            template.label,
            template.description || '',
            JSON.stringify(payload),
            now,
            now
        );
        return listTemplates(feature, userId).groups
            .flatMap(group => group.items)
            .find(item => item.id === id) || null;
    }

    function toggleTemplateFavorite(userId, feature, templateId) {
        const templateKind = String(templateId || '').startsWith('usr_') ? 'user' : 'system';
        const existing = getTemplateFavoriteStmt.get(userId, templateKind, templateId);
        if (existing) {
            deleteTemplateFavoriteStmt.run(userId, templateKind, templateId);
            return { favorite: false, templateId, templateKind };
        }
        insertTemplateFavoriteStmt.run(userId, feature, templateKind, templateId, Date.now());
        return { favorite: true, templateId, templateKind };
    }

    return {
        createConversation,
        updateConversation,
        archiveConversation,
        restoreConversation,
        deleteArchivedConversation,
        appendConversationMessage,
        getHistory,
        appendHistory,
        updatePreferences,
        incrementUsageDaily,
        createTask,
        updateTask,
        createUserTemplate,
        toggleTemplateFavorite
    };
}

module.exports = {
    createStateStoreMutations
};
