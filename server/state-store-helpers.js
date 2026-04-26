const crypto = require('crypto');
const AppShell = require('../public/js/app-shell.js');

function safeParseJson(value, fallback) {
    if (!value) return fallback;
    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
}

function hashOpaqueToken(token) {
    return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

function createOpaqueToken() {
    return crypto.randomBytes(24).toString('hex');
}

function normalizeUserRecord(row) {
    if (!row) return null;
    return {
        id: row.id,
        username: row.username,
        email: row.email || null,
        displayName: row.displayName || row.username,
        status: row.status,
        role: row.role,
        planCode: row.planCode,
        timezone: row.timezone,
        locale: row.locale,
        lastLoginAt: row.lastLoginAt || null,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
    };
}

function getDefaultPreferences() {
    return {
        theme: 'dark',
        defaultModelChat: 'gpt-4.1-mini',
        defaultVoice: 'male-qn-qingse',
        defaultMusicStyle: '',
        defaultCoverRatio: '1:1',
        templatePreferencesJson: '{}'
    };
}

function normalizeCredentialRecord(row) {
    if (!row) return null;
    return {
        userId: row.userId,
        passwordHash: row.passwordHash,
        passwordUpdatedAt: Number(row.passwordUpdatedAt || 0),
        mustResetPassword: Boolean(row.mustResetPassword),
        failedLoginCount: Number(row.failedLoginCount || 0),
        lockedUntil: row.lockedUntil || null
    };
}

function normalizePreferences(row) {
    return {
        ...getDefaultPreferences(),
        ...(row || {})
    };
}

function buildConversationTitle(text) {
    const normalized = String(text || '').replace(/\s+/g, ' ').trim();
    if (!normalized) return '新对话';
    return normalized.length > 48 ? `${normalized.slice(0, 48)}...` : normalized;
}

function buildConversationPreview(text) {
    const normalized = String(text || '').replace(/\s+/g, ' ').trim();
    if (!normalized) return '';
    return normalized.length > 140 ? `${normalized.slice(0, 140)}...` : normalized;
}

function normalizeConversation(row) {
    if (!row) return null;
    return {
        id: row.id,
        userId: row.userId,
        feature: row.feature || 'chat',
        title: row.title || '新对话',
        model: row.model || 'gpt-4.1-mini',
        messageCount: Number(row.messageCount || 0),
        lastMessageAt: row.lastMessageAt || null,
        preview: buildConversationPreview(row.preview || ''),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        archivedAt: row.archivedAt || null
    };
}

function normalizeConversationMessage(row) {
    if (!row) return null;
    return {
        id: row.id,
        conversationId: row.conversationId,
        role: row.role,
        content: row.content,
        createdAt: row.createdAt,
        tokens: safeParseJson(row.tokensJson, null),
        metadata: safeParseJson(row.metadataJson, {}) || {}
    };
}

function buildConversationTimeline(messages) {
    const timeline = [];
    let currentTurnId = null;

    messages.forEach(message => {
        if (!message) return;
        const baseMetadata = message.metadata && typeof message.metadata === 'object' ? { ...message.metadata } : {};
        let turnId = baseMetadata.turnId ? String(baseMetadata.turnId) : '';

        if (message.role === 'user') {
            turnId = turnId || `legacy-turn-${message.id}`;
            currentTurnId = turnId;
        } else if (message.role === 'assistant') {
            turnId = turnId || currentTurnId || `legacy-turn-${message.id}`;
        }

        timeline.push({
            ...message,
            metadata: {
                ...baseMetadata,
                turnId
            }
        });
    });

    return timeline;
}

function buildDisplayedConversationMessages(messages) {
    const timeline = buildConversationTimeline(messages);
    const assistantGroups = new Map();
    const emittedTurnIds = new Set();
    const displayed = [];

    timeline.forEach(message => {
        if (message.role !== 'assistant') return;
        const turnId = String(message.metadata?.turnId || `legacy-turn-${message.id}`);
        const existing = assistantGroups.get(turnId) || [];
        existing.push(message);
        assistantGroups.set(turnId, existing);
    });

    const getActiveAssistantForTurn = (turnId, userMessage) => {
        const versions = assistantGroups.get(turnId) || [];
        if (!versions.length) return null;

        const activeAssistantId = String(userMessage?.metadata?.activeAssistantMessageId || '').trim();
        const activeVersion = versions.find(item => item.id === activeAssistantId) || versions[versions.length - 1];
        const activeVersionIndex = Math.max(1, versions.findIndex(item => item.id === activeVersion.id) + 1);

        return {
            ...activeVersion,
            metadata: {
                ...(activeVersion.metadata || {}),
                turnId
            },
            versionCount: versions.length,
            activeVersionIndex,
            versions: versions.map((item, index) => ({
                id: item.id,
                createdAt: item.createdAt,
                active: item.id === activeVersion.id,
                versionIndex: index + 1
            }))
        };
    };

    timeline.forEach(message => {
        if (message.role === 'user') {
            displayed.push(message);
            const turnId = String(message.metadata?.turnId || '');
            if (turnId && !emittedTurnIds.has(turnId)) {
                const activeAssistant = getActiveAssistantForTurn(turnId, message);
                if (activeAssistant) {
                    displayed.push(activeAssistant);
                    emittedTurnIds.add(turnId);
                }
            }
            return;
        }

        const turnId = String(message.metadata?.turnId || '');
        if (!turnId || emittedTurnIds.has(turnId)) {
            return;
        }

        const activeAssistant = getActiveAssistantForTurn(turnId, null);
        if (activeAssistant) {
            displayed.push(activeAssistant);
            emittedTurnIds.add(turnId);
        }
    });

    return displayed;
}

function getUsageDate(date = new Date()) {
    return date.toISOString().slice(0, 10);
}

function normalizeTask(row) {
    if (!row) return null;
    const output = safeParseJson(row.outputPayload, null) || {};
    return {
        taskId: row.taskId,
        userId: row.userId || null,
        feature: row.feature,
        status: row.status,
        progress: row.progress,
        url: output.url,
        duration: output.duration,
        size: output.size,
        error: row.error || undefined,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        inputPayload: safeParseJson(row.inputPayload, null),
        outputPayload: output
    };
}

function normalizeAuditLog(row) {
    if (!row) return null;
    return {
        id: Number(row.id),
        action: row.action,
        actorUserId: row.actorUserId || null,
        targetUserId: row.targetUserId || null,
        actorUsername: row.actorUsername || null,
        targetUsername: row.targetUsername || null,
        actorRole: row.actorRole || null,
        targetRole: row.targetRole || null,
        actorIp: row.actorIp || null,
        actorUserAgent: row.actorUserAgent || null,
        details: safeParseJson(row.detailsJson, {}) || {},
        createdAt: Number(row.createdAt || 0)
    };
}

function normalizeAuthTokenRecord(row) {
    if (!row) return null;
    return {
        id: row.id,
        userId: row.userId,
        purpose: row.purpose,
        requestedIdentity: row.requestedIdentity || null,
        createdByUserId: row.createdByUserId || null,
        metadata: safeParseJson(row.metadataJson, {}) || {},
        createdAt: Number(row.createdAt || 0),
        expiresAt: Number(row.expiresAt || 0),
        usedAt: row.usedAt ? Number(row.usedAt) : null
    };
}

function buildAuthTokenSummary(record, options = {}) {
    if (!record) return null;
    const now = Number(options.now || Date.now());
    const status = options.status || (
        record.usedAt ? 'used' : record.expiresAt > now ? 'active' : 'expired'
    );
    return {
        id: record.id,
        purpose: record.purpose,
        requestedIdentity: record.requestedIdentity || null,
        createdByUserId: record.createdByUserId || null,
        createdAt: record.createdAt,
        expiresAt: record.expiresAt,
        usedAt: record.usedAt || null,
        active: status === 'active',
        status
    };
}

function getEmptyUsage(usageDate) {
    return {
        usageDate,
        chatCount: 0,
        lyricsCount: 0,
        musicCount: 0,
        imageCount: 0,
        speechCount: 0,
        coverCount: 0,
        inputTokens: 0,
        outputTokens: 0,
        storageBytes: 0
    };
}

function normalizeTemplateRow(row, kind, favorites = new Set()) {
    if (!row) return null;
    const payload = safeParseJson(row.payload, {}) || {};
    return {
        id: row.id,
        feature: row.feature,
        category: row.category,
        label: row.label,
        description: row.description || '',
        source: kind,
        favorite: favorites.has(`${kind}:${row.id}`),
        ...payload
    };
}

function groupTemplates(items) {
    const groups = new Map();
    items.forEach(item => {
        if (!groups.has(item.category)) {
            groups.set(item.category, { category: item.category, items: [] });
        }
        groups.get(item.category).items.push(item);
    });
    return Array.from(groups.values());
}

function buildAuditLogQuery(filters = {}) {
    const where = [];
    const params = [];

    const action = String(filters.action || '').trim();
    if (action) {
        where.push('action = ?');
        params.push(action);
    }

    const actorUsername = String(filters.actorUsername || '').trim().toLowerCase();
    if (actorUsername) {
        where.push('LOWER(COALESCE(actor_username, \'\')) LIKE ?');
        params.push(`%${actorUsername}%`);
    }

    const targetUsername = String(filters.targetUsername || '').trim().toLowerCase();
    if (targetUsername) {
        where.push('LOWER(COALESCE(target_username, \'\')) LIKE ?');
        params.push(`%${targetUsername}%`);
    }

    const createdFrom = Number(filters.createdFrom || 0);
    if (Number.isFinite(createdFrom) && createdFrom > 0) {
        where.push('created_at >= ?');
        params.push(createdFrom);
    }

    const createdTo = Number(filters.createdTo || 0);
    if (Number.isFinite(createdTo) && createdTo > 0) {
        where.push('created_at <= ?');
        params.push(createdTo);
    }

    return {
        whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '',
        params
    };
}

function buildSystemTemplateSeed() {
    const library = AppShell.TEMPLATE_LIBRARY || {};
    const rows = [];
    Object.entries(library).forEach(([feature, groups]) => {
        groups.forEach((group, groupIndex) => {
            (group.items || []).forEach((item, itemIndex) => {
                rows.push({
                    id: `sys_${feature}_${groupIndex}_${itemIndex}`,
                    feature,
                    category: group.category || '系统模板',
                    label: item.label || `模板 ${itemIndex + 1}`,
                    description: item.description || '',
                    payload: item.message ? { message: item.message } : { values: item.values || {} },
                    sortOrder: groupIndex * 100 + itemIndex
                });
            });
        });
    });
    return rows;
}

module.exports = {
    safeParseJson,
    hashOpaqueToken,
    createOpaqueToken,
    normalizeUserRecord,
    getDefaultPreferences,
    normalizeCredentialRecord,
    normalizePreferences,
    buildConversationTitle,
    buildConversationPreview,
    normalizeConversation,
    normalizeConversationMessage,
    buildConversationTimeline,
    buildDisplayedConversationMessages,
    getUsageDate,
    normalizeTask,
    normalizeAuditLog,
    normalizeAuthTokenRecord,
    buildAuthTokenSummary,
    getEmptyUsage,
    normalizeTemplateRow,
    groupTemplates,
    buildAuditLogQuery,
    buildSystemTemplateSeed
};
