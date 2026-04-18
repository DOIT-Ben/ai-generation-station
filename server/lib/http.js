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

async function readJsonBody(req) {
    let rawBody = '';
    req.on('data', chunk => rawBody += chunk);
    await new Promise(resolve => req.on('end', resolve));
    return JSON.parse(rawBody || '{}');
}

function sendJson(res, statusCode, payload) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(payload));
}

function serveStaticFile(res, filepath, mimeTypes, fallbackContentType = 'text/plain') {
    const ext = path.extname(filepath);
    const content = fs.readFileSync(filepath);
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || fallbackContentType });
    res.end(content);
}

module.exports = {
    matchRoute,
    readJsonBody,
    sendJson,
    serveStaticFile
};
