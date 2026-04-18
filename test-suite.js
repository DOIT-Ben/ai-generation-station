const { makeRequest } = require('./test-live-utils');

function request(path, method, body, timeout = 5000, options = {}) {
  return Promise.race([
    makeRequest(path, method, body, options),
    new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), timeout))
  ]);
}

async function runTests() {
  console.log('=== Smoke Tests ===\n');
  let failures = 0;
  const fail = () => { failures += 1; };
  
  // 1. 首页可达
  console.log('1. 首页访问');
  try {
    const res = await request('/', 'GET');
    if (res.status === 200 && String(res.data).includes('<!DOCTYPE html>')) {
      console.log('✅ 首页正常');
    } else {
      console.log('❌ 首页异常');
      fail();
    }
  } catch(e) { console.log('❌ 异常:', e.message); fail(); }
  
  // 2. 本地接口
  console.log('\n2. 音色接口');
  try {
    const res = await request('/api/voices', 'GET');
    if (res.status === 200 && Array.isArray(res.data.voices)) {
      console.log('✅ 音色列表正常');
    } else {
      console.log('❌ 音色列表异常');
      fail();
    }
  } catch(e) { console.log('❌ 异常:', e.message); fail(); }
  
  // 3. 输入校验
  console.log('\n3. 聊天接口参数校验');
  try {
    const res = await request('/api/chat', 'POST', {});
    if (res.status === 200 && res.data.error) {
      console.log('✅ 参数校验正常');
    } else {
      console.log('❌ 参数校验异常');
      fail();
    }
  } catch(e) { console.log('❌ 异常:', e.message); fail(); }
  
  // 4. 任务状态校验
  console.log('\n4. 任务状态参数校验');
  try {
    const res = await request('/api/music/status', 'POST', {});
    if (res.status === 200 && res.data.error) {
      console.log('✅ 状态校验正常');
    } else {
      console.log('❌ 状态校验异常');
      fail();
    }
  } catch(e) { console.log('❌ 异常:', e.message); fail(); }
  
  // 5. 无效路径测试
  console.log('\n5. 无效路径测试');
  try {
    const res = await request('/api/nonexistent', 'GET');
    if (res.status === 404) {
      console.log('✅ 404处理正常', res.status);
    } else {
      console.log('❌ 返回:', res.status);
      fail();
    }
  } catch(e) { console.log('❌ 异常:', e.message); fail(); }
  
  // 6. 非法方法测试
  console.log('\n6. 非法方法测试 (DELETE /api/files)');
  try {
    const res = await request('/api/files', 'DELETE');
    if (res.status === 405) {
      console.log('✅ 405 正常');
    } else {
      console.log(`❌ 返回: ${res.status}`);
      fail();
    }
  } catch(e) { console.log('❌ 异常:', e.message); fail(); }
  
  // 7. 上传参数校验
  console.log('\n7. 上传参数校验');
  try {
    const res = await request('/api/upload', 'POST', {});
    if (res.status === 200 && res.data.error) {
      console.log('✅ 上传校验正常');
    } else {
      console.log('❌ 上传校验异常');
      fail();
    }
  } catch(e) { console.log('❌ 异常:', e.message); fail(); }
  
  // 8. 输出文件列表
  console.log('\n8. 输出文件列表');
  try {
    const res = await request('/api/files', 'GET');
    if (res.status === 200 && Array.isArray(res.data.files)) {
      console.log('✅ 文件列表正常');
    } else {
      console.log('❌ 文件列表异常');
      fail();
    }
  } catch(e) { console.log('❌ 异常:', e.message); fail(); }

  // 9. JSON 错误处理
  console.log('\n9. 非法 JSON 测试');
  for (let i = 0; i < 3; i++) {
    if (i > 0) break;
    const bad = await new Promise((resolve, reject) => {
      request('/api/chat', 'POST', '{bad json', 5000, {
        raw: true,
        headers: {
          'Content-Type': 'application/json'
        }
      }).then(result => resolve({ status: result.status, body: result.rawBody })).catch(reject);
    });
    if (bad.status === 400) {
      console.log('✅ 非法 JSON 已拦截');
    } else {
      console.log(`❌ 返回: ${bad.status}`);
      fail();
    }
  }
  
  console.log('\n=== Tests Complete ===');
  if (failures > 0) {
    throw new Error(`Smoke tests failed: ${failures}`);
  }
  return { passed: true, failures: 0 };
}

async function main() {
  return runTests();
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
