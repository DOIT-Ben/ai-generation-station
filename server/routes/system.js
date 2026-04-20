const { sendJson } = require('../lib/http');

function createSystemRoutes({ stateStore, healthcheckPath = '/api/health', startedAt = Date.now() }) {
    return {
        [healthcheckPath]: async (_req, res) => {
            try {
                const activeAdminCount = stateStore.countActiveAdmins();
                return {
                    status: 'ok',
                    now: Date.now(),
                    startedAt,
                    uptimeMs: Date.now() - startedAt,
                    database: 'ready',
                    activeAdminCount
                };
            } catch (error) {
                sendJson(res, 503, {
                    status: 'error',
                    error: error.message,
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
