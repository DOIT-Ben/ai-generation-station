const { createStateRouteHelpers } = require('./state-route-helpers');
const { createStateAuthRoutes } = require('./state-auth-routes');
const { createStateWorkspaceRoutes } = require('./state-workspace-routes');
const { createStateAdminRoutes } = require('./state-admin-routes');

function createStateRoutes({ stateStore, sessionCookieName, authConfig, notificationService, securityConfig = {} }) {
    const requestSecurityOptions = {
        trustProxy: Boolean(securityConfig.trustProxy),
        allowedOrigins: securityConfig.allowedOrigins || []
    };
    const {
        getClientIp,
        clearSessionCookie,
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
        getCsrfPayload,
        buildPreviewPath,
        createPreviewToken,
        getNotificationDeliveryMode,
        issueAdminInvitationAction,
        buildAuditActor,
        sendRateLimitResponse,
        getAuthFailurePayload,
        getCurrentSession,
        requireUser,
        requireReadyUser,
        requireAdmin,
        PASSWORD_RESET_TOKEN_TTL_MS,
        rateLimitRules
    } = createStateRouteHelpers({
        stateStore,
        sessionCookieName,
        notificationService,
        securityConfig,
        requestSecurityOptions
    });

    return {
        ...createStateAuthRoutes({
            stateStore,
            notificationService,
            securityConfig,
            getClientIp,
            clearSessionCookie,
            normalizeUsername,
            normalizePassword,
            normalizeEmail,
            validateAdminUsername,
            validateAdminPassword,
            validateEmail,
            normalizeDisplayName,
            normalizePublicToken,
            buildSessionUser,
            buildUserPayload,
            setAuthenticatedSession,
            getCsrfPayload,
            buildPreviewPath,
            createPreviewToken,
            getNotificationDeliveryMode,
            buildAuditActor,
            sendRateLimitResponse,
            getAuthFailurePayload,
            getCurrentSession,
            requireUser,
            PASSWORD_RESET_TOKEN_TTL_MS,
            rateLimitRules
        }),
        ...createStateWorkspaceRoutes({
            stateStore,
            requireReadyUser,
            getPathParts
        }),
        ...createStateAdminRoutes({
            stateStore,
            requireAdmin,
            getPathParts,
            normalizeUsername,
            normalizePassword,
            normalizeEmail,
            validateAdminUsername,
            validateAdminPassword,
            validateEmail,
            normalizeDisplayName,
            normalizeAuditDateFilter,
            buildInvitationState,
            buildAdminUserPayload,
            issueAdminInvitationAction,
            buildAuditActor,
            sendRateLimitResponse,
            rateLimitRules
        })
    };
}

module.exports = {
    createStateRoutes
};
