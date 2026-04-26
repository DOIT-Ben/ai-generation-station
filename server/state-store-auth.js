const crypto = require('crypto');

function createStateStoreAuth(options) {
    const settings = options || {};
    const sessionTtlMs = Number(settings.sessionTtlMs || 0);
    const LOGIN_FAILURE_LOCK_THRESHOLD = Number(settings.LOGIN_FAILURE_LOCK_THRESHOLD || 5);
    const LOGIN_FAILURE_LOCK_MS = Number(settings.LOGIN_FAILURE_LOCK_MS || (15 * 60 * 1000));
    const hashPassword = settings.hashPassword;
    const hashPasswordAsync = settings.hashPasswordAsync;
    const verifyPassword = settings.verifyPassword;
    const verifyPasswordAsync = settings.verifyPasswordAsync;
    const hashOpaqueToken = settings.hashOpaqueToken;
    const createOpaqueToken = settings.createOpaqueToken;
    const normalizeUserRecord = settings.normalizeUserRecord;
    const normalizeCredentialRecord = settings.normalizeCredentialRecord;
    const normalizeAuthTokenRecord = settings.normalizeAuthTokenRecord;
    const buildAuthTokenSummary = settings.buildAuthTokenSummary;
    const cleanupExpiredSessions = settings.cleanupExpiredSessions;
    const cleanupAuthTokens = settings.cleanupAuthTokens;
    const runInTransaction = settings.runInTransaction;
    const appendAuditLogRecord = settings.appendAuditLogRecord;
    const getUserByUsername = settings.getUserByUsername;
    const getUserById = settings.getUserById;

    const insertUserStmt = settings.insertUserStmt;
    const upsertCredentialStmt = settings.upsertCredentialStmt;
    const findUserByUsernameStmt = settings.findUserByUsernameStmt;
    const getCredentialStmt = settings.getCredentialStmt;
    const incrementFailedLoginStmt = settings.incrementFailedLoginStmt;
    const resetFailedLoginStmt = settings.resetFailedLoginStmt;
    const updateUserLoginStmt = settings.updateUserLoginStmt;
    const insertSessionStmt = settings.insertSessionStmt;
    const getSessionStmt = settings.getSessionStmt;
    const deleteSessionStmt = settings.deleteSessionStmt;
    const deleteUserSessionsStmt = settings.deleteUserSessionsStmt;
    const deleteUserSessionsExceptStmt = settings.deleteUserSessionsExceptStmt;
    const insertAuthTokenStmt = settings.insertAuthTokenStmt;
    const findAuthTokenByHashStmt = settings.findAuthTokenByHashStmt;
    const findLatestAuthTokenByUserPurposeStmt = settings.findLatestAuthTokenByUserPurposeStmt;
    const findActiveAuthTokenByUserPurposeStmt = settings.findActiveAuthTokenByUserPurposeStmt;
    const markAuthTokenUsedStmt = settings.markAuthTokenUsedStmt;
    const markUserPurposeTokensUsedStmt = settings.markUserPurposeTokensUsedStmt;

    function buildAuditTarget(event = {}, user) {
        return {
            ...event,
            targetUserId: event.targetUserId || user?.id || null,
            targetUsername: event.targetUsername || user?.username || null,
            targetRole: event.targetRole || user?.role || null
        };
    }

    function createUser(user = {}, options = {}) {
        const username = String(user.username || '').trim();
        const password = String(user.password || '').trim();
        if (!username || !password) {
            throw new Error('username and password are required');
        }
        const existing = getUserByUsername(username);
        if (existing) return existing;

        const now = Date.now();
        const userId = crypto.randomUUID();
        return runInTransaction(function () {
            insertUserStmt.run(
                userId,
                username,
                user.email || null,
                user.displayName || username,
                user.status || 'active',
                user.role || 'user',
                user.planCode || 'free',
                user.timezone || 'Asia/Shanghai',
                user.locale || 'zh-CN',
                now,
                now
            );
            upsertCredentialStmt.run(userId, hashPassword(password), now, user.mustResetPassword ? 1 : 0);
            const createdUser = getUserById(userId);
            if (options.auditLog && createdUser) {
                appendAuditLogRecord(buildAuditTarget(options.auditLog, createdUser));
            }
            return createdUser;
        });
    }

    async function createUserAsync(user = {}, options = {}) {
        const username = String(user.username || '').trim();
        const password = String(user.password || '').trim();
        if (!username || !password) {
            throw new Error('username and password are required');
        }
        const existing = getUserByUsername(username);
        if (existing) return existing;

        const passwordHash = await hashPasswordAsync(password);
        const now = Date.now();
        const userId = crypto.randomUUID();
        return runInTransaction(function () {
            insertUserStmt.run(
                userId,
                username,
                user.email || null,
                user.displayName || username,
                user.status || 'active',
                user.role || 'user',
                user.planCode || 'free',
                user.timezone || 'Asia/Shanghai',
                user.locale || 'zh-CN',
                now,
                now
            );
            upsertCredentialStmt.run(userId, passwordHash, now, user.mustResetPassword ? 1 : 0);
            const createdUser = getUserById(userId);
            if (options.auditLog && createdUser) {
                appendAuditLogRecord(buildAuditTarget(options.auditLog, createdUser));
            }
            return createdUser;
        });
    }

    function authenticateUser(username, password) {
        const user = normalizeUserRecord(findUserByUsernameStmt.get(username));
        if (!user) return null;
        if (user.status !== 'active') {
            return {
                errorCode: 'user_disabled',
                error: '账号已被禁用，请联系管理员',
                status: 403
            };
        }
        const credential = normalizeCredentialRecord(getCredentialStmt.get(user.id));
        const now = Date.now();
        if (!credential) return null;
        if (credential.lockedUntil && credential.lockedUntil > now) {
            return {
                errorCode: 'login_locked',
                error: '账号已被临时锁定，请 15 分钟后重试',
                status: 423
            };
        }
        if (!verifyPassword(password, credential.passwordHash)) {
            const failedCount = Number(credential.failedLoginCount || 0) + 1;
            const lockedUntil = failedCount >= LOGIN_FAILURE_LOCK_THRESHOLD ? now + LOGIN_FAILURE_LOCK_MS : null;
            incrementFailedLoginStmt.run(LOGIN_FAILURE_LOCK_THRESHOLD, lockedUntil, user.id);
            if (lockedUntil) {
                return {
                    errorCode: 'login_locked',
                    error: '账号已被临时锁定，请 15 分钟后重试',
                    status: 423
                };
            }
            return null;
        }
        resetFailedLoginStmt.run(user.id);
        updateUserLoginStmt.run(now, now, user.id);
        user.lastLoginAt = now;
        user.mustResetPassword = Boolean(credential.mustResetPassword);
        return user;
    }

    async function authenticateUserAsync(username, password) {
        const user = normalizeUserRecord(findUserByUsernameStmt.get(username));
        if (!user) return null;
        if (user.status !== 'active') {
            return {
                errorCode: 'user_disabled',
                error: '账号已被禁用，请联系管理员',
                status: 403
            };
        }
        const credential = normalizeCredentialRecord(getCredentialStmt.get(user.id));
        const now = Date.now();
        if (!credential) return null;
        if (credential.lockedUntil && credential.lockedUntil > now) {
            return {
                errorCode: 'login_locked',
                error: '账号已被临时锁定，请 15 分钟后重试',
                status: 423
            };
        }
        const verified = await verifyPasswordAsync(password, credential.passwordHash);
        if (!verified) {
          incrementFailedLoginStmt.run(LOGIN_FAILURE_LOCK_THRESHOLD, now + LOGIN_FAILURE_LOCK_MS, user.id);
          const updatedCredential = normalizeCredentialRecord(getCredentialStmt.get(user.id));
          if (updatedCredential?.lockedUntil && updatedCredential.lockedUntil > now) {
              return {
                  errorCode: 'login_locked',
                  error: '账号已被临时锁定，请 15 分钟后重试',
                  status: 423
              };
          }
          return null;
        }
        resetFailedLoginStmt.run(user.id);
        updateUserLoginStmt.run(now, now, user.id);
        user.lastLoginAt = now;
        user.mustResetPassword = Boolean(credential.mustResetPassword);
        return user;
    }

    function getSession(token) {
        if (!token) return null;
        cleanupExpiredSessions();
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        return getSessionStmt.get(tokenHash) || null;
    }

    function createSession(user) {
        cleanupExpiredSessions();
        const token = crypto.randomBytes(24).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        const createdAt = Date.now();
        const expiresAt = createdAt + sessionTtlMs;
        insertSessionStmt.run(crypto.randomUUID(), user.id, tokenHash, createdAt, createdAt, expiresAt);
        return { token, userId: user.id, username: user.username, createdAt, expiresAt };
    }

    function clearSession(token) {
        if (!token) return;
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        deleteSessionStmt.run(tokenHash);
    }

    function issueUserToken(userId, purpose, options = {}) {
        const user = getUserById(userId);
        if (!user) return null;

        const ttlMs = Math.max(60 * 1000, Number(options.ttlMs || 60 * 60 * 1000));
        return runInTransaction(function () {
            const now = Date.now();
            cleanupAuthTokens(now);
            markUserPurposeTokensUsedStmt.run(now, userId, purpose);
            const token = createOpaqueToken();
            const expiresAt = now + ttlMs;
            insertAuthTokenStmt.run(
                crypto.randomUUID(),
                userId,
                purpose,
                hashOpaqueToken(token),
                options.requestedIdentity || user.username,
                options.createdByUserId || null,
                JSON.stringify(options.metadata || {}),
                now,
                expiresAt
            );
            return {
                token,
                userId,
                purpose,
                requestedIdentity: options.requestedIdentity || user.username,
                metadata: options.metadata || {},
                createdAt: now,
                expiresAt
            };
        });
    }

    function getUserToken(purpose, token) {
        const rawToken = String(token || '').trim();
        if (!rawToken) return null;
        const now = Date.now();
        cleanupAuthTokens(now);
        const record = normalizeAuthTokenRecord(findAuthTokenByHashStmt.get(purpose, hashOpaqueToken(rawToken)));
        if (!record || record.usedAt || record.expiresAt < now) return null;
        const user = getUserById(record.userId);
        if (!user) return null;
        return {
            ...record,
            user
        };
    }

    function consumeUserToken(purpose, token) {
        const rawToken = String(token || '').trim();
        if (!rawToken) return null;
        return runInTransaction(function () {
            const now = Date.now();
            cleanupAuthTokens(now);
            const record = normalizeAuthTokenRecord(findAuthTokenByHashStmt.get(purpose, hashOpaqueToken(rawToken)));
            if (!record || record.usedAt || record.expiresAt < now) return null;
            const user = getUserById(record.userId);
            if (!user) return null;
            const result = markAuthTokenUsedStmt.run(now, record.id);
            if (Number(result?.changes || 0) < 1) return null;
            return {
                ...record,
                usedAt: now,
                user
            };
        });
    }

    function getLatestUserTokenSummary(userId, purpose) {
        if (!userId || !purpose) return null;
        const now = Date.now();
        cleanupAuthTokens(now);
        const record = normalizeAuthTokenRecord(findLatestAuthTokenByUserPurposeStmt.get(userId, purpose));
        return buildAuthTokenSummary(record, { now });
    }

    function getActiveUserTokenSummary(userId, purpose) {
        if (!userId || !purpose) return null;
        const now = Date.now();
        cleanupAuthTokens(now);
        const record = normalizeAuthTokenRecord(findActiveAuthTokenByUserPurposeStmt.get(userId, purpose, now));
        return buildAuthTokenSummary(record, { now, status: record ? 'active' : null });
    }

    function revokeUserTokens(userId, purpose) {
        if (!userId || !purpose) {
            return { revoked: false, count: 0, summary: null };
        }
        return runInTransaction(function () {
            const now = Date.now();
            cleanupAuthTokens(now);
            const record = normalizeAuthTokenRecord(findActiveAuthTokenByUserPurposeStmt.get(userId, purpose, now));
            if (!record) {
                return { revoked: false, count: 0, summary: null };
            }
            const result = markUserPurposeTokensUsedStmt.run(now, userId, purpose);
            return {
                revoked: Number(result?.changes || 0) > 0,
                count: Number(result?.changes || 0),
                summary: buildAuthTokenSummary({
                    ...record,
                    usedAt: now
                }, { now, status: 'revoked' })
            };
        });
    }

    function changeCurrentUserPassword(userId, currentPassword, nextPassword, options = {}) {
        const user = getUserById(userId);
        if (!user) return null;

        const credential = normalizeCredentialRecord(getCredentialStmt.get(userId));
        if (!credential) {
            return {
                errorCode: 'credential_missing',
                error: '当前账号暂时无法修改密码',
                status: 409
            };
        }

        if (!verifyPassword(currentPassword, credential.passwordHash)) {
            return {
                errorCode: 'current_password_incorrect',
                error: '当前密码不正确',
                status: 400
            };
        }

        if (verifyPassword(nextPassword, credential.passwordHash)) {
            return {
                errorCode: 'password_unchanged',
                error: '新密码不能与当前密码相同',
                status: 400
            };
        }

        const now = Date.now();
        upsertCredentialStmt.run(userId, hashPassword(nextPassword), now, 0);
        if (options.keepSessionId) {
            deleteUserSessionsExceptStmt.run(userId, options.keepSessionId);
        } else {
            deleteUserSessionsStmt.run(userId);
        }
        return getUserById(userId);
    }

    async function changeCurrentUserPasswordAsync(userId, currentPassword, nextPassword, options = {}) {
        const user = getUserById(userId);
        if (!user) return null;

        const credential = normalizeCredentialRecord(getCredentialStmt.get(userId));
        if (!credential) {
            return {
                errorCode: 'credential_missing',
                error: '当前账号暂时无法修改密码',
                status: 409
            };
        }

        if (!await verifyPasswordAsync(currentPassword, credential.passwordHash)) {
            return {
                errorCode: 'current_password_incorrect',
                error: '当前密码不正确',
                status: 400
            };
        }

        if (await verifyPasswordAsync(nextPassword, credential.passwordHash)) {
            return {
                errorCode: 'password_unchanged',
                error: '新密码不能与当前密码相同',
                status: 400
            };
        }

        const now = Date.now();
        const nextPasswordHash = await hashPasswordAsync(nextPassword);
        upsertCredentialStmt.run(userId, nextPasswordHash, now, 0);
        if (options.keepSessionId) {
            deleteUserSessionsExceptStmt.run(userId, options.keepSessionId);
        } else {
            deleteUserSessionsStmt.run(userId);
        }
        return getUserById(userId);
    }

    function resetUserPassword(userId, password, options = {}) {
        const user = getUserById(userId);
        if (!user) return null;
        const nextPassword = String(password || '');
        if (!nextPassword.trim()) {
            throw new Error('password is required');
        }

        return runInTransaction(function () {
            const now = Date.now();
            upsertCredentialStmt.run(userId, hashPassword(nextPassword), now, options.requirePasswordChange ? 1 : 0);
            if (options.keepSessionId) {
                deleteUserSessionsExceptStmt.run(userId, options.keepSessionId);
            } else {
                deleteUserSessionsStmt.run(userId);
            }
            const updatedUser = getUserById(userId);
            if (options.auditLog && updatedUser) {
                appendAuditLogRecord(buildAuditTarget(options.auditLog, updatedUser));
            }
            return updatedUser;
        });
    }

    async function resetUserPasswordAsync(userId, password, options = {}) {
        const user = getUserById(userId);
        if (!user) return null;
        const nextPassword = String(password || '');
        if (!nextPassword.trim()) {
            throw new Error('password is required');
        }

        const nextPasswordHash = await hashPasswordAsync(nextPassword);
        return runInTransaction(function () {
            const now = Date.now();
            upsertCredentialStmt.run(userId, nextPasswordHash, now, options.requirePasswordChange ? 1 : 0);
            if (options.keepSessionId) {
                deleteUserSessionsExceptStmt.run(userId, options.keepSessionId);
            } else {
                deleteUserSessionsStmt.run(userId);
            }
            const updatedUser = getUserById(userId);
            if (options.auditLog && updatedUser) {
                appendAuditLogRecord(buildAuditTarget(options.auditLog, updatedUser));
            }
            return updatedUser;
        });
    }

    return {
        createUser,
        createUserAsync,
        authenticateUser,
        authenticateUserAsync,
        getSession,
        createSession,
        clearSession,
        issueUserToken,
        getUserToken,
        consumeUserToken,
        getLatestUserTokenSummary,
        getActiveUserTokenSummary,
        revokeUserTokens,
        changeCurrentUserPassword,
        changeCurrentUserPasswordAsync,
        resetUserPassword,
        resetUserPasswordAsync
    };
}

module.exports = {
    createStateStoreAuth
};
