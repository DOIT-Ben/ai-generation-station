const { sendJson } = require('../lib/http');

function createSystemRoutes({ stateStore, healthcheckPath = '/api/health', startedAt = Date.now() }) {
    return {
        [healthcheckPath]: async (_req, res) => {
            try {
                stateStore.countActiveAdmins();
                return {
                    status: 'ok',
                    now: Date.now(),
                    startedAt,
                    uptimeMs: Date.now() - startedAt,
                    database: 'ready'
                };
            } catch (error) {
                console.warn('[Healthcheck] Failed:', error);
                sendJson(res, 503, {
                    status: 'error',
                    error: '健康检查失败',
                    reason: 'health_check_failed',
                    now: Date.now(),
                    startedAt,
                    uptimeMs: Date.now() - startedAt
                });
                return null;
            }
        }
    };
}

module.exports = {
    createSystemRoutes
};
