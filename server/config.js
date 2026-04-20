const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const {
    parseBooleanFlag,
    parseOriginList,
    normalizeSameSite,
    buildDefaultContentSecurityPolicy
} = require('./lib/request-security');

const ROOT_DIR = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const API_HOST = 'api.minimaxi.com';
const DATA_DIR = path.join(ROOT_DIR, 'data');

function loadLocalConfig() {
    const configPath = path.join(ROOT_DIR, 'backend', 'config.local.js');
    if (!fs.existsSync(configPath)) {
        return {};
    }

    try {
        return require(configPath);
    } catch (error) {
        console.warn('[Config] Failed to load backend/config.local.js:', error.message);
        return {};
    }
}

function resolveOutputDir(value) {
    if (!value) {
        return path.join(ROOT_DIR, 'output');
    }
    return path.isAbsolute(value) ? value : path.join(ROOT_DIR, value);
}

function resolveDataDirPath(value, fallback) {
    const candidate = String(value || '').trim();
    if (!candidate) {
        return path.join(DATA_DIR, fallback);
    }
    return path.isAbsolute(candidate) ? candidate : path.join(DATA_DIR, candidate);
}

const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav'
};

function getConfigValue(env, localConfig, key, fallback) {
    if (Object.prototype.hasOwnProperty.call(env, key)) {
        return env[key];
    }
    if (localConfig[key] !== undefined) {
        return localConfig[key];
    }
    return fallback;
}

function getPositiveNumberConfig(env, localConfig, key, fallback) {
    const raw = getConfigValue(env, localConfig, key, fallback);
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : fallback;
}

function normalizeNotificationFailoverMode(value) {
    const normalized = String(value || '').trim().toLowerCase();
    if (['none', 'local_preview'].includes(normalized)) {
        return normalized;
    }
    return 'none';
}

