const { parseCookies, sendJson, setCookie, clearCookie } = require('../lib/http');

function createStateRoutes({ stateStore, sessionCookieName, authConfig }) {
    function getCurrentSession(req) {
        const cookies = parseCookies(req.headers.cookie || '');
        const token = cookies[sessionCookieName];
        const session = stateStore.getSession(token);
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
        }
    };
}

module.exports = {
    createStateRoutes
};
