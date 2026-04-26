'use strict';

function createStateStoreQueries(options) {
    const settings = options || {};
    const db = settings.db;
    const normalizeAuditLog = settings.normalizeAuditLog || function (value) { return value; };
    const normalizeTemplateRow = settings.normalizeTemplateRow || function (value) { return value; };
    const groupTemplates = settings.groupTemplates || function (items) { return items; };
    const buildAuditLogQuery = settings.buildAuditLogQuery || function () { return { whereSql: '', params: [] }; };
    const listTemplateFavoritesStmt = settings.listTemplateFavoritesStmt;
    const selectSystemTemplatesStmt = settings.selectSystemTemplatesStmt;
    const selectUserTemplatesStmt = settings.selectUserTemplatesStmt;
    const listAuditLogsStmt = settings.listAuditLogsStmt;

    function listTemplates(feature, userId) {
        const favorites = new Set(
            listTemplateFavoritesStmt.all(userId, feature)
                .map(row => `${row.templateKind}:${row.templateId}`)
        );
        const systemTemplates = selectSystemTemplatesStmt.all(feature)
            .map(row => normalizeTemplateRow(row, 'system', favorites))
            .filter(Boolean);
        const userTemplates = userId
            ? selectUserTemplatesStmt.all(userId, feature)
                .map(row => normalizeTemplateRow(row, 'user', favorites))
                .filter(Boolean)
            : [];

        return {
            feature,
            groups: groupTemplates(systemTemplates.concat(userTemplates))
        };
    }

    function listAuditLogs(limit = 100) {
        return listAuditLogsStmt.all(Number(limit || 100))
            .map(row => normalizeAuditLog(row))
            .filter(Boolean);
    }

    function queryAuditLogs(filters = {}) {
        const pageSize = Math.min(100, Math.max(1, Number(filters.pageSize || 10)));
        const page = Math.max(1, Number(filters.page || 1));
        const offset = (page - 1) * pageSize;
        const query = buildAuditLogQuery(filters);
        const countStmt = db.prepare(`
            SELECT COUNT(*) AS count
            FROM audit_logs
            ${query.whereSql}
        `);
        const itemsStmt = db.prepare(`
            SELECT id, action, actor_user_id AS actorUserId, target_user_id AS targetUserId,
                   actor_username AS actorUsername, target_username AS targetUsername,
                   actor_role AS actorRole, target_role AS targetRole, actor_ip AS actorIp,
                   actor_user_agent AS actorUserAgent, details_json AS detailsJson,
                   created_at AS createdAt
            FROM audit_logs
            ${query.whereSql}
            ORDER BY created_at DESC, id DESC
            LIMIT ? OFFSET ?
        `);
        const total = Number(countStmt.get(...query.params)?.count || 0);
        const items = itemsStmt.all(...query.params, pageSize, offset)
            .map(row => normalizeAuditLog(row))
            .filter(Boolean);

        return {
            items,
            page,
            pageSize,
            total,
            totalPages: Math.max(1, Math.ceil(total / pageSize)),
            hasMore: offset + items.length < total
        };
    }

    return {
        listTemplates,
        listAuditLogs,
        queryAuditLogs
    };
}

module.exports = {
    createStateStoreQueries
};
