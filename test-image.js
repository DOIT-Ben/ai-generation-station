const { assertServerReady, makeRequest, pollTaskStatus } = require('./test-live-utils');

async function main() {
    console.log('=================================');
    console.log('  封面生成功能测试');
    console.log('=================================\n');

    try {
        await assertServerReady();

        console.log('\n🖼️ 启动封面生成...');
        const start = await makeRequest('/api/generate/cover', 'POST', {
            prompt: '赛博朋克城市夜景专辑封面，霓虹灯，电影感，中文流行音乐',
            ratio: '1:1',
            style: '赛博朋克'
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

        console.log(`✅ 封面任务已启动: ${start.data.taskId}`);

        const status = await pollTaskStatus({
            path: '/api/image/status',
            taskId: start.data.taskId,
            maxAttempts: 40,
            intervalMs: 3000,
            label: '封面生成'
        });

        if (!status.url) {
            throw new Error('任务完成但未返回图片 URL');
        }

        console.log('\n✅ 测试通过');
        console.log(`   文件URL: ${status.url}`);
        console.log(`   文件大小: ${status.size || '无'}`);
        console.log(`   耗时: ${status.duration || '无'}`);
        return { passed: true, url: status.url, size: status.size };
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
