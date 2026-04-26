const { sendJson } = require('../lib/http');

function createStateWorkspaceRoutes(options) {
    const settings = options || {};
    const stateStore = settings.stateStore;
    const requireReadyUser = settings.requireReadyUser;
    const getPathParts = settings.getPathParts;

    return {
        '/api/history/*': async (req, res, body) => {
            const session = requireReadyUser(req, res);
            if (!session) return null;

            const feature = req.url.replace('/api/history/', '').split('?')[0];
            if (!feature) {
                sendJson(res, 400, { error: 'feature is required' });
                return null;
            }

            if (req.method === 'GET') {
                return {
                    items: stateStore.getHistory(session.userId, feature)
                };
            }

            if (!body || typeof body !== 'object' || !body.entry) {
                sendJson(res, 400, { error: 'entry is required' });
                return null;
            }

            return {
                items: stateStore.appendHistory(session.userId, feature, body.entry)
            };
        },

        '/api/conversations': async (req, res, body) => {
            const session = requireReadyUser(req, res);
            if (!session) return null;

            if (req.method === 'GET') {
                return {
                    conversations: stateStore.listConversations(session.userId)
                };
            }

            return {
                conversation: stateStore.createConversation(session.userId, {
                    title: body?.title,
                    model: body?.model
                }),
                messages: []
            };
        },

        '/api/conversations/archived': async (req, res) => {
            const session = requireReadyUser(req, res);
            if (!session) return null;

            return {
                conversations: stateStore.listArchivedConversations(session.userId)
            };
        },

        '/api/conversations/*': async (req, res, body) => {
            const session = requireReadyUser(req, res);
            if (!session) return null;

            const parts = getPathParts(req);
            const conversationId = parts[2];
            const action = parts[3];
            if (!conversationId) {
                sendJson(res, 400, { error: 'conversation id is required' });
                return null;
            }

            if (req.method === 'GET') {
                if (action) {
                    sendJson(res, 404, { error: 'conversation action not found' });
                    return null;
                }

                const conversation = stateStore.getConversation(session.userId, conversationId);
                if (!conversation) {
                    sendJson(res, 404, { error: 'conversation not found' });
                    return null;
                }

                return {
                    conversation,
                    messages: stateStore.getConversationMessages(session.userId, conversationId) || []
                };
            }

            if (action === 'archive') {
                const archivedConversation = stateStore.archiveConversation(session.userId, conversationId);
                if (!archivedConversation) {
                    sendJson(res, 404, { error: 'conversation not found' });
                    return null;
                }

                return {
                    archivedConversation,
                    archivedConversationId: conversationId,
                    conversations: stateStore.listConversations(session.userId),
                    archivedConversations: stateStore.listArchivedConversations(session.userId)
                };
            }

            if (action === 'restore') {
                const conversation = stateStore.restoreConversation(session.userId, conversationId);
                if (!conversation) {
                    sendJson(res, 404, { error: 'conversation not found' });
                    return null;
                }

                return {
                    conversation,
                    conversations: stateStore.listConversations(session.userId),
                    archivedConversations: stateStore.listArchivedConversations(session.userId)
                };
            }

            if (action === 'delete') {
                const deletedConversation = stateStore.deleteArchivedConversation(session.userId, conversationId);
                if (!deletedConversation) {
                    sendJson(res, 404, { error: 'conversation not found' });
                    return null;
                }

                return {
                    deletedConversation,
                    deletedConversationId: conversationId,
                    conversations: stateStore.listConversations(session.userId),
                    archivedConversations: stateStore.listArchivedConversations(session.userId)
                };
            }

            if (action === 'messages') {
                const messageId = parts[4];
                const messageAction = parts[5];
                if (messageAction !== 'activate' || !messageId) {
                    sendJson(res, 404, { error: 'conversation message action not found' });
                    return null;
                }

                const conversation = stateStore.getConversation(session.userId, conversationId);
                if (!conversation) {
                    sendJson(res, 404, { error: 'conversation not found' });
                    return null;
                }

                const messages = stateStore.setConversationTurnActiveAssistant(session.userId, conversationId, messageId);
                if (!messages) {
                    sendJson(res, 404, { error: 'conversation message not found' });
                    return null;
                }

                return {
                    conversation,
                    messages
                };
            }

            if (action) {
                sendJson(res, 404, { error: 'conversation action not found' });
                return null;
            }

            if (!body || typeof body !== 'object') {
                sendJson(res, 400, { error: 'conversation patch is required' });
                return null;
            }

            if (!Object.prototype.hasOwnProperty.call(body, 'title') && !Object.prototype.hasOwnProperty.call(body, 'model')) {
                sendJson(res, 400, { error: 'conversation patch must include title or model' });
                return null;
            }

            const conversation = stateStore.updateConversation(session.userId, conversationId, {
                title: body.title,
                model: body.model
            });
            if (!conversation) {
                sendJson(res, 404, { error: 'conversation not found' });
                return null;
            }

            return {
                conversation
            };
        },

        '/api/preferences': async (req, res, body) => {
            const session = requireReadyUser(req, res);
            if (!session) return null;

            if (req.method === 'GET') {
                return {
                    preferences: stateStore.getPreferences(session.userId)
                };
            }

            if (!body || typeof body !== 'object') {
                sendJson(res, 400, { error: 'preferences payload is required' });
                return null;
            }

            return {
                preferences: stateStore.updatePreferences(session.userId, body)
            };
        },

        '/api/usage/today': async (req, res) => {
            const session = requireReadyUser(req, res);
            if (!session) return null;

            return {
                usage: stateStore.getUsageDaily(session.userId)
            };
        },

        '/api/templates/*': async (req, res, body) => {
            const session = requireReadyUser(req, res);
            if (!session) return null;

            const parts = getPathParts(req);
            const feature = parts[2];
            if (!feature) {
                sendJson(res, 400, { error: 'feature is required' });
                return null;
            }

            if (req.method === 'GET' && parts.length === 3) {
                return stateStore.listTemplates(feature, session.userId);
            }

            if (req.method === 'POST' && parts.length === 3) {
                if (!body || typeof body !== 'object' || !body.label || (!body.message && !body.values)) {
                    sendJson(res, 400, { error: 'template label and message/values are required' });
                    return null;
                }
                return {
                    template: stateStore.createUserTemplate(session.userId, feature, body)
                };
            }

            if (req.method === 'POST' && parts.length === 5 && parts[4] === 'favorite') {
                return stateStore.toggleTemplateFavorite(session.userId, feature, parts[3]);
            }

            sendJson(res, 404, { error: 'template route not found' });
            return null;
        }
    };
}

module.exports = {
    createStateWorkspaceRoutes
};
