const crypto = require('crypto');

function isSafeMethod(method) {
    return ['GET', 'HEAD', 'OPTIONS'].includes(String(method || 'GET').toUpperCase());
}

function createCsrfSeed() {
    return crypto.randomBytes(24).toString('hex');
}

function deriveCsrfToken(seed, secret) {
    const normalizedSeed = String(seed || '').trim();
    const normalizedSecret = String(secret || '').trim();
    if (!normalizedSeed || !normalizedSecret) {
        return null;
    }

    return crypto
        .createHmac('sha256', normalizedSecret)
        .update(normalizedSeed)
        .digest('hex');
}

function readRequestHeader(req, name) {
    const normalizedName = String(name || '').trim().toLowerCase();
    if (!normalizedName) return null;
    const headers = req?.headers || {};
    const value = headers[normalizedName];
    if (Array.isArray(value)) {
        return value[0] || null;
    }
    return value || null;
}

module.exports = {
    isSafeMethod,
    createCsrfSeed,
    deriveCsrfToken,
    readRequestHeader
};
