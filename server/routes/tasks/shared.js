const fs = require('fs');

const DEFAULT_DOWNLOAD_OPTIONS = {
    maxRedirects: 3,
    maxBytes: 100 * 1024 * 1024,
    allowedProtocols: new Set(['https:']),
    allowedHosts: new Set(['api.minimaxi.com'])
};

function normalizeDownloadOptions(options = {}) {
    const allowedProtocols = options.allowedProtocols instanceof Set
        ? options.allowedProtocols
        : new Set(options.allowedProtocols || DEFAULT_DOWNLOAD_OPTIONS.allowedProtocols);
    const allowedHosts = options.allowedHosts instanceof Set
        ? options.allowedHosts
        : new Set(options.allowedHosts || DEFAULT_DOWNLOAD_OPTIONS.allowedHosts);

    return {
        maxRedirects: Number.isFinite(options.maxRedirects) ? options.maxRedirects : DEFAULT_DOWNLOAD_OPTIONS.maxRedirects,
        maxBytes: Number.isFinite(options.maxBytes) ? options.maxBytes : DEFAULT_DOWNLOAD_OPTIONS.maxBytes,
        allowedProtocols,
        allowedHosts
    };
}

function assertDownloadUrlAllowed(fileUrl, options) {
    let parsed;
    try {
        parsed = new URL(fileUrl);
    } catch {
        throw new Error('Invalid download URL');
    }

    if (!options.allowedProtocols.has(parsed.protocol)) {
        throw new Error('Unsupported download URL protocol');
    }
    if (options.allowedHosts.size && !options.allowedHosts.has(parsed.hostname)) {
        throw new Error('Unsupported download URL host');
    }
    return parsed;
}

function closeAndRemove(file, outputPath) {
    file.close(() => {
        fs.rm(outputPath, { force: true }, () => {});
    });
}

function downloadFromUrl(https, fileUrl, outputPath, options = {}, redirectCount = 0) {
    const normalizedOptions = normalizeDownloadOptions(options);
    const parsedUrl = assertDownloadUrlAllowed(fileUrl, normalizedOptions);

    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(outputPath);
        let downloadedBytes = 0;
        let settled = false;

        function fail(error) {
            if (settled) return;
            settled = true;
            closeAndRemove(file, outputPath);
            reject(error);
        }

        const request = https.get(parsedUrl, (response) => {
            if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
                response.resume();
                file.close(() => fs.rm(outputPath, { force: true }, () => {}));
                if (redirectCount >= normalizedOptions.maxRedirects) {
                    fail(new Error('Too many download redirects'));
                    return;
                }
                if (!response.headers.location) {
                    fail(new Error('Missing download redirect location'));
                    return;
                }
                const nextUrl = new URL(response.headers.location, parsedUrl).toString();
                downloadFromUrl(https, nextUrl, outputPath, normalizedOptions, redirectCount + 1).then(resolve).catch(reject);
                return;
            }

            if (response.statusCode < 200 || response.statusCode >= 300) {
                response.resume();
                fail(new Error(`Download failed with status ${response.statusCode}`));
                return;
            }

            const contentLength = Number(response.headers['content-length'] || 0);
            if (contentLength > normalizedOptions.maxBytes) {
                response.resume();
                fail(new Error('Download exceeds maximum size'));
                return;
            }

            response.on('data', (chunk) => {
                downloadedBytes += chunk.length;
                if (downloadedBytes > normalizedOptions.maxBytes) {
                    request.destroy(new Error('Download exceeds maximum size'));
                }
            });

            response.on('error', fail);
            response.pipe(file);
            file.on('finish', () => {
                if (settled) return;
                settled = true;
                file.close(resolve);
            });
        });

        request.on('error', fail);
        file.on('error', fail);
    });
}

module.exports = {
    downloadFromUrl
};
