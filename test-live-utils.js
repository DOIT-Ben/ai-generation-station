const http = require('http');
const { Readable, Writable } = require('stream');

const boundServers = [];

function getHost() {
    return process.env.HOST || 'localhost';
}

function getPort() {
    return Number(process.env.PORT || 18791);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getBoundServer() {
    return boundServers[boundServers.length - 1] || null;
}

function bindServer(server) {
    boundServers.push(server);
}

function unbindServer(server) {
    const index = boundServers.lastIndexOf(server);
    if (index >= 0) {
        boundServers.splice(index, 1);
    }
}

async function withBoundServer(server, fn) {
    bindServer(server);
    try {
        return await fn();
    } finally {
        unbindServer(server);
    }
}

class MockResponse extends Writable {
    constructor(resolve) {
        super();
        this.statusCode = 200;
        this.headers = {};
        this.chunks = [];
        this.finishedResponse = false;
        this.on('finish', () => {
            if (this.finishedResponse) return;
            this.finishedResponse = true;
            const raw = Buffer.concat(this.chunks).toString('utf8');
            let data = raw;
            try {
                data = JSON.parse(raw);
            } catch {}
            resolve({
                status: this.statusCode,
                data,
                headers: { ...this.headers },
                rawBody: raw
            });
        });
    }

    _write(chunk, encoding, callback) {
        this.chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
        callback();
    }

    setHeader(name, value) {
        this.headers[String(name).toLowerCase()] = value;
    }

    getHeader(name) {
        return this.headers[String(name).toLowerCase()];
    }

    writeHead(statusCode, headers = {}) {
        this.statusCode = statusCode;
        for (const [name, value] of Object.entries(headers)) {
            this.setHeader(name, value);
        }
    }

    end(chunk, encoding, callback) {
        if (typeof chunk === 'function') {
            callback = chunk;
            chunk = undefined;
            encoding = undefined;
        } else if (typeof encoding === 'function') {
            callback = encoding;
            encoding = undefined;
        }

        if (chunk != null) {
            this.write(chunk, encoding);
        }
        super.end(callback);
    }
}

function normalizeHeaders(headers = {}) {
    return Object.entries(headers).reduce((acc, [name, value]) => {
        acc[String(name).toLowerCase()] = value;
        return acc;
    }, {});
}

function isUnsafeMethod(method) {
    return !['GET', 'HEAD', 'OPTIONS'].includes(String(method || 'GET').toUpperCase());
}

function getCookieHeaderValue(rawSetCookieHeader) {
    if (!rawSetCookieHeader) return '';
    const items = Array.isArray(rawSetCookieHeader) ? rawSetCookieHeader : [rawSetCookieHeader];
    return items
        .map(item => String(item || '').split(';')[0].trim())
        .filter(Boolean)
        .join('; ');
}

function mergeCookieHeaders(...cookieHeaders) {
    const cookieMap = new Map();
    cookieHeaders
        .map(value => String(value || '').trim())
        .filter(Boolean)
        .forEach(headerValue => {
            headerValue.split(';').map(part => part.trim()).filter(Boolean).forEach(part => {
                const [name, ...rest] = part.split('=');
                if (!name || rest.length === 0) return;
                cookieMap.set(name.trim(), rest.join('=').trim());
            });
        });

    return Array.from(cookieMap.entries())
        .map(([name, value]) => `${name}=${value}`)
        .join('; ');
}

async function withCsrfProtection(requestFn, path, method, body, options = {}) {
    if (!isUnsafeMethod(method) || options.skipCsrf === true) {
        return requestFn(path, method, body, options);
    }

    const baseHeaders = normalizeHeaders(options.headers || {});
    const csrfBootstrap = await requestFn('/api/auth/csrf', 'GET', null, {
        headers: baseHeaders
    });
    const csrfCookieHeader = getCookieHeaderValue(csrfBootstrap.headers?.['set-cookie']);
    const mergedCookie = mergeCookieHeaders(baseHeaders.cookie, csrfCookieHeader);
    const csrfToken = csrfBootstrap.data?.csrfToken;
    const headers = {
        ...baseHeaders
    };

    if (mergedCookie) {
        headers.cookie = mergedCookie;
    }
    if (csrfToken) {
        headers['x-csrf-token'] = csrfToken;
    }

    return requestFn(path, method, body, {
        ...options,
        headers
    });
}

function dispatchRequest(server, path, method, body, options = {}) {
    return new Promise((resolve, reject) => {
        const payload = options.raw
            ? String(body || '')
            : body == null
                ? ''
                : JSON.stringify(body);
        const headers = normalizeHeaders(options.headers || {});

        if (payload && !headers['content-type']) {
            headers['content-type'] = 'application/json';
        }
        if (payload && !headers['content-length']) {
            headers['content-length'] = String(Buffer.byteLength(payload));
        }

        const req = new Readable({
            read() {
                if (payload) {
                    this.push(payload);
                }
                this.push(null);
            }
        });

        req.method = method;
        req.url = path;
        req.headers = headers;

        const res = new MockResponse(resolve);
        res.on('error', reject);
        req.on('error', reject);

        try {
            server.emit('request', req, res);
        } catch (error) {
            reject(error);
        }
    });
}

function makeNetworkRequest(path, method, body, options = {}) {
    return new Promise((resolve, reject) => {
        const payload = options.raw
            ? String(body || '')
            : body == null
                ? null
                : JSON.stringify(body);
        const headers = normalizeHeaders(options.headers || {});

        if (payload && !headers['content-type']) {
            headers['content-type'] = 'application/json';
        }
        if (payload && !headers['content-length']) {
            headers['content-length'] = Buffer.byteLength(payload);
        }

        const req = http.request({
            hostname: getHost(),
            port: getPort(),
            path,
            method,
            headers
        }, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({
                        status: res.statusCode,
                        data: JSON.parse(data),
                        headers: normalizeHeaders(res.headers),
                        rawBody: data
                    });
                } catch {
                    resolve({
                        status: res.statusCode,
                        data,
                        headers: normalizeHeaders(res.headers),
                        rawBody: data
                    });
                }
            });
        });

        req.on('error', reject);
        if (payload) {
            req.write(payload);
        }
        req.end();
    });
}

