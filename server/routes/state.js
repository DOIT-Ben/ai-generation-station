const { parseCookies, sendJson, setCookie, clearCookie } = require('../lib/http');

function createStateRoutes({ stateStore, sessionCookieName, authConfig }) {
    function getPathParts(req) {
        return String(req.url || '').split('?')[0].split('/').filter(Boolean);
    }

    function getCurrentSession(req) {
        const cookies = parseCookies(req.headers.cookie || '');
        const token = cookies[sessionCookieName];
        const session = stateStore.getSession(token);
        if (session && session.status !== 'active') {
            stateStore.clearSession(token);
            return { token, session: null };
        }
        return { token, session };
    }

    function requireUser(req, res) {
        const { session } = getCurrentSession(req);
        if (!session) {
            sendJson(res, 401, { error: '未登录' });
            return null;
        }
        return session;
    }

    function requireAdmin(req, res) {
        const session = requireUser(req, res);
        if (!session) return null;
        if (session.role !== 'admin') {
            sendJson(res, 403, { error: '需要管理员权限' });
            return null;
        }
        return session;
    }

    return {
        '/api/auth/session': async (req, res) => {
            const { session } = getCurrentSession(req);
            if (!session) {
                sendJson(res, 401, { authenticated: false });
                return null;
            }
            return {
                authenticated: true,
                user: {
                    id: session.userId,
                    username: session.username,
                    role: session.role,
                    planCode: session.planCode
                }
            };
        },

        '/api/auth/login': async (req, res, body) => {
            const username = String(body.username || '').trim();
            const password = String(body.password || '');

            const user = stateStore.authenticateUser(username, password);
            if (user?.error) {
                sendJson(res, 423, { error: user.error });
                return null;
            }

            if (!user) {
                sendJson(res, 401, { error: '账号或密码不正确' });
                return null;
            }

            const session = stateStore.createSession(user);
            setCookie(res, sessionCookieName, session.token, {
                httpOnly: true,
                sameSite: 'Lax',
                maxAge: Math.floor((session.expiresAt - session.createdAt) / 1000),
                path: '/'
            });

            return {
                success: true,
                user: {
                    id: user.id,
                    username: user.username,
                    role: user.role,
                    planCode: user.planCode
                }
            };
        },

        '/api/auth/logout': async (req, res) => {
            const { token } = getCurrentSession(req);
            stateStore.clearSession(token);
            clearCookie(res, sessionCookieName, { path: '/' });
            return { success: true };
        },

        '/api/history/*': async (req, res, body) => {
            const session = requireUser(req, res);
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

        '/api/preferences': async (req, res, body) => {
            const session = requireUser(req, res);
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
            const session = requireUser(req, res);
            if (!session) return null;

            return {
                usage: stateStore.getUsageDaily(session.userId)
            };
        },

        '/api/templates/*': async (req, res, body) => {
            const session = requireUser(req, res);
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
        },

        '/api/admin/users': async (req, res) => {
            const session = requireAdmin(req, res);
            if (!session) return null;

            return {
                users: stateStore.listUsers()
            };
        },

        '/api/admin/users/*': async (req, res, body) => {
            const session = requireAdmin(req, res);
            if (!session) return null;

            const parts = getPathParts(req);
            const userId = parts[3];
            if (!userId) {
                sendJson(res, 400, { error: 'user id is required' });
                return null;
            }
            if (!body || typeof body !== 'object') {
                sendJson(res, 400, { error: 'user patch is required' });
                return null;
            }

            const user = stateStore.updateUser(userId, {
                status: body.status,
                role: body.role,
                planCode: body.planCode
            });

            if (!user) {
                sendJson(res, 404, { error: 'user not found' });
                return null;
            }

            return { user };
        }
    };
}

module.exports = {
    createStateRoutes
};
