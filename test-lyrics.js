const { assertServerReady, makeRequest } = require('./test-live-utils');

async function main() {
    console.log('=================================');
    console.log('  歌词生成功能测试');
    console.log('=================================\n');

    try {
        await assertServerReady();

        console.log('\n📝 测试歌词生成...');
        const result = await makeRequest('/api/generate/lyrics', 'POST', {
            prompt: '写一首关于深夜城市与未来希望的中文流行歌词',
            style: 'pop',
            structure: '主歌1-副歌-主歌2-副歌-桥段-副歌'
        });

        if (result.status !== 200) {
            throw new Error(`HTTP ${result.status}`);
        }

        if (result.data.error) {
            throw new Error(result.data.error);
        }

        const lyrics = result.data.lyrics || result.data.content || '';
        const title = result.data.title || '未返回标题';

        if (!lyrics.trim()) {
            throw new Error('接口返回成功但歌词为空');
        }

        console.log('✅ 歌词生成成功');
        console.log(`   标题: ${title}`);
        console.log(`   长度: ${lyrics.length} 字符`);
        console.log(`   片段: ${lyrics.slice(0, 120).replace(/\s+/g, ' ')}...`);
        return { passed: true, title, length: lyrics.length };
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
