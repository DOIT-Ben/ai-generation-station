const fs = require('fs');
const path = require('path');

function matchRoute(pathname, routes) {
    let matchedRoute = pathname;
    let handler = routes[matchedRoute];

    if (!handler) {
        for (const key of Object.keys(routes)) {
            if (key.includes('*') && pathname.startsWith(key.replace('*', ''))) {
                handler = routes[key];
                matchedRoute = key;
                break;
            }
        }
    }

    return { handler, matchedRoute };
}

async function readJsonBody(req, options = {}) {
    const maxBytes = Number(options.maxBytes || 0) || 0;
    let rawBody = '';
    let receivedBytes = 0;

    await new Promise((resolve, reject) => {
        req.on('data', chunk => {
            receivedBytes += Buffer.byteLength(chunk);
            if (maxBytes > 0 && receivedBytes > maxBytes) {
                const error = new Error('Request body too large');
                error.statusCode = 413;
                error.reason = 'body_too_large';
                reject(error);
                return;
            }
            rawBody += chunk;
        });
        req.on('end', resolve);
        req.on('error', reject);
    });
    return JSON.parse(rawBody || '{}');
}

function parseCookies(cookieHeader) {
    return String(cookieHeader || '')
        .split(';')
        .map(part => part.trim())
        .filter(Boolean)
        .reduce((acc, part) => {
            const [key, ...rest] = part.split('=');
            acc[key] = decodeURIComponent(rest.join('='));
            return acc;
        }, {});
}

function appendHeader(res, name, value) {
    const existing = res.getHeader(name);
    if (!existing) {
        res.setHeader(name, value);
        return;
    }
    res.setHeader(name, Array.isArray(existing) ? existing.concat(value) : [existing, value]);
}

function serializeCookie(name, value, options = {}) {
    const parts = [`${name}=${encodeURIComponent(value)}`];
    if (options.maxAge != null) parts.push(`Max-Age=${options.maxAge}`);
    if (options.httpOnly) parts.push('HttpOnly');
    if (options.secure) parts.push('Secure');
    if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
    if (options.path) parts.push(`Path=${options.path}`);
    return parts.join('; ');
}

function setCookie(res, name, value, options = {}) {
    appendHeader(res, 'Set-Cookie', serializeCookie(name, value, options));
}

function clearCookie(res, name, options = {}) {
    setCookie(res, name, '', { ...options, maxAge: 0 });
}

function sendJson(res, statusCode, payload) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(payload));
}

function serveStaticFile(res, filepath, mimeTypes, fallbackContentType = 'text/plain') {
    let resolvedPath = filepath;
    if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isDirectory()) {
        resolvedPath = path.join(resolvedPath, 'index.html');
    }
    const ext = path.extname(resolvedPath);
    const content = fs.readFileSync(resolvedPath);
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || fallbackContentType });
    res.end(content);
}

module.exports = {
    matchRoute,
    readJsonBody,
    parseCookies,
    appendHeader,
    setCookie,
    clearCookie,
    sendJson,
    serveStaticFile
};
