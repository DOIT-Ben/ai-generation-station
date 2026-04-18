const { createServer } = require('./server/index');
const { createConfig } = require('./server/config');
const http = require('http');

const smokeTest = require('./test-suite');
const failureTest = require('./test-failures');
const frontendStateTest = require('./test-frontend-state');
const pageMarkupTest = require('./test-page-markup');
const lyricsTest = require('./test-lyrics');
const musicTest = require('./test-music');
const imageTest = require('./test-image');
const coverTest = require('./test-cover');
const voiceCoverTest = require('./test-voice-cover');

function parseArgs(argv) {
    const args = {
        port: 18797,
        skipLive: false
    };

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--skip-live') {
            args.skipLive = true;
        } else if (arg === '--port' && argv[i + 1]) {
            args.port = Number(argv[i + 1]);
            i += 1;
        }
    }

    return args;
}

async function listen(server, port) {
    await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, resolve);
    });
}

async function waitForServer(port, timeoutMs = 10000) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
        try {
            await new Promise((resolve, reject) => {
                const req = http.request({
                    hostname: 'localhost',
                    port,
                    path: '/',
                    method: 'GET'
                }, res => {
                    res.resume();
                    res.on('end', resolve);
                });
                req.on('error', reject);
                req.end();
            });
            return;
        } catch {
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    }

    throw new Error(`Server did not become ready on port ${port}`);
}

async function close(server) {
    await new Promise(resolve => server.close(() => resolve()));
}

async function withServer(port, fn) {
    const previousPort = process.env.PORT;
    process.env.PORT = String(port);
    const server = createServer({
        config: createConfig({
            env: {
                ...process.env,
                PORT: String(port)
            }
        })
    });

    try {
        await listen(server, port);
        await waitForServer(port);
        return await fn();
    } finally {
        await close(server);
        if (previousPort === undefined) {
            delete process.env.PORT;
        } else {
            process.env.PORT = previousPort;
        }
    }
}

async function runCase(results, name, fn) {
    const startedAt = Date.now();
    process.stdout.write(`\n[RUN] ${name}\n`);
    try {
        await fn();
        const duration = ((Date.now() - startedAt) / 1000).toFixed(1);
        results.push({ name, status: 'passed', duration });
        process.stdout.write(`[PASS] ${name} (${duration}s)\n`);
    } catch (error) {
        const duration = ((Date.now() - startedAt) / 1000).toFixed(1);
        results.push({ name, status: 'failed', duration, error: error.message });
        process.stdout.write(`[FAIL] ${name} (${duration}s)\n`);
        process.stdout.write(`       ${error.message}\n`);
    }
}

async function main() {
    const { port, skipLive } = parseArgs(process.argv.slice(2));
    const results = [];

    console.log('=================================');
    console.log('  全量回归测试');
    console.log('=================================');
    console.log(`端口: ${port}`);
    console.log(`实时链路: ${skipLive ? '跳过' : '开启'}`);

    await runCase(results, 'FrontendState', () => frontendStateTest.main());
    await runCase(results, 'PageMarkup', () => pageMarkupTest.main());

    await withServer(port, async () => {
        await runCase(results, 'Smoke', () => smokeTest.main());
    });

    const previousPort = process.env.PORT;
    process.env.PORT = String(port);
    try {
        await runCase(results, 'Failures', () => failureTest.main());
    } finally {
        if (previousPort === undefined) {
            delete process.env.PORT;
        } else {
            process.env.PORT = previousPort;
        }
    }

    if (!skipLive) {
        await withServer(port, async () => {
            await runCase(results, 'Lyrics', () => lyricsTest.main());
            await runCase(results, 'Music', () => musicTest.main());
            await runCase(results, 'Image', () => imageTest.main());
            await runCase(results, 'Cover', () => coverTest.main());
            await runCase(results, 'VoiceCover', () => voiceCoverTest.main());
        });
    }

    console.log('\n=================================');
    console.log('  回归总结');
    console.log('=================================');
    for (const item of results) {
        console.log(`${item.status === 'passed' ? 'PASS' : 'FAIL'}\t${item.name}\t${item.duration}s`);
        if (item.error) {
            console.log(`     ${item.error}`);
        }
    }
    const failed = results.filter(item => item.status === 'failed');
    console.log(`\n总计: ${results.length} 项，通过 ${results.length - failed.length}，失败 ${failed.length}`);
    if (failed.length > 0) {
        throw new Error(`Regression failed: ${failed.length} test group(s)`);
    }
}

if (require.main === module) {
    main().catch(() => {
        process.exit(1);
    });
}

module.exports = {
    main
};
