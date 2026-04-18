const fs = require('fs');
const path = require('path');
const { assertServerReady, makeRequest } = require('./test-live-utils');

const TEST_FILE = path.join(__dirname, 'resources', 'ai-music.mp3');

async function requestJson(requestPath, method, body) {
  const response = await makeRequest(requestPath, method, body);
  return response.data;
}

async function test() {
  console.log('=== Voice cover test ===\n');

  if (!fs.existsSync(TEST_FILE)) {
    throw new Error(`Test file not found: ${TEST_FILE}`);
  }

  await assertServerReady();

  const file = fs.readFileSync(TEST_FILE);
  const base64 = file.toString('base64');

  console.log('1. Upload audio file...');
  const uploadRes = await requestJson('/api/upload', 'POST', { filename: 'test.mp3', data: base64 });

  console.log('   Result:', uploadRes.success ? 'success' : 'failed');
  if (!uploadRes.success) {
    throw new Error(uploadRes.error || 'Upload failed');
  }
  console.log('   URL:', uploadRes.url);

  console.log('\n2. Start voice cover task...');
  const coverRes = await requestJson('/api/generate/voice', 'POST', {
    audio_url: uploadRes.url,
    prompt: 'Pop style',
    timbre: 'male-qn-qingse',
    pitch: '0'
  });

  console.log('   Result:', coverRes.taskId ? 'started' : 'failed');
  if (!coverRes.taskId) {
    throw new Error(coverRes.error || 'Voice cover task failed to start');
  }
  console.log('   TaskID:', coverRes.taskId);

  console.log('\n3. Poll task status...');
  let completed = false;
  for (let i = 0; i < 30 && !completed; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const status = await requestJson('/api/music-cover/status', 'POST', { taskId: coverRes.taskId });

    console.log(`   [${i + 1}] status: ${status.status}, progress: ${status.progress}%${status.error ? `, error: ${status.error}` : ''}`);

    if (status.status === 'completed' || status.status === 'error') {
      completed = true;
      console.log('\n   Final result:');
      console.log('   - status:', status.status);
      console.log('   - URL:', status.url || 'none');
      console.log('   - duration:', status.duration || 'none');
      if (status.error) console.log('   - error:', status.error);
      if (status.status === 'completed') {
        return { passed: true, url: status.url, duration: status.duration };
      }
      throw new Error(status.error || 'Voice cover task failed');
    }
  }

  if (!completed) {
    throw new Error('Voice cover task polling timed out');
  }
}

async function main() {
  return test();
}

if (require.main === module) {
  main().catch(err => {
    console.error('Test failed:', err.message);
    process.exit(1);
  });
}

module.exports = {
  main
};
