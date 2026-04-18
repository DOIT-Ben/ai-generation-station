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

function makeRequest(requestPath, method, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : '';
    const req = http.request({
      hostname: getHost(),
      port: getPort(),
      path: requestPath,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function test() {
  console.log('=== 测试歌声翻唱 ===\n');
  
  // 1. 上传文件
  if (!fs.existsSync(TEST_FILE)) {
    throw new Error(`测试文件不存在: ${TEST_FILE}`);
  }

  const file = fs.readFileSync(TEST_FILE);
  const base64 = file.toString('base64');
  
  console.log('1. 上传音频文件...');
  const uploadRes = await makeRequest('/api/upload', 'POST', { filename: 'test.mp3', data: base64 });
  
  console.log('   结果:', uploadRes.success ? '成功' : '失败');
  if (!uploadRes.success) {
    throw new Error(uploadRes.error || '上传失败');
  }
  console.log('   URL:', uploadRes.url);
  
  // 2. 调用翻唱
  console.log('\n2. 启动翻唱任务...');
  const coverRes = await makeRequest('/api/generate/voice', 'POST', {
    audio_url: uploadRes.url,
    prompt: '流行风格',
    timbre: 'male-qn-qingse',
    pitch: '0'
  });
  
  console.log('   结果:', coverRes.taskId ? '已启动' : '失败');
  if (!coverRes.taskId) {
    throw new Error(coverRes.error || '翻唱任务启动失败');
  }
  console.log('   TaskID:', coverRes.taskId);
  
  // 3. 轮询状态
  console.log('\n3. 轮询任务状态...');
  let completed = false;
  for (let i = 0; i < 30 && !completed; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const status = await makeRequest('/api/music-cover/status', 'POST', { taskId: coverRes.taskId });
    
    console.log(`   [${i+1}] 状态: ${status.status}, 进度: ${status.progress}%${status.error ? ', 错误: ' + status.error : ''}`);
    
    if (status.status === 'completed' || status.status === 'error') {
      completed = true;
      console.log('\n   最终结果:');
      console.log('   - 状态:', status.status);
      console.log('   - URL:', status.url || '无');
      console.log('   - 时长:', status.duration || '无');
      if (status.error) console.log('   - 错误:', status.error);
      if (status.status === 'completed') {
        return { passed: true, url: status.url, duration: status.duration };
      }
      throw new Error(status.error || '翻唱任务失败');
    }
  }
  
  if (!completed) {
    throw new Error('翻唱任务轮询超时');
  }
}

async function main() {
  return test();
}

if (require.main === module) {
  main().catch(err => {
    console.error('测试出错:', err.message);
    process.exit(1);
  });
}

module.exports = {
  main
};
