const http = require('http');

function getHost() {
    return process.env.HOST || 'localhost';
}

function getPort() {
    return Number(process.env.PORT || 18791);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function makeRequest(path, method, body) {
    return new Promise((resolve, reject) => {
        const payload = body ? JSON.stringify(body) : null;
        const headers = {};

        if (payload) {
            headers['Content-Type'] = 'application/json';
            headers['Content-Length'] = Buffer.byteLength(payload);
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
                    resolve({ status: res.statusCode, data: JSON.parse(data) });
                } catch {
                    resolve({ status: res.statusCode, data });
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

async function assertServerReady() {
    console.log('🔍 检查服务器状态...');
    const health = await makeRequest('/', 'GET');
    if (health.status !== 200) {
        throw new Error(`服务器未响应: HTTP ${health.status}`);
    }
    console.log('✅ 服务器运行正常');
}

async function pollTaskStatus({ path, taskId, maxAttempts = 40, intervalMs = 3000, label }) {
    console.log(`\n⏳ 轮询${label}任务状态...`);

    for (let i = 0; i < maxAttempts; i++) {
        await sleep(intervalMs);
        const result = await makeRequest(path, 'POST', { taskId });
        const status = result.data || {};
        console.log(`   [${i + 1}/${maxAttempts}] 状态: ${status.status}, 进度: ${status.progress}%`);

        if (status.status === 'completed') {
            console.log(`✅ ${label}任务完成`);
            return status;
        }

        if (status.status === 'error') {
            throw new Error(status.error || `${label}任务失败`);
        }
    }

    throw new Error(`${label}任务轮询超时`);
}

module.exports = {
    getHost,
    getPort,
    sleep,
    makeRequest,
    assertServerReady,
    pollTaskStatus
};
