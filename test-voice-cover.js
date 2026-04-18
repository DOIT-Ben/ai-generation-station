/**
 * 歌声翻唱功能测试脚本
 * 测试流程: 上传文件 -> 调用翻唱API -> 轮询结果
 */
const fs = require('fs');
const path = require('path');
const http = require('http');

const TEST_FILE = path.join(__dirname, 'resources', 'ai-music.mp3');

function getHost() {
    return process.env.HOST || 'localhost';
}

function getPort() {
    return Number(process.env.PORT || 18791);
}

// 读取文件为base64
function readFileAsBase64(filePath) {
    const buffer = fs.readFileSync(filePath);
    return buffer.toString('base64');
}

// HTTP请求辅助函数
function makeRequest(path, method, body) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: getHost(),
            port: getPort(),
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve({ status: res.statusCode, data: json });
                } catch (e) {
                    resolve({ status: res.statusCode, data: data });
                }
            });
        });

        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

// 测试文件上传
async function testUpload() {
    console.log('📤 测试文件上传...');
    console.log(`   文件: ${TEST_FILE}`);
    
    if (!fs.existsSync(TEST_FILE)) {
        console.error('❌ 测试文件不存在:', TEST_FILE);
        return null;
    }
    
    const base64 = readFileAsBase64(TEST_FILE);
    const filename = path.basename(TEST_FILE);
    
    console.log(`   文件大小: ${(base64.length / 1024).toFixed(2)} KB (base64)`);
    
    const result = await makeRequest('/api/upload', 'POST', {
        filename: filename,
        data: base64
    });
    
    if (result.data.success) {
        console.log('✅ 文件上传成功');
        console.log(`   URL: ${result.data.url}`);
        return result.data.url;
    } else {
        console.error('❌ 文件上传失败:', result.data.error);
        return null;
    }
}

// 测试歌声翻唱
async function testVoiceCover(audioUrl) {
    console.log('\n🎤 测试歌声翻唱...');
    console.log(`   音频URL: ${audioUrl}`);
    
    const result = await makeRequest('/api/generate/voice', 'POST', {
        audio_url: audioUrl,
        prompt: '磁性男声，流行风格',
        timbre: 'male-qn-qingse',
        pitch: '0'
    });
    
    console.log('📥 API响应:', JSON.stringify(result.data, null, 2));
    
    if (result.data.taskId) {
        console.log(`✅ 翻唱任务已启动: ${result.data.taskId}`);
        return result.data.taskId;
    } else if (result.data.error) {
        console.error('❌ 翻唱启动失败:', result.data.error);
        return null;
    }
}

// 轮询任务状态
async function pollTaskStatus(taskId, maxAttempts = 30) {
    console.log('\n⏳ 轮询任务状态...');
    
    for (let i = 0; i < maxAttempts; i++) {
        await new Promise(r => setTimeout(r, 3000));
        
        const result = await makeRequest('/api/music-cover/status', 'POST', {
            taskId: taskId
        });
        
        const status = result.data;
        console.log(`   [${i+1}/${maxAttempts}] 状态: ${status.status}, 进度: ${status.progress}%`);
        
        if (status.status === 'completed') {
            console.log('✅ 翻唱完成!');
            console.log(`   文件URL: ${status.url}`);
            return status;
        } else if (status.status === 'error') {
            console.error('❌ 翻唱失败:', status.error);
            return null;
        }
    }
    
    console.log('⏱️ 轮询超时');
    return null;
}

// 主测试流程
async function main() {
    console.log('=================================');
    console.log('  歌声翻唱功能测试');
    console.log('=================================\n');
    
    try {
        // 1. 测试服务器是否运行
        console.log('🔍 检查服务器状态...');
        const health = await makeRequest('/', 'GET');
        if (health.status !== 200) {
            console.error('❌ 服务器未响应');
            process.exit(1);
        }
        console.log('✅ 服务器运行正常\n');
        
        // 2. 上传文件
        const audioUrl = await testUpload();
        if (!audioUrl) {
            console.error('❌ 文件上传失败，测试终止');
            process.exit(1);
        }
        
        // 3. 启动翻唱任务
        const taskId = await testVoiceCover(audioUrl);
        if (!taskId) {
            console.error('❌ 翻唱任务启动失败，测试终止');
            process.exit(1);
        }
        
        // 4. 轮询结果
        const result = await pollTaskStatus(taskId);
        if (result) {
            console.log('\n✅ 测试通过！歌声翻唱功能正常');
            return { passed: true, url: result.url, duration: result.duration };
        } else {
            throw new Error('翻唱任务未完成');
        }
        
    } catch (err) {
        throw err;
    }
}

if (require.main === module) {
    main().catch(err => {
        console.error('❌ 测试出错:', err.message);
        process.exit(1);
    });
}

module.exports = {
    main
};
