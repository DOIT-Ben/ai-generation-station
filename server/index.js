/**
 * AI 内容生成站 - 后端服务器
 * 统一处理所有 MiniMax API 调用
 */

const http = require('http');
const url = require('url');
const path = require('path');
const https = require('https');

const { createConfig } = require('./config');
const { ROUTE_METHODS, API_KEY_REQUIRED_ROUTES, AUTH_REQUIRED_ROUTES } = require('./route-meta');
const { matchRoute, readJsonBody, sendJson, serveStaticFile, parseCookies } = require('./lib/http');
const { createLocalRoutes } = require('./routes/local');
const { createServiceRoutes } = require('./routes/service');
const { createTaskRoutes } = require('./routes/tasks');
const { createStateRoutes } = require('./routes/state');
const { createSystemRoutes } = require('./routes/system');
const { createStateStore } = require('./state-store');
const { createNotificationService } = require('./lib/notifications');
const { isSafeMethod, deriveCsrfToken, readRequestHeader } = require('./lib/csrf');
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
        CHAT_API_BASE_URL,
        CHAT_API_KEY,
        CHAT_DEFAULT_MODEL,
        APP_USERNAME,
        APP_PASSWORD,
        APP_BASE_URL,
        SESSION_COOKIE_NAME,
        SESSION_TTL_MS,
        SESSION_COOKIE_SECURE,
        SESSION_COOKIE_SAME_SITE,
        CSRF_COOKIE_NAME,
        CSRF_TOKEN_HEADER_NAME,
        CSRF_SECRET,
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
        NOTIFICATION_FAILOVER_MODE,
        NOTIFICATION_FROM_EMAIL,
        RESEND_API_KEY,
        MIME_TYPES
    } = config;
    const MAX_JSON_BODY_BYTES = Number(config.MAX_JSON_BODY_BYTES || 8 * 1024 * 1024);
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
        failoverMode: NOTIFICATION_FAILOVER_MODE,
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
                sessionCookieSameSite: SESSION_COOKIE_SAME_SITE,
                sessionTtlMs: SESSION_TTL_MS,
                csrfCookieName: CSRF_COOKIE_NAME,
                csrfTokenHeaderName: CSRF_TOKEN_HEADER_NAME,
                csrfSecret: CSRF_SECRET
            }
        }),
        ...createLocalRoutes({ OUTPUT_DIR, MIME_TYPES, musicTasks, coverTasks, imageTasks, stateStore, maxUploadBytes: config.MAX_UPLOAD_BYTES }),
        ...createServiceRoutes({
            https: httpsClient,
            API_HOST,
            API_KEY,
            OUTPUT_DIR,
            trackUsage,
            stateStore,
            chatBaseUrl: CHAT_API_BASE_URL,
            chatApiKey: CHAT_API_KEY,
            chatDefaultModel: CHAT_DEFAULT_MODEL,
            chatFetch: options.chatFetch
        }),
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

        if (handler && AUTH_REQUIRED_ROUTES.has(matchedRoute)) {
            if (!req.authSession) {
                if (sessionToken) {
                    sendJson(res, 401, {
                        authenticated: false,
                        reason: 'session_expired',
                        error: '登录状态已失效，请重新登录'
                    });
                    return;
                }
                sendJson(res, 401, {
                    authenticated: false,
                    reason: 'anonymous',
                    error: '未登录'
                });
                return;
            }

            if (stateStore.isPasswordResetRequired(req.authSession.userId)) {
                sendJson(res, 403, {
                    authenticated: true,
                    reason: 'password_reset_required',
                    error: '请先修改临时密码后再继续使用',
                    user: {
                        id: req.authSession.userId,
                        username: req.authSession.username,
                        role: req.authSession.role,
                        planCode: req.authSession.planCode,
                        mustResetPassword: true
                    }
                });
                return;
            }
        }

        if (handler && parsedUrl.pathname.startsWith('/api/') && !isSafeMethod(req.method)) {
            const csrfSeed = String(cookies[CSRF_COOKIE_NAME] || '').trim();
            const csrfHeader = String(readRequestHeader(req, CSRF_TOKEN_HEADER_NAME) || '').trim();
            const expectedCsrfToken = deriveCsrfToken(csrfSeed, CSRF_SECRET);

            if (!csrfSeed) {
                sendJson(res, 403, {
                    error: '安全校验已失效，请刷新页面后重试',
                    reason: 'csrf_seed_missing'
                });
                return;
            }

            if (!csrfHeader) {
                sendJson(res, 403, {
                    error: '请求缺少安全校验，请刷新页面后重试',
                    reason: 'csrf_required'
                });
                return;
            }

            if (!expectedCsrfToken || csrfHeader !== expectedCsrfToken) {
                sendJson(res, 403, {
                    error: '安全校验失败，请刷新页面后重试',
                    reason: 'csrf_invalid'
                });
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
                    body = await readJsonBody(req, { maxBytes: MAX_JSON_BODY_BYTES });
                } catch (error) {
                    if (error?.statusCode === 413) {
                        sendJson(res, 413, {
                            error: '请求体过大',
                            reason: error.reason || 'body_too_large'
                        });
                        return;
                    }
                    sendJson(res, 400, { error: 'Invalid JSON body' });
                    return;
                }
            }

            if (matchedRoute === '/api/chat' || matchedRoute === '/api/chat/models') {
                if (!CHAT_API_KEY) {
                    sendJson(res, 503, { error: 'CHAT_API_KEY is not configured' });
                    return;
                }
            } else if (API_KEY_REQUIRED_ROUTES.has(matchedRoute) && !API_KEY) {
                sendJson(res, 503, { error: 'MINIMAX_API_KEY is not configured' });
                return;
            }

            const result = await handler(req, res, body);
            if (result === null) return;

            sendJson(res, 200, result);
        } catch (error) {
            console.error('[Server] Unhandled request error:', error);
            sendJson(res, 500, {
                error: '服务器内部错误，请稍后重试',
                reason: 'internal_error'
            });
        }
    });

    server.appConfig = config;
    server.appStateStore = stateStore;
    return server;
}

function startServer(options = {}) {
    const server = createServer(options);
    const { PORT, BIND_HOST } = server.appConfig;
    server.listen(PORT, BIND_HOST, () => {
        const displayHost = BIND_HOST === '0.0.0.0' || BIND_HOST === '::' ? 'localhost' : BIND_HOST;
        console.log(`🎙️ AI 内容生成站已启动: http://${displayHost}:${PORT}`);
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
