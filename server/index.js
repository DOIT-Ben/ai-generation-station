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
const { createSystemRoutes } = require('./routes/system');
const { createStateStore } = require('./state-store');
const { createNotificationService } = require('./lib/notifications');
const {
    applySecurityHeaders,
    applyCorsHeaders,
    getRequestProtocol
} = require('./lib/request-security');

function createServer(options = {}) {
    const config = options.config || createConfig(options);
    const httpsClient = options.https || https;
    const {
        PUBLIC_DIR,
        PORT,
        OUTPUT_DIR,
        API_HOST,
        API_KEY,
        APP_USERNAME,
        APP_PASSWORD,
        APP_BASE_URL,
        SESSION_COOKIE_NAME,
        SESSION_TTL_MS,
        SESSION_COOKIE_SECURE,
        SESSION_COOKIE_SAME_SITE,
        PUBLIC_REGISTRATION_ENABLED,
        APP_STATE_DB,
        LEGACY_STATE_FILE,
        MAX_HISTORY_ITEMS,
        SECURITY_RATE_LIMITS,
        TRUST_PROXY,
        ALLOWED_ORIGINS,
        HEALTHCHECK_PATH,
        CONTENT_SECURITY_POLICY,
        NOTIFICATION_DELIVERY_MODE,
        NOTIFICATION_FROM_EMAIL,
        RESEND_API_KEY,
        MIME_TYPES
    } = config;
    const startedAt = Date.now();

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
    const notificationService = options.notificationService || createNotificationService({
        mode: NOTIFICATION_DELIVERY_MODE,
        appBaseUrl: APP_BASE_URL,
        fromEmail: NOTIFICATION_FROM_EMAIL,
        resendApiKey: RESEND_API_KEY,
        fetchImpl: options.notificationFetch
    });

    const statefulRoutes = {
        ...createSystemRoutes({
            stateStore,
            healthcheckPath: HEALTHCHECK_PATH,
            startedAt
        }),
        ...createStateRoutes({
            stateStore,
            sessionCookieName: SESSION_COOKIE_NAME,
            authConfig: {
                username: APP_USERNAME,
                password: APP_PASSWORD
            },
            notificationService,
            securityConfig: {
                rateLimits: SECURITY_RATE_LIMITS,
                trustProxy: TRUST_PROXY,
                allowedOrigins: ALLOWED_ORIGINS,
                publicRegistrationEnabled: PUBLIC_REGISTRATION_ENABLED,
                sessionCookieSecure: SESSION_COOKIE_SECURE,
                sessionCookieSameSite: SESSION_COOKIE_SAME_SITE
            }
        }),
        ...createLocalRoutes({ OUTPUT_DIR, MIME_TYPES, musicTasks, coverTasks, imageTasks, stateStore }),
        ...createServiceRoutes({ https: httpsClient, API_HOST, API_KEY, OUTPUT_DIR, trackUsage, stateStore }),
        ...createTaskRoutes({ https: httpsClient, API_HOST, API_KEY, OUTPUT_DIR, musicTasks, imageTasks, coverTasks, trackUsage, stateStore })
    };

    const server = http.createServer(async (req, res) => {
        const parsedUrl = url.parse(req.url, true);
        const requestProtocol = getRequestProtocol(req, { trustProxy: TRUST_PROXY });
        applySecurityHeaders(res, {
            requestProtocol,
            contentSecurityPolicy: CONTENT_SECURITY_POLICY
        });
        const corsDecision = applyCorsHeaders(req, res, {
            trustProxy: TRUST_PROXY,
            allowedOrigins: ALLOWED_ORIGINS
        });

        if (parsedUrl.pathname.startsWith('/api/') && !corsDecision.allowed) {
            sendJson(res, 403, {
                error: '当前来源不被允许访问该接口',
                reason: 'origin_not_allowed'
            });
            return;
        }

        if (req.method === 'OPTIONS') {
            res.writeHead(corsDecision.allowed ? 204 : 403);
            res.end();
            return;
        }

        const cookies = parseCookies(req.headers.cookie || '');
        const sessionToken = cookies[SESSION_COOKIE_NAME];
        req.authSession = stateStore.getSession(sessionToken);
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
