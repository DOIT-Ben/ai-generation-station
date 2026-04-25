const fs = require('fs');
const os = require('os');
const path = require('path');
const { createServer } = require('./server/index');
const { createConfig } = require('./server/config');
const { makeRequest, sleep, withBoundServer } = require('./test-live-utils');

function createTempStatePaths() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aigs-failures-'));
    const stateDb = path.join(root, 'app-state.db');
    const stateFile = path.join(root, 'app-state.json');
    fs.writeFileSync(stateFile, JSON.stringify({ sessions: {}, history: {} }, null, 2));
    return { root, stateDb, stateFile };
}

async function withServer(env, fn) {
    const tempState = createTempStatePaths();
    const config = createConfig({
        env: {
            ...process.env,
            ...env,
            APP_STATE_DB: tempState.stateDb,
            APP_STATE_FILE: tempState.stateFile
        }
    });
    const server = createServer({ config });
    try {
        return await withBoundServer(server, fn);
    } finally {
        server.appStateStore?.close?.();
        fs.rmSync(tempState.root, { recursive: true, force: true });
    }
}

async function withMainServer(fn) {
    const port = Number(process.env.PORT || 18791);
    const tempState = createTempStatePaths();
    const server = createServer({
        config: createConfig({
            env: {
                ...process.env,
                PORT: String(port),
                APP_STATE_DB: tempState.stateDb,
                APP_STATE_FILE: tempState.stateFile
            }
        })
    });

    try {
        return await withBoundServer(server, fn);
    } finally {
        server.appStateStore?.close?.();
        fs.rmSync(tempState.root, { recursive: true, force: true });
    }
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

async function loginAsAdmin() {
    const login = await makeRequest('/api/auth/login', 'POST', {
        username: 'studio',
        password: 'AIGS2026!'
    });
    assert(login.status === 200, `Expected admin login to succeed, got ${login.status}`);
    const rawCookieHeader = login.headers?.['set-cookie'];
    const cookieHeader = Array.isArray(rawCookieHeader) ? rawCookieHeader[0] : rawCookieHeader;
    const cookie = String(cookieHeader || '').split(';')[0];
    assert(Boolean(cookie), 'Expected admin login to return a session cookie');
    return cookie;
}

async function testMissingApiKey() {
    console.log('\n1. Missing API key');
    await withServer({ PORT: '18798', MINIMAX_API_KEY: '' }, async () => {
        const cookie = await loginAsAdmin();
        const res = await makeRequest('/api/generate/lyrics', 'POST', {
            prompt: 'Write a short lyric'
        }, {
            headers: {
                Cookie: cookie
            }
        });
        assert(res.status === 503, `Expected 503, got ${res.status}`);
        assert(res.data.error === 'MINIMAX_API_KEY is not configured', 'Unexpected error message when API key is missing');
        console.log('Missing key returns 503 as expected');
    });
}

async function testTaskValidation(cookie) {
    console.log('\n2. Task status validation');
    const headers = { Cookie: cookie };
    const missingTaskId = await makeRequest('/api/music/status', 'POST', {}, { headers });
    assert(missingTaskId.status === 200, `Expected 200, got ${missingTaskId.status}`);
    assert(missingTaskId.data.error === 'taskId is required', 'Missing taskId should return the expected error');

    const notFound = await makeRequest('/api/image/status', 'POST', { taskId: 'missing-task' }, { headers });
    assert(notFound.status === 200, `Expected 200, got ${notFound.status}`);
    assert(notFound.data.status === 'not_found', 'Missing task should return not_found');
    assert(notFound.data.error === 'Task not found', 'Missing task should return a clear error');

    console.log('Task validation returns the expected results');
}

async function testVoiceCoverBadLocalAudio(cookie) {
    console.log('\n3. Voice cover bad local audio');
    const headers = { Cookie: cookie };
    const start = await makeRequest('/api/generate/voice', 'POST', {
        audio_url: '/output/not-exists.mp3',
        prompt: 'broken file'
    }, { headers });

    assert(start.status === 200, `Expected 200, got ${start.status}`);
    assert(Boolean(start.data.taskId), 'Voice cover should still return a taskId for a bad local file');

    let finalStatus = null;
    for (let i = 0; i < 10; i++) {
        await sleep(300);
        const status = await makeRequest('/api/music-cover/status', 'POST', { taskId: start.data.taskId }, { headers });
        if (status.data.status === 'error') {
            finalStatus = status.data;
            break;
        }
    }

    assert(finalStatus, 'Bad local file never reached error state');
    assert(
        String(finalStatus.error || '').includes('/output/not-exists.mp3'),
        `Unexpected error message: ${finalStatus.error}`
    );

    console.log('Bad local file enters error state with a clear message');
}

async function main() {
    console.log('=================================');
    console.log('  Failure path regression');
    console.log('=================================');

    await withMainServer(async () => {
        console.log('\nChecking main server state...');
        const health = await makeRequest('/api/health', 'GET');
        if (health.status !== 200) {
            throw new Error(`Main server returned HTTP ${health.status}`);
        }
        console.log('Main server request path is available');
        const cookie = await loginAsAdmin();

        await testMissingApiKey();
        await testTaskValidation(cookie);
        await testVoiceCoverBadLocalAudio(cookie);
    });

    console.log('\nFailure path regression passed');
    return { passed: true };
}

if (require.main === module) {
    main().catch(error => {
        console.error(`\nFailure path regression failed: ${error.message}`);
        process.exit(1);
    });
}

module.exports = {
    main
};
