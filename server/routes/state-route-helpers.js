const crypto = require('crypto');
const { parseCookies, sendJson, setCookie, clearCookie } = require('../lib/http');
const { createCsrfSeed, deriveCsrfToken } = require('../lib/csrf');
const { getClientIp, getRequestProtocol } = require('../lib/request-security');

function createStateRouteHelpers({ stateStore, sessionCookieName, notificationService, securityConfig = {}, requestSecurityOptions }) {
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

    const INVITATION_TOKEN_TTL_MS = 3 * 24 * 60 * 60 * 1000;
    const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

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
        getClientIp: req => getClientIp(req, requestSecurityOptions),
        clearSessionCookie: res => clearCookie(res, sessionCookieName, { path: '/' }),
        getPathParts,
        normalizeUsername,
        normalizePassword,
        normalizeEmail,
        validateAdminUsername,
        validateAdminPassword,
        validateEmail,
        normalizeDisplayName,
        normalizeAuditDateFilter,
        normalizePublicToken,
        buildSessionUser,
        buildUserPayload,
        buildInvitationState,
        buildAdminUserPayload,
        setAuthenticatedSession,
        ensureCsrfSeed,
        getCsrfPayload,
        buildPreviewPath,
        createPreviewToken,
        getNotificationDeliveryMode,
        issueAdminInvitationAction,
        getUserAgent,
        buildAuditActor,
        sendRateLimitResponse,
        getAuthFailurePayload,
        getPasswordResetRequiredPayload,
        getCurrentSession,
        requireUser,
        requireReadyUser,
        requireAdmin,
        INVITATION_TOKEN_TTL_MS,
        PASSWORD_RESET_TOKEN_TTL_MS,
        rateLimitRules
    };
}

module.exports = {
    createStateRouteHelpers
};
