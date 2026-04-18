const { createServer } = require('./server/index');
const { createConfig } = require('./server/config');
const { makeRequest, sleep } = require('./test-live-utils');

async function waitForServer(port, timeoutMs = 15000) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
        try {
            const res = await makeRequestWithPort(port, '/', 'GET');
            if (res.status === 200) {
                return;
            }
        } catch {
            // Keep polling until timeout.
        }
        await sleep(300);
    }
    throw new Error(`服务器未在 ${timeoutMs}ms 内启动完成`);
}

function makeRequestWithPort(port, requestPath, method, body) {
    const originalPort = process.env.PORT;
    process.env.PORT = String(port);
    return makeRequest(requestPath, method, body).finally(() => {
        if (originalPort === undefined) {
            delete process.env.PORT;
        } else {
            process.env.PORT = originalPort;
        }
    });
}

async function withServer(env, fn) {
    const config = createConfig({
        env: {
            ...process.env,
            ...env
        }
    });
    const server = createServer({ config });
    try {
        await new Promise((resolve, reject) => {
            server.once('error', reject);
            server.listen(config.PORT, resolve);
        });
        await waitForServer(config.PORT);
        return await fn();
    } finally {
        await new Promise(resolve => {
            server.close(() => resolve());
        });
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
        await new Promise((resolve, reject) => {
            server.once('error', reject);
            server.listen(port, resolve);
        });
        await waitForServer(port);
        return await fn();
    } finally {
        await new Promise(resolve => {
            server.close(() => resolve());
        });
    }
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

async function testMissingApiKey() {
    console.log('\n1. 未配置 API key');
    await withServer({ PORT: '18798', MINIMAX_API_KEY: '' }, async () => {
        const res = await makeRequestWithPort(18798, '/api/generate/lyrics', 'POST', {
            prompt: '写一段歌词'
        });
        assert(res.status === 503, `期望 503，实际 ${res.status}`);
        assert(res.data.error === 'MINIMAX_API_KEY is not configured', '缺少 key 时返回信息不正确');
        console.log('✅ 缺少 key 时返回 503');
    });
}

async function testTaskValidation() {
    console.log('\n2. 任务状态校验');
    const missingTaskId = await makeRequest('/api/music/status', 'POST', {});
    assert(missingTaskId.status === 200, `期望 200，实际 ${missingTaskId.status}`);
    assert(missingTaskId.data.error === 'taskId is required', '缺少 taskId 时返回信息不正确');

    const notFound = await makeRequest('/api/image/status', 'POST', { taskId: 'missing-task' });
    assert(notFound.status === 200, `期望 200，实际 ${notFound.status}`);
    assert(notFound.data.status === 'not_found', '不存在任务时状态不正确');
    assert(notFound.data.error === 'Task not found', '不存在任务时错误信息不正确');

    console.log('✅ 缺少 taskId 和任务不存在都返回预期结果');
}

async function testVoiceCoverBadLocalAudio() {
    console.log('\n3. 翻唱坏文件路径');
    const start = await makeRequest('/api/generate/voice', 'POST', {
        audio_url: '/output/not-exists.mp3',
        prompt: '测试坏文件'
    });

    assert(start.status === 200, `期望 200，实际 ${start.status}`);
    assert(Boolean(start.data.taskId), '坏文件翻唱启动后未返回 taskId');

    let finalStatus = null;
    for (let i = 0; i < 10; i++) {
        await sleep(300);
        const status = await makeRequest('/api/music-cover/status', 'POST', { taskId: start.data.taskId });
        if (status.data.status === 'error') {
            finalStatus = status.data;
            break;
        }
    }

    assert(finalStatus, '坏文件翻唱没有进入 error 状态');
    assert(
        String(finalStatus.error || '').includes('无法读取音频文件'),
        `坏文件翻唱错误信息不正确: ${finalStatus.error}`
    );

    console.log('✅ 坏文件翻唱会进入 error 状态并返回明确错误');
}

async function main() {
    console.log('=================================');
    console.log('  异常路径回归测试');
    console.log('=================================');

    try {
        await withMainServer(async () => {
            console.log('\n🔍 检查主服务状态...');
            const health = await makeRequest('/', 'GET');
            if (health.status !== 200) {
                throw new Error(`主服务未响应: HTTP ${health.status}`);
            }
            console.log('✅ 主服务运行正常');

            await testMissingApiKey();
            await testTaskValidation();
            await testVoiceCoverBadLocalAudio();
        });

        console.log('\n✅ 异常路径回归通过');
        return { passed: true };
    } catch (error) {
        throw error;
    }
}

if (require.main === module) {
    main().catch(error => {
        console.error(`\n❌ 异常路径回归失败: ${error.message}`);
        process.exit(1);
    });
}

module.exports = {
    main
};
