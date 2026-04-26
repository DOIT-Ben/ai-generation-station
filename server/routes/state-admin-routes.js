const { sendJson } = require('../lib/http');

function createStateAdminRoutes(options) {
    const settings = options || {};
    const stateStore = settings.stateStore;
    const requireAdmin = settings.requireAdmin;
    const getPathParts = settings.getPathParts;
    const normalizeUsername = settings.normalizeUsername;
    const normalizePassword = settings.normalizePassword;
    const normalizeEmail = settings.normalizeEmail;
    const validateAdminUsername = settings.validateAdminUsername;
    const validateAdminPassword = settings.validateAdminPassword;
    const validateEmail = settings.validateEmail;
    const normalizeDisplayName = settings.normalizeDisplayName;
    const normalizeAuditDateFilter = settings.normalizeAuditDateFilter;
    const buildInvitationState = settings.buildInvitationState;
    const buildAdminUserPayload = settings.buildAdminUserPayload;
    const issueAdminInvitationAction = settings.issueAdminInvitationAction;
    const buildAuditActor = settings.buildAuditActor;
    const sendRateLimitResponse = settings.sendRateLimitResponse;
    const rateLimitRules = settings.rateLimitRules || {};

    return {
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
    createStateAdminRoutes
};