function makeRequest(path, method, body, options = {}) {
    const server = getBoundServer();
    if (server) {
        return withCsrfProtection(
            (requestPath, requestMethod, requestBody, requestOptions) => dispatchRequest(server, requestPath, requestMethod, requestBody, requestOptions),
            path,
            method,
            body,
            options
        );
    }
    return withCsrfProtection(makeNetworkRequest, path, method, body, options);
}

async function assertServerReady() {
    console.log('Checking server health...');
    const health = await makeRequest('/', 'GET');
    if (health.status !== 200) {
        throw new Error(`Server not ready: HTTP ${health.status}`);
    }
    console.log('Server health check passed');
}

async function pollTaskStatus({ path, taskId, maxAttempts = 40, intervalMs = 3000, label }) {
    console.log(`\nPolling ${label} task status...`);

    for (let i = 0; i < maxAttempts; i++) {
        await sleep(intervalMs);
        const result = await makeRequest(path, 'POST', { taskId });
        const status = result.data || {};
        console.log(`   [${i + 1}/${maxAttempts}] status: ${status.status}, progress: ${status.progress}%`);

        if (status.status === 'completed') {
            console.log(`${label} task completed`);
            return status;
        }

        if (status.status === 'error') {
            throw new Error(status.error || `${label} task failed`);
        }
    }

    throw new Error(`${label} task polling timed out`);
}

module.exports = {
    getHost,
    getPort,
    sleep,
    bindServer,
    unbindServer,
    withBoundServer,
    dispatchRequest,
    makeRequest,
    assertServerReady,
    pollTaskStatus
};
