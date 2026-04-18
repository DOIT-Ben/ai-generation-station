const { createServer } = require('./server/index');
const { createConfig } = require('./server/config');
const { makeRequest, sleep, withBoundServer } = require('./test-live-utils');

async function withServer(env, fn) {
    const config = createConfig({
        env: {
            ...process.env,
            ...env
        }
    });
    const server = createServer({ config });
    try {
        return await withBoundServer(server, fn);
    } finally {
        server.appStateStore?.close?.();
    }
}

async function withMainServer(fn) {
    const port = Number(process.env.PORT || 18791);
    const server = createServer({
        config: createConfig({
            env: {
                ...process.env,
                PORT: String(port)
            }
        })
    });

    try {
        return await withBoundServer(server, fn);
    } finally {
        server.appStateStore?.close?.();
    }
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

async function testMissingApiKey() {
    console.log('\n1. Missing API key');
    await withServer({ PORT: '18798', MINIMAX_API_KEY: '' }, async () => {
        const res = await makeRequest('/api/generate/lyrics', 'POST', {
            prompt: 'Write a short lyric'
        });
        assert(res.status === 503, `Expected 503, got ${res.status}`);
        assert(res.data.error === 'MINIMAX_API_KEY is not configured', 'Unexpected error message when API key is missing');
        console.log('Missing key returns 503 as expected');
    });
}

async function testTaskValidation() {
    console.log('\n2. Task status validation');
    const missingTaskId = await makeRequest('/api/music/status', 'POST', {});
    assert(missingTaskId.status === 200, `Expected 200, got ${missingTaskId.status}`);
    assert(missingTaskId.data.error === 'taskId is required', 'Missing taskId should return the expected error');

    const notFound = await makeRequest('/api/image/status', 'POST', { taskId: 'missing-task' });
    assert(notFound.status === 200, `Expected 200, got ${notFound.status}`);
    assert(notFound.data.status === 'not_found', 'Missing task should return not_found');
    assert(notFound.data.error === 'Task not found', 'Missing task should return a clear error');

    console.log('Task validation returns the expected results');
}

async function testVoiceCoverBadLocalAudio() {
    console.log('\n3. Voice cover bad local audio');
    const start = await makeRequest('/api/generate/voice', 'POST', {
        audio_url: '/output/not-exists.mp3',
        prompt: 'broken file'
    });

    assert(start.status === 200, `Expected 200, got ${start.status}`);
    assert(Boolean(start.data.taskId), 'Voice cover should still return a taskId for a bad local file');

    let finalStatus = null;
    for (let i = 0; i < 10; i++) {
        await sleep(300);
        const status = await makeRequest('/api/music-cover/status', 'POST', { taskId: start.data.taskId });
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
        const health = await makeRequest('/', 'GET');
        if (health.status !== 200) {
            throw new Error(`Main server returned HTTP ${health.status}`);
        }
        console.log('Main server request path is available');

        await testMissingApiKey();
        await testTaskValidation();
        await testVoiceCoverBadLocalAudio();
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