function createConfig(options = {}) {
    const env = options.env || process.env;
    const localConfig = loadLocalConfig();
    const PORT = Number(getConfigValue(env, localConfig, 'PORT', 18791));
    const OUTPUT_DIR = resolveOutputDir(getConfigValue(env, localConfig, 'OUTPUT_DIR', undefined));
    const API_KEY = getConfigValue(env, localConfig, 'MINIMAX_API_KEY', '') || '';
    const APP_USERNAME = getConfigValue(env, localConfig, 'APP_USERNAME', 'studio');
    const APP_PASSWORD = getConfigValue(env, localConfig, 'APP_PASSWORD', 'AIGS2026!');
    const APP_BASE_URL = String(getConfigValue(env, localConfig, 'APP_BASE_URL', `http://localhost:${PORT}`) || `http://localhost:${PORT}`).trim() || `http://localhost:${PORT}`;
    const SESSION_COOKIE_NAME = getConfigValue(env, localConfig, 'SESSION_COOKIE_NAME', 'aigs_session');
    const SESSION_TTL_MS = Number(getConfigValue(env, localConfig, 'SESSION_TTL_MS', 7 * 24 * 60 * 60 * 1000));
    const SESSION_COOKIE_SECURE = parseBooleanFlag(getConfigValue(env, localConfig, 'SESSION_COOKIE_SECURE', ''), false);
    const SESSION_COOKIE_SAME_SITE = normalizeSameSite(getConfigValue(env, localConfig, 'SESSION_COOKIE_SAME_SITE', 'Lax'));
    const CSRF_COOKIE_NAME = String(getConfigValue(env, localConfig, 'CSRF_COOKIE_NAME', 'aigs_csrf') || 'aigs_csrf').trim() || 'aigs_csrf';
    const CSRF_TOKEN_HEADER_NAME = String(getConfigValue(env, localConfig, 'CSRF_TOKEN_HEADER_NAME', 'x-csrf-token') || 'x-csrf-token').trim().toLowerCase() || 'x-csrf-token';
    const PUBLIC_REGISTRATION_ENABLED = parseBooleanFlag(getConfigValue(env, localConfig, 'PUBLIC_REGISTRATION_ENABLED', 'true'), true);
    const APP_STATE_DB = path.isAbsolute(getConfigValue(env, localConfig, 'APP_STATE_DB', ''))
        ? getConfigValue(env, localConfig, 'APP_STATE_DB', '')
        : path.join(DATA_DIR, getConfigValue(env, localConfig, 'APP_STATE_DB', 'app-state.sqlite'));
    const CSRF_SECRET = String(
        getConfigValue(env, localConfig, 'CSRF_SECRET', `${APP_PASSWORD}:${APP_STATE_DB}`)
            || `${APP_PASSWORD}:${APP_STATE_DB}`
    ).trim() || `${APP_PASSWORD}:${APP_STATE_DB}`;
    const LEGACY_STATE_FILE = path.isAbsolute(getConfigValue(env, localConfig, 'APP_STATE_FILE', ''))
        ? getConfigValue(env, localConfig, 'APP_STATE_FILE', '')
        : path.join(DATA_DIR, getConfigValue(env, localConfig, 'APP_STATE_FILE', 'app-state.json'));
    const MAX_HISTORY_ITEMS = Number(getConfigValue(env, localConfig, 'MAX_HISTORY_ITEMS', 12));
    const SECURITY_RATE_LIMITS = {
        login: {
            max: getPositiveNumberConfig(env, localConfig, 'LOGIN_RATE_LIMIT_MAX', 30),
            windowMs: getPositiveNumberConfig(env, localConfig, 'LOGIN_RATE_LIMIT_WINDOW_MS', 5 * 60 * 1000)
        },
        forgotPassword: {
            max: getPositiveNumberConfig(env, localConfig, 'FORGOT_PASSWORD_RATE_LIMIT_MAX', 6),
            windowMs: getPositiveNumberConfig(env, localConfig, 'FORGOT_PASSWORD_RATE_LIMIT_WINDOW_MS', 10 * 60 * 1000)
        },
        publicRegister: {
            max: getPositiveNumberConfig(env, localConfig, 'PUBLIC_REGISTER_RATE_LIMIT_MAX', 6),
            windowMs: getPositiveNumberConfig(env, localConfig, 'PUBLIC_REGISTER_RATE_LIMIT_WINDOW_MS', 10 * 60 * 1000)
        },
        adminUserCreate: {
            max: getPositiveNumberConfig(env, localConfig, 'ADMIN_CREATE_USER_RATE_LIMIT_MAX', 6),
            windowMs: getPositiveNumberConfig(env, localConfig, 'ADMIN_CREATE_USER_RATE_LIMIT_WINDOW_MS', 10 * 60 * 1000)
        },
        adminPasswordReset: {
            max: getPositiveNumberConfig(env, localConfig, 'ADMIN_PASSWORD_RESET_RATE_LIMIT_MAX', 10),
            windowMs: getPositiveNumberConfig(env, localConfig, 'ADMIN_PASSWORD_RESET_RATE_LIMIT_WINDOW_MS', 10 * 60 * 1000)
        }
    };
    const TRUST_PROXY = parseBooleanFlag(getConfigValue(env, localConfig, 'TRUST_PROXY', ''), false);
    const ALLOWED_ORIGINS = parseOriginList(getConfigValue(env, localConfig, 'ALLOWED_ORIGINS', ''));
    const HEALTHCHECK_PATH = String(getConfigValue(env, localConfig, 'HEALTHCHECK_PATH', '/api/health') || '/api/health').trim() || '/api/health';
    const CONTENT_SECURITY_POLICY = String(
        getConfigValue(env, localConfig, 'CONTENT_SECURITY_POLICY', buildDefaultContentSecurityPolicy())
    ).trim() || buildDefaultContentSecurityPolicy();
    const NOTIFICATION_DELIVERY_MODE = String(getConfigValue(env, localConfig, 'NOTIFICATION_DELIVERY_MODE', 'local_preview') || 'local_preview').trim().toLowerCase() || 'local_preview';
    const NOTIFICATION_FAILOVER_MODE = normalizeNotificationFailoverMode(
        getConfigValue(env, localConfig, 'NOTIFICATION_FAILOVER_MODE', 'none')
    );
    const NOTIFICATION_FROM_EMAIL = String(getConfigValue(env, localConfig, 'NOTIFICATION_FROM_EMAIL', '') || '').trim();
    const RESEND_API_KEY = String(getConfigValue(env, localConfig, 'RESEND_API_KEY', '') || '').trim();
    const STATE_BACKUP_DIR = resolveDataDirPath(getConfigValue(env, localConfig, 'STATE_BACKUP_DIR', ''), 'backups');
    const AUDIT_LOG_RETENTION_DAYS = getPositiveNumberConfig(env, localConfig, 'AUDIT_LOG_RETENTION_DAYS', 90);
    const STATE_BACKUP_RETENTION_DAYS = getPositiveNumberConfig(env, localConfig, 'STATE_BACKUP_RETENTION_DAYS', 14);

    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    if (!fs.existsSync(STATE_BACKUP_DIR)) {
        fs.mkdirSync(STATE_BACKUP_DIR, { recursive: true });
    }

    if (!API_KEY) {
        console.warn('[Config] MINIMAX_API_KEY is not configured. API generation routes will return a configuration error.');
    }
    if (NOTIFICATION_DELIVERY_MODE === 'resend' && (!NOTIFICATION_FROM_EMAIL || !RESEND_API_KEY)) {
        console.warn('[Config] Resend email delivery is enabled but NOTIFICATION_FROM_EMAIL or RESEND_API_KEY is missing.');
    }

    return {
        ROOT_DIR,
        PUBLIC_DIR,
        API_HOST,
        PORT,
        OUTPUT_DIR,
        API_KEY,
        DATA_DIR,
        APP_USERNAME,
        APP_PASSWORD,
        APP_BASE_URL,
        SESSION_COOKIE_NAME,
        SESSION_TTL_MS,
        SESSION_COOKIE_SECURE,
        SESSION_COOKIE_SAME_SITE,
        CSRF_COOKIE_NAME,
        CSRF_TOKEN_HEADER_NAME,
        CSRF_SECRET,
        PUBLIC_REGISTRATION_ENABLED,
        APP_STATE_DB,
        LEGACY_STATE_FILE,
        MAX_HISTORY_ITEMS,
        SECURITY_RATE_LIMITS,
        TRUST_PROXY,
        ALLOWED_ORIGINS,
        HEALTHCHECK_PATH,
        CONTENT_SECURITY_POLICY,
        NOTIFICATION_DELIVERY_MODE,
        NOTIFICATION_FAILOVER_MODE,
        NOTIFICATION_FROM_EMAIL,
        RESEND_API_KEY,
        STATE_BACKUP_DIR,
        AUDIT_LOG_RETENTION_DAYS,
        STATE_BACKUP_RETENTION_DAYS,
        MIME_TYPES
    };
}

module.exports = {
    ROOT_DIR,
    PUBLIC_DIR,
    API_HOST,
    DATA_DIR,
    MIME_TYPES,
    createConfig
};
