const { sendJson } = require('../lib/http');

function createStateAuthRoutes(options) {
    const settings = options || {};
    const stateStore = settings.stateStore;
    const notificationService = settings.notificationService;
    const securityConfig = settings.securityConfig || {};
    const getClientIp = settings.getClientIp;
    const clearSessionCookie = settings.clearSessionCookie;
    const normalizeUsername = settings.normalizeUsername;
    const normalizePassword = settings.normalizePassword;
    const normalizeEmail = settings.normalizeEmail;
    const validateAdminUsername = settings.validateAdminUsername;
    const validateAdminPassword = settings.validateAdminPassword;
    const validateEmail = settings.validateEmail;
    const normalizeDisplayName = settings.normalizeDisplayName;
    const normalizePublicToken = settings.normalizePublicToken;
    const buildSessionUser = settings.buildSessionUser;
    const buildUserPayload = settings.buildUserPayload;
    const setAuthenticatedSession = settings.setAuthenticatedSession;
    const getCsrfPayload = settings.getCsrfPayload;
    const buildPreviewPath = settings.buildPreviewPath;
    const createPreviewToken = settings.createPreviewToken;
    const getNotificationDeliveryMode = settings.getNotificationDeliveryMode;
    const buildAuditActor = settings.buildAuditActor;
    const sendRateLimitResponse = settings.sendRateLimitResponse;
    const getAuthFailurePayload = settings.getAuthFailurePayload;
    const getCurrentSession = settings.getCurrentSession;
    const requireUser = settings.requireUser;
    const PASSWORD_RESET_TOKEN_TTL_MS = settings.PASSWORD_RESET_TOKEN_TTL_MS;
    const rateLimitRules = settings.rateLimitRules || {};

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
                    clearSessionCookie(res);
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
            const loginLimit = stateStore.consumeRateLimit('login', getClientIp(req), rateLimitRules.login);

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

            const registerLimit = stateStore.consumeRateLimit('public-register', getClientIp(req), rateLimitRules.publicRegister);
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
            clearSessionCookie(res);
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

            const forgotPasswordLimit = stateStore.consumeRateLimit('forgot-password', getClientIp(req), rateLimitRules.forgotPassword);
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
        }
    };
}

module.exports = {
    createStateAuthRoutes
};
