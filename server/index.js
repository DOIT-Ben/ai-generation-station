/**
 * AI 内容生成站 - 后端服务器
 * 统一处理所有 MiniMax API 调用
 */

const http = require('http');
const url = require('url');
const path = require('path');
const https = require('https');

const { createConfig } = require('./config');
const { ROUTE_METHODS, API_KEY_REQUIRED_ROUTES } = require('./route-meta');
const { matchRoute, readJsonBody, sendJson, serveStaticFile, parseCookies } = require('./lib/http');
const { createLocalRoutes } = require('./routes/local');
const { createServiceRoutes } = require('./routes/service');
const { createTaskRoutes } = require('./routes/tasks');
const { createStateRoutes } = require('./routes/state');
const { createStateStore } = require('./state-store');

function createServer(options = {}) {
    const config = options.config || createConfig(options);
    const {
        PUBLIC_DIR,
        PORT,
        OUTPUT_DIR,
        API_HOST,
        API_KEY,
        APP_USERNAME,
        APP_PASSWORD,
        SESSION_COOKIE_NAME,
        SESSION_TTL_MS,
        APP_STATE_DB,
        LEGACY_STATE_FILE,
        MAX_HISTORY_ITEMS,
        MIME_TYPES
    } = config;

    const musicTasks = new Map();
    const imageTasks = new Map();
    const coverTasks = new Map();
    const stateStore = createStateStore({
        dbPath: APP_STATE_DB,
        legacyFilePath: LEGACY_STATE_FILE,
        sessionTtlMs: SESSION_TTL_MS,
        maxHistoryItems: MAX_HISTORY_ITEMS,
        seedUser: {
            username: APP_USERNAME,
            password: APP_PASSWORD,
            displayName: 'Studio Admin',
            role: 'admin',
            planCode: 'internal'
        }
    });

    const trackUsage = (userId, feature, metrics = {}) => {
        if (!userId) return;
        try {
            stateStore.incrementUsageDaily(userId, feature, metrics);
        } catch {
            // Do not fail the user request if usage tracking has issues.
        }
    };

    const statefulRoutes = {
        ...createStateRoutes({
            stateStore,
            sessionCookieName: SESSION_COOKIE_NAME,
            authConfig: {
                username: APP_USERNAME,
                password: APP_PASSWORD
            }
        }),
        ...createLocalRoutes({ OUTPUT_DIR, MIME_TYPES, musicTasks, coverTasks, imageTasks, stateStore }),
        ...createServiceRoutes({ https, API_HOST, API_KEY, OUTPUT_DIR, trackUsage }),
        ...createTaskRoutes({ https, API_HOST, API_KEY, OUTPUT_DIR, musicTasks, imageTasks, coverTasks, trackUsage, stateStore })
    };

    const server = http.createServer(async (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.setHeader('Access-Control-Allow-Credentials', 'true');

        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }

        const cookies = parseCookies(req.headers.cookie || '');
        const sessionToken = cookies[SESSION_COOKIE_NAME];
        req.authSession = stateStore.getSession(sessionToken);

        const parsedUrl = url.parse(req.url, true);
        const { handler, matchedRoute } = matchRoute(parsedUrl.pathname, statefulRoutes);

        if (handler) {
            const allowedMethods = ROUTE_METHODS[matchedRoute] || ['GET', 'POST'];
            if (!allowedMethods.includes(req.method)) {
                sendJson(res, 405, { error: `Method ${req.method} not allowed` });
                return;
            }
        }

        if (!handler) {
            const requestedPath = parsedUrl.pathname === '/' ? 'index.html' : parsedUrl.pathname.replace(/^\/+/, '');
            const filepath = path.normalize(path.join(PUBLIC_DIR, requestedPath));
            const publicRoot = `${PUBLIC_DIR}${path.sep}`;

            if (filepath !== PUBLIC_DIR && !filepath.startsWith(publicRoot)) {
                res.writeHead(403);
                res.end('Forbidden');
                return;
            }

            try {
                serveStaticFile(res, filepath, MIME_TYPES);
            } catch {
                res.writeHead(404);
                res.end('Not found');
            }
            return;
        }

        try {
            let body = {};
            if (req.method === 'POST') {
                try {
                    body = await readJsonBody(req);
                } catch {
                    sendJson(res, 400, { error: 'Invalid JSON body' });
                    return;
                }
            }

            if (API_KEY_REQUIRED_ROUTES.has(matchedRoute) && !API_KEY) {
                sendJson(res, 503, { error: 'MINIMAX_API_KEY is not configured' });
                return;
            }

            const result = await handler(req, res, body);
            if (result === null) return;

            sendJson(res, 200, result);
        } catch (error) {
            sendJson(res, 500, { error: error.message });
        }
    });

    server.appConfig = config;
    server.appStateStore = stateStore;
    return server;
}

function startServer(options = {}) {
    const server = createServer(options);
    const { PORT } = server.appConfig;
    server.listen(PORT, () => {
        console.log(`🎙️ AI 内容生成站已启动: http://localhost:${PORT}`);
    });
    return server;
}

if (require.main === module) {
    startServer();
}

module.exports = {
    createServer,
    startServer
};
