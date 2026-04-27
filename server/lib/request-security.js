const net = require('net');

function parseBooleanFlag(value, fallback = false) {
    if (value === undefined || value === null || value === '') {
        return fallback;
    }
    if (typeof value === 'boolean') {
        return value;
    }

    const normalized = String(value).trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
    return fallback;
}

function normalizeOrigin(value) {
    if (!value) return null;
    try {
        const parsed = new URL(String(value).trim());
        if (!['http:', 'https:'].includes(parsed.protocol)) {
            return null;
        }
        const hostname = String(parsed.hostname || '');
        if (hostname && !hostname.includes(':')) {
            if (hostname.startsWith('.') || hostname.includes('..')) {
                return null;
            }
        }
        if (parsed.username || parsed.password) {
            return null;
        }
        if (parsed.search || parsed.hash) {
            return null;
        }
        if (parsed.pathname && parsed.pathname !== '/') {
            return null;
        }
        return parsed.origin;
    } catch {
        return null;
    }
}

function parseOriginList(value) {
    const items = Array.isArray(value)
        ? value
        : String(value || '')
            .split(/[\r\n,]+/)
            .map(item => item.trim())
            .filter(Boolean);

    return Array.from(new Set(items.map(item => normalizeOrigin(item)).filter(Boolean)));
}

function normalizeSameSite(value, fallback = 'Lax') {
    const normalized = String(value || fallback).trim().toLowerCase();
    if (normalized === 'strict') return 'Strict';
    if (normalized === 'none') return 'None';
    return 'Lax';
}

function normalizeIpAddress(value) {
    const raw = String(value || '').trim();
    if (!raw) return null;

    const bracketMatch = raw.match(/^\[([^\]]+)\](?::\d+)?$/);
    let normalized = bracketMatch ? bracketMatch[1] : raw;
    normalized = normalized.replace(/^::ffff:/i, '');

    const ipv4WithPortMatch = normalized.match(/^(\d{1,3}(?:\.\d{1,3}){3})(?::\d+)?$/);
    if (ipv4WithPortMatch) {
        normalized = ipv4WithPortMatch[1];
    }

    if (normalized === '::1') return '127.0.0.1';
    return net.isIP(normalized) ? normalized : null;
}

function getClientIp(req, options = {}) {
    const trustProxy = Boolean(options.trustProxy);
    const candidates = [];

    if (trustProxy) {
        const forwardedFor = String(req.headers['x-forwarded-for'] || '')
            .split(',')
            .map(item => item.trim())
            .filter(Boolean);
        candidates.push(...forwardedFor);
        candidates.push(String(req.headers['x-real-ip'] || '').trim());
    }

    candidates.push(req.socket?.remoteAddress || req.connection?.remoteAddress || '');
    return candidates.map(normalizeIpAddress).find(Boolean) || 'unknown';
}

function getRequestProtocol(req, options = {}) {
    const trustProxy = Boolean(options.trustProxy);
    if (trustProxy) {
        const forwardedProto = String(req.headers['x-forwarded-proto'] || '')
            .split(',')
            .map(item => item.trim().toLowerCase())
            .find(item => item === 'http' || item === 'https');
        if (forwardedProto) {
            return forwardedProto;
        }
    }

    return req.socket?.encrypted ? 'https' : 'http';
}

function getRequestOrigin(req, options = {}) {
    const host = String(req.headers.host || '').trim();
    if (!host) {
        return null;
    }
    return normalizeOrigin(`${getRequestProtocol(req, options)}://${host}`);
}

function isOriginAllowed(req, origin, options = {}) {
    const normalizedOrigin = normalizeOrigin(origin);
    if (!normalizedOrigin) {
        return false;
    }

    const allowedOrigins = new Set(parseOriginList(options.allowedOrigins || []));
    const requestOrigin = getRequestOrigin(req, options);
    return normalizedOrigin === requestOrigin || allowedOrigins.has(normalizedOrigin);
}

function appendVaryHeader(res, value) {
    const existing = String(res.getHeader('Vary') || '')
        .split(',')
        .map(item => item.trim())
        .filter(Boolean);
    if (!existing.includes(value)) {
        existing.push(value);
        res.setHeader('Vary', existing.join(', '));
    }
}

function buildDefaultContentSecurityPolicy() {
    return [
        "default-src 'self'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'self'",
        "object-src 'none'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' data: https://fonts.gstatic.com",
        "img-src 'self' data: blob:",
        "connect-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com",
        "media-src 'self' data: blob:",
        "worker-src 'self' blob:"
    ].join('; ');
}

function applySecurityHeaders(res, options = {}) {
    const headers = {
        'X-Frame-Options': 'SAMEORIGIN',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Resource-Policy': 'same-origin',
        'Content-Security-Policy': options.contentSecurityPolicy || buildDefaultContentSecurityPolicy()
    };

    Object.entries(headers).forEach(([name, value]) => {
        if (value) {
            res.setHeader(name, value);
        }
    });

    if (options.requestProtocol === 'https') {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
}

function applyCorsHeaders(req, res, options = {}) {
    const rawOrigin = String(req.headers.origin || '').trim();
    if (!rawOrigin) {
        return { allowed: true, origin: null };
    }

    appendVaryHeader(res, 'Origin');
    const origin = normalizeOrigin(rawOrigin);
    if (!origin) {
        return { allowed: false, origin: null };
    }

    if (!isOriginAllowed(req, origin, options)) {
        return { allowed: false, origin };
    }

    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token');
    return { allowed: true, origin };
}

module.exports = {
    parseBooleanFlag,
    parseOriginList,
    normalizeOrigin,
    normalizeSameSite,
    getClientIp,
    getRequestProtocol,
    getRequestOrigin,
    isOriginAllowed,
    appendVaryHeader,
    buildDefaultContentSecurityPolicy,
    applySecurityHeaders,
    applyCorsHeaders
};
