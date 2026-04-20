const crypto = require('crypto');
const { parseCookies, sendJson, setCookie, clearCookie } = require('../lib/http');
const { createCsrfSeed, deriveCsrfToken } = require('../lib/csrf');
const { getClientIp, getRequestProtocol } = require('../lib/request-security');

function createStateRoutes({ stateStore, sessionCookieName, authConfig, notificationService, securityConfig = {} }) {
    const requestSecurityOptions = {
        trustProxy: Boolean(securityConfig.trustProxy),
        allowedOrigins: securityConfig.allowedOrigins || []
    };

    function getPathParts(req) {
        return String(req.url || '').split('?')[0].split('/').filter(Boolean);
    }

    function normalizeUsername(value) {
        return String(value || '').trim();
    }

    function normalizePassword(value) {
        return String(value || '');
    }

    function normalizeEmail(value) {
        const email = String(value || '').trim().toLowerCase();
        return email || null;
    }

    function validateAdminUsername(value) {
        const username = normalizeUsername(value);
        if (!username) return '请输入用户名';
        if (!/^[A-Za-z0-9._-]{3,32}$/.test(username)) {
            return '用户名需为 3-32 位字母、数字、点、下划线或中划线';
        }
        return null;
    }

    function validateAdminPassword(value) {
        const password = normalizePassword(value);
        if (!password.trim()) return '请输入密码';
        if (password.trim().length < 8) return '密码至少需要 8 位';
        return null;
    }

    function validateEmail(value, options = {}) {
        if (!value) {
            return options.allowEmpty === false ? '请输入邮箱地址' : null;
        }
        if (String(value).length > 254) {
            return '请输入有效邮箱地址';
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))) {
            return '请输入有效邮箱地址';
        }
        return null;
    }

    function normalizeDisplayName(value, fallback) {
        const displayName = String(value || '').trim();
        return displayName || fallback;
    }

    function normalizeAuditDateFilter(value, options = {}) {
        const raw = String(value || '').trim();
        if (!raw) return null;
        if (/^\d+$/.test(raw)) {
            const parsed = Number(raw);
            return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
        }
        const suffix = options.endOfDay ? 'T23:59:59.999Z' : 'T00:00:00.000Z';
        const parsed = Date.parse(raw.includes('T') ? raw : `${raw}${suffix}`);
        return Number.isFinite(parsed) ? parsed : null;
    }

    function normalizePublicToken(value) {
        return String(value || '').trim();
    }

    function buildSessionUser(session) {
        const profile = stateStore.getUserById(session.userId);
        return {
            id: session.userId,
            username: session.username,
            email: profile?.email || null,
            displayName: profile?.displayName || session.username,
            role: session.role,
            planCode: session.planCode,
            mustResetPassword: stateStore.isPasswordResetRequired(session.userId)
        };
    }

    function buildUserPayload(user, overrides = {}) {
        return {
            id: user?.id || null,
            username: user?.username || '',
            email: user?.email || null,
            displayName: user?.displayName || user?.username || '',
            role: user?.role || 'user',
            planCode: user?.planCode || 'free',
            mustResetPassword: Boolean(overrides.mustResetPassword != null ? overrides.mustResetPassword : user?.mustResetPassword)
        };
    }

    function buildInvitationState(userId) {
        if (!userId) {
            return {
                active: false,
                status: 'none',
                createdAt: null,
                expiresAt: null
            };
        }
        const activeInvitation = stateStore.getActiveUserTokenSummary(userId, 'invite_activation');
        if (!activeInvitation) {
            return {
                active: false,
                status: 'none',
                createdAt: null,
                expiresAt: null
            };
        }
        return {
            active: true,
            status: 'pending',
            createdAt: activeInvitation.createdAt,
            expiresAt: activeInvitation.expiresAt
        };
    }

    function buildAdminUserPayload(user) {
        return {
            ...user,
            invitation: buildInvitationState(user?.id)
        };
    }

    function setAuthenticatedSession(res, req, user) {
        const session = stateStore.createSession(user);
        setCookie(res, sessionCookieName, session.token, {
            httpOnly: true,
            secure: Boolean(securityConfig.sessionCookieSecure) || getRequestProtocol(req, requestSecurityOptions) === 'https',
            sameSite: securityConfig.sessionCookieSameSite || 'Lax',
            maxAge: Math.floor((session.expiresAt - session.createdAt) / 1000),
            path: '/'
        });
        return session;
    }

    function ensureCsrfSeed(req, res) {
        const cookies = parseCookies(req.headers.cookie || '');
        const cookieName = securityConfig.csrfCookieName || 'aigs_csrf';
        let csrfSeed = String(cookies[cookieName] || '').trim();
        if (csrfSeed) {
            return csrfSeed;
        }

        csrfSeed = createCsrfSeed();
        setCookie(res, cookieName, csrfSeed, {
            httpOnly: true,
            secure: Boolean(securityConfig.sessionCookieSecure) || getRequestProtocol(req, requestSecurityOptions) === 'https',
            sameSite: securityConfig.sessionCookieSameSite || 'Lax',
            maxAge: Math.max(60, Math.floor(Number(securityConfig.sessionTtlMs || (7 * 24 * 60 * 60 * 1000)) / 1000)),
            path: '/'
        });
        return csrfSeed;
    }

    function getCsrfPayload(req, res) {
        const csrfSeed = ensureCsrfSeed(req, res);
        return {
            csrfToken: deriveCsrfToken(csrfSeed, securityConfig.csrfSecret),
            headerName: 'X-CSRF-Token'
        };
    }

    function buildPreviewPath(kind, token) {
        const param = kind === 'invite' ? 'invite' : 'reset';
        return `/auth/?${param}=${encodeURIComponent(String(token || '').trim())}`;
    }

    function createPreviewToken() {
        return crypto.randomBytes(24).toString('hex');
    }

    function getNotificationDeliveryMode() {
        return notificationService?.getDeliveryMode?.() || 'local_preview';
    }

    async function issueAdminInvitationAction({ targetUser, session, req, res, auditAction, requireExisting = false }) {
        if (targetUser.status !== 'active') {
            sendJson(res, 409, { error: '当前账号已被禁用，不能签发邀请链接' });
            return null;
        }

        const existingInvitation = stateStore.getActiveUserTokenSummary(targetUser.id, 'invite_activation');
        if (requireExisting && !existingInvitation) {
            sendJson(res, 409, { error: '当前账号没有可重发的邀请链接，请先签发邀请' });
            return null;
        }

        const invitation = stateStore.issueUserToken(targetUser.id, 'invite_activation', {
            ttlMs: INVITATION_TOKEN_TTL_MS,
            requestedIdentity: targetUser.username,
            createdByUserId: session.userId,
            metadata: {
                source: 'admin_panel',
                action: auditAction
            }
        });
        if (!invitation) {
            sendJson(res, 404, { error: 'user not found' });
            return null;
        }

        const delivery = notificationService?.sendInvitation
            ? await notificationService.sendInvitation({
                user: targetUser,
                token: invitation.token,
                expiresAt: invitation.expiresAt
            })
            : {
                ok: true,
                status: 200,
                deliveryMode: 'local_preview',
                previewUrl: buildPreviewPath('invite', invitation.token),
                recipientEmail: targetUser.email || null
            };
        if (!delivery?.ok) {
            sendJson(res, Number(delivery?.status || 503), {
                error: delivery?.error || '邀请发送失败',
                reason: 'notification_delivery_failed',
                fallbackMode: delivery?.fallbackMode || null,
                previewUrl: delivery?.previewUrl || null,
                recipientEmail: delivery?.recipientEmail || targetUser.email || null,
                expiresAt: invitation.expiresAt
            });
            return null;
        }

        stateStore.appendAuditLog({
            action: auditAction,
            ...buildAuditActor(session, req),
            targetUserId: targetUser.id,
            targetUsername: targetUser.username,
            targetRole: targetUser.role,
            details: {
                expiresAt: invitation.expiresAt,
                deliveryMode: delivery.deliveryMode || getNotificationDeliveryMode(),
                recipientEmail: delivery.recipientEmail || targetUser.email || null,
                previousInvitationExpiresAt: existingInvitation?.expiresAt || null
            }
        });

        return {
            success: true,
            user: {
                id: targetUser.id,
                username: targetUser.username
            },
            invitation: {
                active: true,
                status: 'pending',
                createdAt: invitation.createdAt,
                expiresAt: invitation.expiresAt
            },
            deliveryMode: delivery.deliveryMode || getNotificationDeliveryMode(),
            recipientEmail: delivery.recipientEmail || targetUser.email || null,
            previewUrl: delivery.previewUrl || null,
            expiresAt: invitation.expiresAt
        };
    }

    const INVITATION_TOKEN_TTL_MS = 3 * 24 * 60 * 60 * 1000;
    const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

    const rateLimitRules = {
        login: {
            max: Number(securityConfig.rateLimits?.login?.max || 30),
            windowMs: Number(securityConfig.rateLimits?.login?.windowMs || 5 * 60 * 1000)
        },
        forgotPassword: {
            max: Number(securityConfig.rateLimits?.forgotPassword?.max || 6),
            windowMs: Number(securityConfig.rateLimits?.forgotPassword?.windowMs || 10 * 60 * 1000)
        },
        publicRegister: {
            max: Number(securityConfig.rateLimits?.publicRegister?.max || 6),
            windowMs: Number(securityConfig.rateLimits?.publicRegister?.windowMs || 10 * 60 * 1000)
        },
        adminUserCreate: {
            max: Number(securityConfig.rateLimits?.adminUserCreate?.max || 6),
            windowMs: Number(securityConfig.rateLimits?.adminUserCreate?.windowMs || 10 * 60 * 1000)
        },
        adminPasswordReset: {
            max: Number(securityConfig.rateLimits?.adminPasswordReset?.max || 10),
            windowMs: Number(securityConfig.rateLimits?.adminPasswordReset?.windowMs || 10 * 60 * 1000)
        }
    };

    function getUserAgent(req) {
        const userAgent = String(req.headers['user-agent'] || '').trim();
        return userAgent || null;
    }

    function buildAuditActor(session, req) {
        return {
            actorUserId: session?.userId || null,
            actorUsername: session?.username || null,
            actorRole: session?.role || null,
            actorIp: getClientIp(req, requestSecurityOptions),
            actorUserAgent: getUserAgent(req)
        };
    }

    function sendRateLimitResponse(res, reason, error, retryAfterSeconds) {
        res.setHeader('Retry-After', String(Math.max(1, Number(retryAfterSeconds || 1))));
        sendJson(res, 429, {
            error,
            reason,
            retryAfterSeconds: Math.max(1, Number(retryAfterSeconds || 1))
        });
    }

    function getAuthFailurePayload(reason) {
        if (reason === 'session_expired') {
            return {
                authenticated: false,
                reason,
                error: '登录状态已失效，请重新登录'
            };
        }
        if (reason === 'user_disabled') {
            return {
                authenticated: false,
                reason,
                error: '账号已被禁用，请联系管理员'
            };
        }
        return {
            authenticated: false,
            reason: 'anonymous',
            error: '未登录'
        };
    }

    function getPasswordResetRequiredPayload(session) {
        return {
            authenticated: true,
            reason: 'password_reset_required',
            error: '请先修改临时密码后再继续使用',
            user: buildSessionUser(session)
        };
    }

    function getCurrentSession(req) {
        const cookies = parseCookies(req.headers.cookie || '');
        const token = cookies[sessionCookieName];
        if (!token) {
            return { token: null, session: null, reason: 'anonymous' };
        }
        const session = stateStore.getSession(token);
        if (!session) {
            return { token, session: null, reason: 'session_expired' };
        }
        if (session.status !== 'active') {
            stateStore.clearSession(token);
            return { token, session: null, reason: 'user_disabled' };
        }
        return { token, session, reason: null };
    }

    function requireUser(req, res) {
        const { token, session, reason } = getCurrentSession(req);
        if (!session) {
            if (token) {
                clearCookie(res, sessionCookieName, { path: '/' });
            }
            sendJson(res, 401, getAuthFailurePayload(reason));
            return null;
        }
        return session;
    }

    function requireReadyUser(req, res) {
        const session = requireUser(req, res);
        if (!session) return null;
        if (stateStore.isPasswordResetRequired(session.userId)) {
            sendJson(res, 403, getPasswordResetRequiredPayload(session));
            return null;
        }
        return session;
    }

    function requireAdmin(req, res) {
        const session = requireReadyUser(req, res);
        if (!session) return null;
        if (session.role !== 'admin') {
            sendJson(res, 403, { error: '需要管理员权限' });
            return null;
        }
        return session;
    }

    return {
        '/api/auth/csrf': async (req, res) => {
            res.setHeader('Cache-Control', 'no-store');
            return getCsrfPayload(req, res);
        },

        '/api/auth/session': async (req, res) => {
            res.setHeader('Cache-Control', 'no-store');
            const { token, session, reason } = getCurrentSession(req);
            if (!session) {
                if (token) {
                    clearCookie(res, sessionCookieName, { path: '/' });
                }
                sendJson(res, 401, getAuthFailurePayload(reason));
                return null;
            }
            return {
                authenticated: true,
                user: buildSessionUser(session)
            };
        },

        '/api/auth/login': async (req, res, body) => {
            const username = String(body.username || '').trim();
            const password = String(body.password || '');
            const loginLimit = stateStore.consumeRateLimit('login', getClientIp(req, requestSecurityOptions), rateLimitRules.login);

            if (!loginLimit.allowed) {
                sendRateLimitResponse(
                    res,
                    'login_rate_limited',
                    '登录尝试过于频繁，请稍后再试',
                    loginLimit.retryAfterSeconds
                );
                return null;
            }

            const user = await stateStore.authenticateUserAsync(username, password);
            if (user?.error) {
                sendJson(res, Number(user.status || 423), {
                    error: user.error,
                    reason: user.errorCode || null
                });
                return null;
            }

            if (!user) {
                sendJson(res, 401, { error: '账号或密码不正确' });
                return null;
            }

            setAuthenticatedSession(res, req, user);

            return {
                success: true,
                user: buildUserPayload(user)
            };
        },

        '/api/auth/register': async (req, res, body) => {
            if (!securityConfig.publicRegistrationEnabled) {
                sendJson(res, 403, {
                    error: '当前站点暂未开放公开注册',
                    reason: 'public_registration_disabled'
                });
                return null;
            }

            if (!body || typeof body !== 'object') {
                sendJson(res, 400, { error: '注册参数不能为空' });
                return null;
            }

            const registerLimit = stateStore.consumeRateLimit(
                'public-register',
                getClientIp(req, requestSecurityOptions),
                rateLimitRules.publicRegister
            );
            if (!registerLimit.allowed) {
                sendRateLimitResponse(
                    res,
                    'public_register_rate_limited',
                    '注册请求过于频繁，请稍后再试',
                    registerLimit.retryAfterSeconds
                );
                return null;
            }

            const username = normalizeUsername(body.username);
            const email = normalizeEmail(body.email);
            const password = normalizePassword(body.password);
            const usernameError = validateAdminUsername(username);
            const emailError = validateEmail(email, { allowEmpty: false });
            const passwordError = validateAdminPassword(password);

            if (usernameError) {
                sendJson(res, 400, { error: usernameError });
                return null;
            }
            if (emailError) {
                sendJson(res, 400, { error: emailError });
                return null;
            }
            if (passwordError) {
                sendJson(res, 400, { error: passwordError });
                return null;
            }
            if (stateStore.getUserByUsername(username)) {
                sendJson(res, 409, { error: '用户名已存在' });
                return null;
            }
            if (email && stateStore.getUserByEmail(email)) {
                sendJson(res, 409, { error: '邮箱已存在' });
                return null;
            }

            const user = await stateStore.createUserAsync({
                username,
                email,
                password,
                displayName: normalizeDisplayName(body.displayName, username),
                role: 'user',
                planCode: 'free',
                status: 'active',
                mustResetPassword: false
            }, {
                auditLog: {
                    action: 'user_public_register',
                    ...buildAuditActor(null, req),
                    details: {
                        email,
                        planCode: 'free',
                        source: 'public_registration'
                    }
                }
            });

            setAuthenticatedSession(res, req, user);
            return {
                success: true,
                user: buildUserPayload(user, { mustResetPassword: false })
            };
        },

        '/api/auth/logout': async (req, res) => {
            res.setHeader('Cache-Control', 'no-store');
            const { token } = getCurrentSession(req);
            stateStore.clearSession(token);
            clearCookie(res, sessionCookieName, { path: '/' });
            return { success: true };
        },

        '/api/auth/change-password': async (req, res, body) => {
            const session = requireUser(req, res);
            if (!session) return null;

            if (!body || typeof body !== 'object') {
                sendJson(res, 400, { error: '密码修改参数不能为空' });
                return null;
            }

            const currentPassword = normalizePassword(body.currentPassword);
            const newPassword = normalizePassword(body.newPassword);
            if (!currentPassword.trim()) {
                sendJson(res, 400, { error: '请输入当前密码' });
                return null;
            }

            const passwordError = validateAdminPassword(newPassword);
            if (passwordError) {
                sendJson(res, 400, { error: passwordError });
                return null;
            }

            const user = await stateStore.changeCurrentUserPasswordAsync(session.userId, currentPassword, newPassword, {
                keepSessionId: session.id
            });
            if (user?.error) {
                sendJson(res, Number(user.status || 400), {
                    error: user.error,
                    reason: user.errorCode || null
                });
                return null;
            }
            if (!user) {
                sendJson(res, 404, { error: 'user not found' });
                return null;
            }

            return {
                success: true,
                sessionRetained: true,
                user: {
                    id: user.id,
                    username: user.username,
                    role: user.role,
                    planCode: user.planCode,
                    mustResetPassword: false
                }
            };
        },

        '/api/auth/invitation': async (req, res) => {
            const parsedUrl = new URL(req.url, 'http://localhost');
            const token = normalizePublicToken(parsedUrl.searchParams.get('token'));
            if (!token) {
                sendJson(res, 400, { error: '邀请令牌不能为空' });
                return null;
            }

            const invite = stateStore.getUserToken('invite_activation', token);
            if (!invite || invite.user?.status !== 'active') {
                sendJson(res, 404, {
                    error: '邀请链接无效或已失效',
                    reason: 'token_invalid'
                });
                return null;
            }

            return {
                valid: true,
                purpose: 'invite_activation',
                expiresAt: invite.expiresAt,
                user: {
                    id: invite.user.id,
                    username: invite.user.username,
                    displayName: invite.user.displayName || invite.user.username
                }
            };
        },

        '/api/auth/invitation/activate': async (req, res, body) => {
            if (!body || typeof body !== 'object') {
                sendJson(res, 400, { error: '激活参数不能为空' });
                return null;
            }

            const token = normalizePublicToken(body.token);
            if (!token) {
                sendJson(res, 400, { error: '邀请令牌不能为空' });
                return null;
            }

            const passwordError = validateAdminPassword(body.password);
            if (passwordError) {
                sendJson(res, 400, { error: passwordError });
                return null;
            }

            const invite = stateStore.consumeUserToken('invite_activation', token);
            if (!invite || invite.user?.status !== 'active') {
                sendJson(res, 404, {
                    error: '邀请链接无效或已失效',
                    reason: 'token_invalid'
                });
                return null;
            }

            const user = await stateStore.resetUserPasswordAsync(invite.user.id, body.password, {
                requirePasswordChange: false
            });
            if (!user) {
                sendJson(res, 404, { error: 'user not found' });
                return null;
            }

            setAuthenticatedSession(res, req, user);
            return {
                success: true,
                user: buildUserPayload(user, { mustResetPassword: false })
            };
        },

        '/api/auth/forgot-password': async (req, res, body) => {
            if (!body || typeof body !== 'object') {
                sendJson(res, 400, { error: '找回密码参数不能为空' });
                return null;
            }

            const identity = normalizeUsername(body.username);
            if (!identity) {
                sendJson(res, 400, { error: '请输入账号' });
                return null;
            }

            const forgotPasswordLimit = stateStore.consumeRateLimit(
                'forgot-password',
                getClientIp(req, requestSecurityOptions),
                rateLimitRules.forgotPassword
            );
            if (!forgotPasswordLimit.allowed) {
                sendRateLimitResponse(
                    res,
                    'forgot_password_rate_limited',
                    '找回密码请求过于频繁，请稍后再试',
                    forgotPasswordLimit.retryAfterSeconds
                );
                return null;
            }

            const targetUser = stateStore.getUserByUsername(identity);
            const issuedToken = targetUser?.status === 'active'
                ? stateStore.issueUserToken(targetUser.id, 'password_reset', {
                    ttlMs: PASSWORD_RESET_TOKEN_TTL_MS,
                    requestedIdentity: identity,
                    metadata: {
                        source: 'self_service'
                    }
                })
                : null;
            const expiresAt = issuedToken?.expiresAt || (Date.now() + PASSWORD_RESET_TOKEN_TTL_MS);
            const deliveryMode = getNotificationDeliveryMode();
            let delivery = null;
            if (targetUser?.status === 'active' && issuedToken && notificationService?.sendPasswordReset) {
                delivery = await notificationService.sendPasswordReset({
                    user: targetUser,
                    token: issuedToken.token,
                    expiresAt
                });
                if (!delivery?.ok) {
                    console.warn('[Notifications] Password reset delivery failed:', delivery?.error || 'unknown error');
                }
            }
            const previewToken = issuedToken?.token || createPreviewToken();
            const previewUrl = delivery?.ok
                ? (delivery?.previewUrl || null)
                : (deliveryMode === 'local_preview' ? buildPreviewPath('reset', previewToken) : null);

            return {
                success: true,
                message: deliveryMode === 'local_preview'
                    ? '如果账号存在，系统已生成一条可继续操作的重置链接。'
                    : '如果账号存在，系统已向账号邮箱发送重置邮件。',
                deliveryMode,
                previewUrl,
                expiresAt
            };
        },

        '/api/auth/password-reset': async (req, res) => {
            const parsedUrl = new URL(req.url, 'http://localhost');
            const token = normalizePublicToken(parsedUrl.searchParams.get('token'));
            if (!token) {
                sendJson(res, 400, { error: '重置令牌不能为空' });
                return null;
            }

            const reset = stateStore.getUserToken('password_reset', token);
            if (!reset || reset.user?.status !== 'active') {
                sendJson(res, 404, {
                    error: '重置链接无效或已失效',
                    reason: 'token_invalid'
                });
                return null;
            }

            return {
                valid: true,
                purpose: 'password_reset',
                expiresAt: reset.expiresAt,
                user: {
                    id: reset.user.id,
                    username: reset.user.username,
                    displayName: reset.user.displayName || reset.user.username
                }
            };
        },

        '/api/auth/password-reset/complete': async (req, res, body) => {
            if (!body || typeof body !== 'object') {
                sendJson(res, 400, { error: '重置密码参数不能为空' });
                return null;
            }

            const token = normalizePublicToken(body.token);
            if (!token) {
                sendJson(res, 400, { error: '重置令牌不能为空' });
                return null;
            }

            const passwordError = validateAdminPassword(body.password);
            if (passwordError) {
                sendJson(res, 400, { error: passwordError });
                return null;
            }

            const reset = stateStore.consumeUserToken('password_reset', token);
            if (!reset || reset.user?.status !== 'active') {
                sendJson(res, 404, {
                    error: '重置链接无效或已失效',
                    reason: 'token_invalid'
                });
                return null;
            }

            const user = await stateStore.resetUserPasswordAsync(reset.user.id, body.password, {
                requirePasswordChange: false
            });
            if (!user) {
                sendJson(res, 404, { error: 'user not found' });
                return null;
            }

            setAuthenticatedSession(res, req, user);
            return {
                success: true,
                user: buildUserPayload(user, { mustResetPassword: false })
            };
        },

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
        },

        '/api/admin/users': async (req, res, body) => {
            const session = requireAdmin(req, res);
            if (!session) return null;

            if (req.method === 'POST') {
                if (!body || typeof body !== 'object') {
                    sendJson(res, 400, { error: '用户创建参数不能为空' });
                    return null;
                }

                const createUserLimit = stateStore.consumeRateLimit('admin-create-user', session.userId, rateLimitRules.adminUserCreate);
                if (!createUserLimit.allowed) {
                    sendRateLimitResponse(
                        res,
                        'admin_user_create_rate_limited',
                        '创建用户操作过于频繁，请稍后再试',
                        createUserLimit.retryAfterSeconds
                    );
                    return null;
                }

                const username = normalizeUsername(body.username);
                const email = normalizeEmail(body.email);
                const password = normalizePassword(body.password);
                const usernameError = validateAdminUsername(username);
                const emailError = validateEmail(email, { allowEmpty: true });
                const passwordError = validateAdminPassword(password);
                const role = ['admin', 'user'].includes(body.role) ? body.role : 'user';
                const planCode = ['free', 'pro', 'internal'].includes(body.planCode) ? body.planCode : 'free';

                if (usernameError) {
                    sendJson(res, 400, { error: usernameError });
                    return null;
                }
                if (emailError) {
                    sendJson(res, 400, { error: emailError });
                    return null;
                }
                if (passwordError) {
                    sendJson(res, 400, { error: passwordError });
                    return null;
                }
                if (stateStore.getUserByUsername(username)) {
                    sendJson(res, 409, { error: '用户名已存在' });
                    return null;
                }
                if (email && stateStore.getUserByEmail(email)) {
                    sendJson(res, 409, { error: '邮箱已存在' });
                    return null;
                }

                const user = await stateStore.createUserAsync({
                    username,
                    email,
                    password,
                    displayName: normalizeDisplayName(body.displayName, username),
                    role,
                    planCode,
                    status: 'active',
                    mustResetPassword: true
                }, {
                    auditLog: {
                        action: 'user_create',
                        ...buildAuditActor(session, req),
                        details: {
                            email,
                            status: 'active',
                            planCode,
                            mustResetPassword: true
                        }
                    }
                });

                return { user };
            }

            return {
                users: stateStore.listUsers().map(buildAdminUserPayload)
            };
        },

        '/api/admin/audit-logs': async (req, res) => {
            const session = requireAdmin(req, res);
            if (!session) return null;

            const parsedUrl = new URL(req.url, 'http://localhost');
            const page = Math.max(1, Number(parsedUrl.searchParams.get('page') || 1));
            const pageSize = Math.min(100, Math.max(1, Number(parsedUrl.searchParams.get('pageSize') || 10)));
            const action = String(parsedUrl.searchParams.get('action') || '').trim();
            const actorUsername = String(parsedUrl.searchParams.get('actorUsername') || '').trim();
            const targetUsername = String(parsedUrl.searchParams.get('targetUsername') || '').trim();
            const createdFrom = normalizeAuditDateFilter(parsedUrl.searchParams.get('from'));
            const createdTo = normalizeAuditDateFilter(parsedUrl.searchParams.get('to'), { endOfDay: true });
            const result = stateStore.queryAuditLogs({
                page,
                pageSize,
                action,
                actorUsername,
                targetUsername,
                createdFrom,
                createdTo
            });

            return {
                ...result,
                filters: {
                    action,
                    actorUsername,
                    targetUsername,
                    from: parsedUrl.searchParams.get('from') || '',
                    to: parsedUrl.searchParams.get('to') || ''
                }
            };
        },

        '/api/admin/users/*': async (req, res, body) => {
            const session = requireAdmin(req, res);
            if (!session) return null;

            const parts = getPathParts(req);
            const userId = parts[3];
            const action = parts[4];
            if (!userId) {
                sendJson(res, 400, { error: 'user id is required' });
                return null;
            }

            const targetUser = stateStore.getUserById(userId);
            if (!targetUser) {
                sendJson(res, 404, { error: 'user not found' });
                return null;
            }

            if (action === 'invite') {
                return issueAdminInvitationAction({
                    targetUser,
                    session,
                    req,
                    res,
                    auditAction: 'user_invite_issue',
                    requireExisting: false
                });
            }

            if (action === 'invite-resend') {
                return issueAdminInvitationAction({
                    targetUser,
                    session,
                    req,
                    res,
                    auditAction: 'user_invite_resend',
                    requireExisting: true
                });
            }

            if (action === 'invite-revoke') {
                const activeInvitation = stateStore.getActiveUserTokenSummary(userId, 'invite_activation');
                if (!activeInvitation) {
                    sendJson(res, 409, { error: '当前账号没有可撤销的邀请链接' });
                    return null;
                }
                const revoked = stateStore.revokeUserTokens(userId, 'invite_activation');
                if (!revoked?.revoked) {
                    sendJson(res, 409, { error: '当前账号没有可撤销的邀请链接' });
                    return null;
                }
                stateStore.appendAuditLog({
                    action: 'user_invite_revoke',
                    ...buildAuditActor(session, req),
                    targetUserId: targetUser.id,
                    targetUsername: targetUser.username,
                    targetRole: targetUser.role,
                    details: {
                        revokedCount: revoked.count,
                        expiresAt: activeInvitation.expiresAt
                    }
                });
                return {
                    success: true,
                    revoked: true,
                    user: {
                        id: targetUser.id,
                        username: targetUser.username
                    },
                    invitation: buildInvitationState(targetUser.id)
                };
            }

            if (!body || typeof body !== 'object') {
                sendJson(res, 400, { error: 'user patch is required' });
                return null;
            }

            if (action === 'password') {
                const passwordError = validateAdminPassword(body.password);
                if (passwordError) {
                    sendJson(res, 400, { error: passwordError });
                    return null;
                }

                const passwordResetLimit = stateStore.consumeRateLimit('admin-password-reset', session.userId, rateLimitRules.adminPasswordReset);
                if (!passwordResetLimit.allowed) {
                    sendRateLimitResponse(
                        res,
                        'admin_password_reset_rate_limited',
                        '重置密码操作过于频繁，请稍后再试',
                        passwordResetLimit.retryAfterSeconds
                    );
                    return null;
                }

                const keepSessionId = session.userId === userId ? session.id : null;
                const user = await stateStore.resetUserPasswordAsync(userId, body.password, {
                    keepSessionId,
                    requirePasswordChange: session.userId !== userId,
                    auditLog: {
                        action: 'user_password_reset',
                        ...buildAuditActor(session, req),
                        details: {
                            requirePasswordChange: session.userId !== userId,
                            sessionRetained: Boolean(keepSessionId)
                        }
                    }
                });
                return {
                    user,
                    sessionRetained: Boolean(keepSessionId)
                };
            }

            if (action) {
                sendJson(res, 404, { error: 'admin user action not found' });
                return null;
            }

            const nextStatus = body.status || targetUser.status;
            const nextRole = body.role || targetUser.role;
            const hasEmailPatch = Object.prototype.hasOwnProperty.call(body, 'email');
            const nextEmail = hasEmailPatch ? normalizeEmail(body.email) : targetUser.email;
            const wouldRemoveAdminAccess = targetUser.role === 'admin' && (nextRole !== 'admin' || nextStatus !== 'active');
            const auditActor = buildAuditActor(session, req);

            if (session.userId === userId && nextStatus !== 'active') {
                sendJson(res, 400, { error: '不能禁用当前登录管理员' });
                return null;
            }

            if (session.userId === userId && nextRole !== 'admin') {
                sendJson(res, 400, { error: '不能降级当前登录管理员' });
                return null;
            }

            if (wouldRemoveAdminAccess && stateStore.countActiveAdmins() <= 1) {
                sendJson(res, 409, { error: '至少保留一个启用中的管理员' });
                return null;
            }
            if (hasEmailPatch) {
                const emailError = validateEmail(nextEmail, { allowEmpty: true });
                if (emailError) {
                    sendJson(res, 400, { error: emailError });
                    return null;
                }
                const existingEmailUser = nextEmail ? stateStore.getUserByEmail(nextEmail) : null;
                if (existingEmailUser && existingEmailUser.id !== userId) {
                    sendJson(res, 409, { error: '邮箱已存在' });
                    return null;
                }
            }

            const user = stateStore.updateUser(userId, {
                email: hasEmailPatch ? nextEmail : undefined,
                status: body.status,
                role: body.role,
                planCode: body.planCode
            }, {
                auditLogs: [
                    targetUser.status !== nextStatus && nextStatus === 'disabled' ? {
                        action: 'user_disable',
                        ...auditActor,
                        details: {
                            previousStatus: targetUser.status,
                            nextStatus
                        }
                    } : null,
                    targetUser.role !== nextRole ? {
                        action: 'user_role_change',
                        ...auditActor,
                        details: {
                            previousRole: targetUser.role,
                            nextRole
                        }
                    } : null
                ]
            });

            return { user };
        }
    };
}

module.exports = {
    createStateRoutes
};
