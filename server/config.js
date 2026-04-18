const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const ROOT_DIR = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const API_HOST = 'api.minimaxi.com';

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

function createConfig(options = {}) {
    const env = options.env || process.env;
    const localConfig = loadLocalConfig();
    const PORT = Number(getConfigValue(env, localConfig, 'PORT', 18791));
    const OUTPUT_DIR = resolveOutputDir(getConfigValue(env, localConfig, 'OUTPUT_DIR', undefined));
    const API_KEY = getConfigValue(env, localConfig, 'MINIMAX_API_KEY', '') || '';

    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    if (!API_KEY) {
        console.warn('[Config] MINIMAX_API_KEY is not configured. API generation routes will return a configuration error.');
    }

    return {
        ROOT_DIR,
        PUBLIC_DIR,
        API_HOST,
        PORT,
        OUTPUT_DIR,
        API_KEY,
        MIME_TYPES
    };
}

module.exports = {
    ROOT_DIR,
    PUBLIC_DIR,
    API_HOST,
    MIME_TYPES,
    createConfig
};
