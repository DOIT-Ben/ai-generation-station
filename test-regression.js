const fs = require('fs');
const os = require('os');
const path = require('path');
const dns = require('dns').promises;
const { createServer } = require('./server/index');
const { createConfig } = require('./server/config');
const { withBoundServer } = require('./test-live-utils');

const smokeTest = require('./test-suite');
const failureTest = require('./test-failures');
const authHistoryTest = require('./test-auth-history');
const taskPersistenceTest = require('./test-task-persistence');
const frontendStateTest = require('./test-frontend-state');
const pageMarkupTest = require('./test-page-markup');
const styleContractTest = require('./test-style-contract');
const uiFlowSmokeTest = require('./test-ui-flow-smoke');
const uiVisualTest = require('./test-ui-visual');
const securityGatewayTest = require('./test-security-gateway');
const musicRouteTest = require('./test-music-route');
const voiceCoverRouteTest = require('./test-voice-cover-route');
const lyricsTest = require('./test-lyrics');
const musicTest = require('./test-music');
const imageTest = require('./test-image');
const coverTest = require('./test-cover');
const voiceCoverTest = require('./test-voice-cover');

function parseArgs(argv) {
    const args = {
        port: 18797,
        skipLive: false,
        skipBrowser: false
    };

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--skip-live') {
            args.skipLive = true;
        } else if (arg === '--skip-browser') {
            args.skipBrowser = true;
        } else if (arg === '--port' && argv[i + 1]) {
            args.port = Number(argv[i + 1]);
            i += 1;
        }
    }

    return args;
}

async function withServer(port, fn) {
    const previousPort = process.env.PORT;
    const previousStateDb = process.env.APP_STATE_DB;
    const previousStateFile = process.env.APP_STATE_FILE;
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aigs-regression-'));
    const tempStateDb = path.join(tempRoot, 'app-state.db');
    const tempStateFile = path.join(tempRoot, 'app-state.json');
    fs.writeFileSync(tempStateFile, JSON.stringify({ sessions: {}, history: {} }, null, 2));

    process.env.PORT = String(port);
    process.env.APP_STATE_DB = tempStateDb;
    process.env.APP_STATE_FILE = tempStateFile;
    const server = createServer({
        config: createConfig({
            env: {
                ...process.env,
                PORT: String(port),
                APP_STATE_DB: tempStateDb,
                APP_STATE_FILE: tempStateFile
            }
        })
    });

    try {
        return await withBoundServer(server, fn);
    } finally {
        server.appStateStore?.close?.();
        if (previousPort === undefined) {
            delete process.env.PORT;
        } else {
            process.env.PORT = previousPort;
        }
        if (previousStateDb === undefined) {
            delete process.env.APP_STATE_DB;
        } else {
            process.env.APP_STATE_DB = previousStateDb;
        }
        if (previousStateFile === undefined) {
            delete process.env.APP_STATE_FILE;
        } else {
            process.env.APP_STATE_FILE = previousStateFile;
        }
        fs.rmSync(tempRoot, { recursive: true, force: true });
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

function recordSkipped(results, name, reason) {
    results.push({ name, status: 'skipped', duration: '0.0', reason });
    process.stdout.write(`\n[SKIP] ${name}\n`);
    process.stdout.write(`       ${reason}\n`);
}

async function getLivePreflight() {
    const config = createConfig({
        env: {
            ...process.env
        }
    });

    if (!config.API_KEY) {
        return {
            enabled: false,
            reason: 'MINIMAX_API_KEY is not configured'
        };
    }

    const host = String(config.API_HOST || '').replace(/^https?:\/\//, '').split('/')[0];
    try {
        await dns.lookup(host);
        return { enabled: true };
    } catch (error) {
        return {
            enabled: false,
            reason: `Unable to resolve ${host}: ${error.code || error.message}`
        };
    }
}

async function main() {
    const { port, skipLive, skipBrowser } = parseArgs(process.argv.slice(2));
    const results = [];

    console.log('=================================');
    console.log('  Full regression');
    console.log('=================================');
    console.log(`Port: ${port}`);
    console.log(`Live API checks: ${skipLive ? 'skipped' : 'enabled'}`);
    console.log(`Browser UI checks: ${skipBrowser ? 'skipped' : 'enabled'}`);

    await runCase(results, 'FrontendState', () => frontendStateTest.main());
    await runCase(results, 'PageMarkup', () => pageMarkupTest.main());
    await runCase(results, 'StyleContract', () => styleContractTest.main());
    if (skipBrowser) {
        recordSkipped(results, 'UiFlowSmoke', 'Browser UI checks skipped by --skip-browser');
        recordSkipped(results, 'UiVisualRegression', 'Browser UI checks skipped by --skip-browser');
    } else {
        await runCase(results, 'UiFlowSmoke', () => uiFlowSmokeTest.main({ port, launchServer: true }));
        await runCase(results, 'UiVisualRegression', () => uiVisualTest.main({ port, launchServer: true }));
    }
    await runCase(results, 'SecurityGateway', () => securityGatewayTest.main());
    await runCase(results, 'AuthHistory', () => authHistoryTest.main());
    await runCase(results, 'TaskPersistence', () => taskPersistenceTest.main());
    await runCase(results, 'MusicRoute', () => musicRouteTest.main());
    await runCase(results, 'VoiceCoverRoute', () => voiceCoverRouteTest.main());

    await withServer(port, async () => {
        await runCase(results, 'Smoke', () => smokeTest.main());
    });

    await runCase(results, 'Failures', () => failureTest.main());

    if (!skipLive) {
        const livePreflight = await getLivePreflight();
        if (!livePreflight.enabled) {
            const reason = `Live API tests skipped: ${livePreflight.reason}`;
            recordSkipped(results, 'Lyrics', reason);
            recordSkipped(results, 'Music', reason);
            recordSkipped(results, 'Image', reason);
            recordSkipped(results, 'Cover', reason);
            recordSkipped(results, 'VoiceCover', reason);
        } else {
        await withServer(port, async () => {
            await runCase(results, 'Lyrics', () => lyricsTest.main());
            await runCase(results, 'Music', () => musicTest.main());
            await runCase(results, 'Image', () => imageTest.main());
            await runCase(results, 'Cover', () => coverTest.main());
            await runCase(results, 'VoiceCover', () => voiceCoverTest.main());
        });
        }
    }

    console.log('\n=================================');
    console.log('  Regression summary');
    console.log('=================================');
    for (const item of results) {
        const label = item.status === 'passed' ? 'PASS' : item.status === 'failed' ? 'FAIL' : 'SKIP';
        console.log(`${label}\t${item.name}\t${item.duration}s`);
        if (item.error) {
            console.log(`     ${item.error}`);
        }
        if (item.reason) {
            console.log(`     ${item.reason}`);
        }
    }
    const failed = results.filter(item => item.status === 'failed');
    const skipped = results.filter(item => item.status === 'skipped');
    const passed = results.filter(item => item.status === 'passed');
    console.log(`\nTotal: ${results.length}, Passed: ${passed.length}, Skipped: ${skipped.length}, Failed: ${failed.length}`);
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
