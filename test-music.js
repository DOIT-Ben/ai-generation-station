const { assertServerReady, makeRequest, pollTaskStatus } = require('./test-live-utils');

async function main() {
    console.log('=================================');
    console.log('  音乐生成功能测试');
    console.log('=================================\n');

    try {
        await assertServerReady();

        console.log('\n🎵 启动音乐生成...');
        const start = await makeRequest('/api/generate/music', 'POST', {
            prompt: '一段温暖的中文 lo-fi 流行纯音乐，适合夜晚学习',
            style: 'electronic',
            bpm: '中速 (90-120)',
            key: 'C大调',
            duration: '30秒'
        });

        if (start.status !== 200) {
            throw new Error(`HTTP ${start.status}`);
        }

        if (start.data.error) {
            throw new Error(start.data.error);
        }

        if (!start.data.taskId) {
            throw new Error('未返回任务ID');
        }

        console.log(`✅ 音乐任务已启动: ${start.data.taskId}`);

        const status = await pollTaskStatus({
            path: '/api/music/status',
            taskId: start.data.taskId,
            maxAttempts: 120,
            intervalMs: 3000,
            label: '音乐生成'
        });

        if (!status.url) {
            throw new Error('任务完成但未返回音频 URL');
        }

        console.log('\n✅ 测试通过');
        console.log(`   文件URL: ${status.url}`);
        console.log(`   时长: ${status.duration || '无'}`);
        return { passed: true, url: status.url, duration: status.duration };
    } catch (error) {
        throw error;
    }
}

if (require.main === module) {
    main().catch(error => {
        console.error(`❌ 测试失败: ${error.message}`);
        process.exit(1);
    });
}

module.exports = {
    main
};
