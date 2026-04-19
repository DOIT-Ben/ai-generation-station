const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Readable } = require('stream');

const { createVoiceCoverRoutes } = require('./server/routes/tasks/voice-cover');

function createFakeHttps({ requestResponses = [], downloads = {} }) {
    let requestIndex = 0;

    return {
        request(options, callback) {
            const responseBody = requestResponses[requestIndex++];

            return {
                on() {
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
            const entry = downloads[fileUrl] || { statusCode: 200, body: Buffer.alloc(0), headers: {} };
            const res = Readable.from([entry.body]);
            res.statusCode = entry.statusCode || 200;
            res.headers = entry.headers || {};
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
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aigs-cover-route-'));
    const coverTasks = new Map();
    const usage = [];
    fs.writeFileSync(path.join(tmpDir, 'upload.mp3'), Buffer.from('source-audio'));

    const routes = createVoiceCoverRoutes({
        https,
        API_HOST: 'api.minimaxi.com',
        API_KEY: 'test-key',
        OUTPUT_DIR: tmpDir,
        coverTasks,
        trackUsage(userId, feature) {
            usage.push({ userId, feature });
        },
        stateStore: {
            createTask() {},
            updateTask() {}
        }
    });

    return { tmpDir, coverTasks, routes, usage };
}

async function waitFor(predicate, timeoutMs = 500) {
    const startedAt = Date.now();
    while (!predicate()) {
        if (Date.now() - startedAt > timeoutMs) {
            throw new Error('Timed out waiting for async task');
        }
        await new Promise(resolve => setTimeout(resolve, 5));
    }
}

async function testSyncUrlInAudioField() {
    const coverUrl = 'https://cdn.example.com/cover-sync.mp3';
    const harness = createHarness(createFakeHttps({
        requestResponses: [
            {
                base_resp: { status_code: 0, status_msg: 'success' },
                data: {
                    status: 2,
                    audio: coverUrl
                },
                extra_info: { music_duration: 111 }
            }
        ],
        downloads: {
            [coverUrl]: { body: Buffer.from('cover-sync') }
        }
    }));

    const result = await harness.routes['/api/generate/voice'](
        { authSession: { userId: 'user-1' } },
        null,
        {
            audio_url: '/output/upload.mp3',
            prompt: 'Pop style',
            timbre: 'male-qn-qingse',
            pitch: '0'
        }
    );

    await waitFor(() => {
        const task = harness.coverTasks.get(result.taskId);
        return task?.status === 'completed' && task?.size > 0;
    });

    const task = harness.coverTasks.get(result.taskId);
    assert(task, 'Expected task to exist');
    assert.strictEqual(task.status, 'completed');
    assert.strictEqual(task.duration, 111);
    assert.strictEqual(task.size, Buffer.byteLength('cover-sync'));
    assert.strictEqual(fs.readFileSync(task.outputFile, 'utf8'), 'cover-sync');
    assert.deepStrictEqual(harness.usage, [{ userId: 'user-1', feature: 'cover' }]);
}

async function testAsyncUrlInAudioField() {
    const realSetTimeout = global.setTimeout;
    global.setTimeout = (fn) => realSetTimeout(fn, 0);

    try {
        const coverUrl = 'https://cdn.example.com/cover-async.mp3';
        const harness = createHarness(createFakeHttps({
            requestResponses: [
                {
                    base_resp: { status_code: 0, status_msg: 'success' },
                    task_id: 'cover-provider-1'
                },
                {
                    status: 2,
                    data: {
                        audio: coverUrl
                    },
                    extra_info: { music_duration: 222 }
                }
            ],
            downloads: {
                [coverUrl]: { body: Buffer.from('cover-async') }
            }
        }));

        const result = await harness.routes['/api/generate/voice'](
            { authSession: { userId: 'user-2' } },
            null,
            {
                audio_url: '/output/upload.mp3',
                prompt: 'Pop style',
                timbre: 'male-qn-qingse',
                pitch: '0'
            }
        );

        await waitFor(() => {
            const task = harness.coverTasks.get(result.taskId);
            return task?.status === 'completed' && task?.size > 0;
        });

        const task = harness.coverTasks.get(result.taskId);
        assert(task, 'Expected task to exist');
        assert.strictEqual(task.providerTaskId, 'cover-provider-1');
        assert.strictEqual(task.status, 'completed');
        assert.strictEqual(task.duration, 222);
        assert.strictEqual(task.size, Buffer.byteLength('cover-async'));
        assert.strictEqual(fs.readFileSync(task.outputFile, 'utf8'), 'cover-async');
        assert.deepStrictEqual(harness.usage, [{ userId: 'user-2', feature: 'cover' }]);
    } finally {
        global.setTimeout = realSetTimeout;
    }
}

async function main() {
    await testSyncUrlInAudioField();
    await testAsyncUrlInAudioField();
    console.log('Voice cover route regression tests passed');
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
