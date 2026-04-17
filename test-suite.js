const http = require('http');

function request(path, method, body, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('TIMEOUT')), timeout);
    const data = body ? JSON.stringify(body) : '';
    const req = http.request({ hostname: 'localhost', port: 3001, path, method, headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } }, res => {
      clearTimeout(timer);
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(d) }); }
        catch(e) { resolve({ status: res.statusCode, data: d }); }
      });
    });
    req.on('error', (e) => { clearTimeout(timer); reject(e); });
    if (data) req.write(data);
    req.end();
  });
}

async function runTests() {
  console.log('=== Boundary Condition Tests ===\n');
  
  // 1. 超长输入测试
  console.log('1. 超长输入测试 (10000 chars)');
  try {
    const longText = 'a'.repeat(10000);
    const res = await request('/api/chat', 'POST', { messages: [{ role: 'user', content: longText }] }, 10000);
    console.log(res.status === 200 ? '✅ 超长输入已处理' : '❌ 失败', '-', res.data.error || 'OK');
  } catch(e) { console.log('❌ 异常:', e.message); }
  
  // 2. 特殊字符测试
  console.log('\n2. 特殊字符测试 (XSS injection)');
  try {
    const specialChars = '<script>alert(1)</script>\n\t\r"\'';
    const res = await request('/api/chat', 'POST', { messages: [{ role: 'user', content: specialChars }] }, 10000);
    console.log(res.status === 200 ? '✅ 特殊字符已处理' : '❌ 失败');
  } catch(e) { console.log('❌ 异常:', e.message); }
  
  // 3. 并发请求测试
  console.log('\n3. 并发请求测试 (5 concurrent)');
  const promises = [];
  for (let i = 0; i < 5; i++) {
    promises.push(request('/api/config', 'GET').catch(e => ({ error: e.message })));
  }
  const results = await Promise.all(promises);
  const success = results.filter(r => r.status === 200).length;
  console.log(success === 5 ? '✅ 并发正常' : '⚠️ 并发问题:', success, '/5');
  
  // 4. 快速连续请求测试
  console.log('\n4. 快速连续请求 (10 rapid requests)');
  let rapidSuccess = 0;
  for (let i = 0; i < 10; i++) {
    try {
      const r = await request('/api/config', 'GET');
      if (r.status === 200) rapidSuccess++;
    } catch(e) {}
  }
  console.log(rapidSuccess === 10 ? '✅ 快速请求正常' : '⚠️ 快速请求问题:', rapidSuccess, '/10');
  
  // 5. 无效路径测试
  console.log('\n5. 无效路径测试');
  try {
    const res = await request('/api/nonexistent', 'GET');
    console.log(res.status === 404 ? '✅ 404处理正常' : '⚠️ 返回:', res.status);
  } catch(e) { console.log('❌ 异常:', e.message); }
  
  // 6. 非法方法测试
  console.log('\n6. 非法方法测试 (DELETE /api/config)');
  try {
    const res = await request('/api/config', 'DELETE');
    console.log('⚠️ DELETE返回:', res.status, res.data.error || '');
  } catch(e) { console.log('❌ 异常:', e.message); }
  
  // 7. 超时测试
  console.log('\n7. 超时测试 (1ms timeout)');
  try {
    await request('/api/chat', 'POST', { messages: [{ role: 'user', content: 'test' }] }, 1);
    console.log('❌ 未触发超时');
  } catch(e) {
    console.log(e.message === 'TIMEOUT' ? '✅ 超时机制正常' : '❌ 异常:', e.message);
  }
  
  // 8. 频率限制测试 (快速连续生图)
  console.log('\n8. 频率限制测试 (3 rapid cover requests)');
  for (let i = 0; i < 3; i++) {
    try {
      const r = await request('/api/generate/cover', 'POST', { prompt: 'test' + i, ratio: '1:1' }, 15000);
      console.log('  Request', i+1, ':', r.data.success ? '✅' : '❌', r.data.error || 'OK');
    } catch(e) { console.log('  Request', i+1, ':', '❌', e.message); }
  }
  
  console.log('\n=== Tests Complete ===');
}

runTests();
