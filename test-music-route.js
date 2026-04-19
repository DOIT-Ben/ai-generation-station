const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Readable } = require('stream');

const { createMusicRoutes } = require('./server/routes/tasks/music');

function createFakeHttps({ requestResponses = [], downloads = {} }) {
    let requestIndex = 0;

    return {
        request(options, callback) {
            const responseBody = requestResponses[requestIndex++];
            const handlers = {};

            return {
                on(event, handler) {
                    handlers[event] = handler;
                    return this;
                },
                write() {},
                end() {
                    const res = new Readable({ read() {} });
                    res.statusCode = 200;
                    callback(res);
                    const body = typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody || {});
                    res.push(body);
                    res.push(null);
                }
            };
        },
        get(fileUrl, callback) {
            const body = downloads[fileUrl] || Buffer.alloc(0);
            const res = Readable.from([body]);
            res.statusCode = 200;
            res.headers = {};
            callback(res);

            return {
                on() {
                    return this;
                }
            };
        }
    };
}

function createHarness(https) {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aigs-music-route-'));
    const musicTasks = new Map();
    const usage = [];
    const routes = createMusicRoutes({
        https,
        API_HOST: 'api.minimaxi.com',
        API_KEY: 'test-key',
        OUTPUT_DIR: tmpDir,
        musicTasks,
        trackUsage(userId, feature) {
            usage.push({ userId, feature });
        },
        stateStore: {
            createTask() {},
            updateTask() {}
        }
    });

    return { tmpDir, musicTasks, routes, usage };
}

async function waitFor(predicate, timeoutMs = 200) {
    const startedAt = Date.now();
    while (!predicate()) {
        if (Date.now() - startedAt > timeoutMs) {
            throw new Error('Timed out waiting for async task');
        }
        await new Promise(resolve => setTimeout(resolve, 5));
    }
}

async function testInitialAudioUrlResponse() {
    const audioUrl = 'https://cdn.example.com/music.mp3';
    const harness = createHarness(createFakeHttps({
        requestResponses: [
            {
                data: { audio_url: audioUrl },
                extra_info: { music_duration: 1234 }
            }
        ],
        downloads: {
            [audioUrl]: Buffer.from('music-bytes')
        }
    }));

    const result = await harness.routes['/api/generate/music'](
        { authSession: { userId: 'user-1' } },
        null,
        { prompt: 'warm lo-fi background music', style: 'electronic', bpm: '90', key: 'C', duration: 30 }
    );

    await waitFor(() => harness.musicTasks.get(result.taskId)?.status === 'completed');

    const task = harness.musicTasks.get(result.taskId);
    assert(task, 'Expected task to exist');
    assert.strictEqual(task.status, 'completed');
    assert.strictEqual(task.duration, 1234);
    assert.strictEqual(task.size, Buffer.byteLength('music-bytes'));
    assert(fs.existsSync(task.outputFile), 'Expected output file to be written');
    assert.strictEqual(fs.readFileSync(task.outputFile, 'utf8'), 'music-bytes');
    assert.deepStrictEqual(harness.usage, [{ userId: 'user-1', feature: 'music' }]);
}

async function testNestedTaskIdResponse() {
    const realSetTimeout = global.setTimeout;
    global.setTimeout = (fn) => realSetTimeout(fn, 0);

    try {
        const harness = createHarness(createFakeHttps({
            requestResponses: [
                { data: { task_id: 'provider-task-1' } },
                {
                    status: 2,
                    data: { audio: Buffer.from('hello-music').toString('hex') },
                    extra_info: { music_duration: 321 }
                }
            ]
        }));

        const result = await harness.routes['/api/generate/music'](
            { authSession: { userId: 'user-2' } },
            null,
            { prompt: 'warm lo-fi background music', style: 'electronic', bpm: '90', key: 'C', duration: 30 }
        );

        await waitFor(() => harness.musicTasks.get(result.taskId)?.status === 'completed');

        const task = harness.musicTasks.get(result.taskId);
        assert(task, 'Expected task to exist');
        assert.strictEqual(task.providerTaskId, 'provider-task-1');
        assert.strictEqual(task.status, 'completed');
        assert.strictEqual(task.duration, 321);
        assert.strictEqual(fs.readFileSync(task.outputFile, 'utf8'), 'hello-music');
        assert.deepStrictEqual(harness.usage, [{ userId: 'user-2', feature: 'music' }]);
    } finally {
        global.setTimeout = realSetTimeout;
    }
}

async function main() {
    await testInitialAudioUrlResponse();
    await testNestedTaskIdResponse();
    console.log('Music route regression tests passed');
}

if (require.main === module) {
    main().catch(error => {
        console.error(error.message);
        process.exit(1);
    });
}

module.exports = {
    main
};
