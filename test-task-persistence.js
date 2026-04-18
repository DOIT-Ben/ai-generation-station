const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const { createServer } = require('./server/index');
const { createConfig } = require('./server/config');

function request(port, requestPath, method, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : '';
    const req = http.request({
      hostname: 'localhost',
      port,
      path: requestPath,
      method,
      headers: payload ? {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      } : {}
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let parsed = data;
        try {
          parsed = JSON.parse(data);
        } catch {}
        resolve({ status: res.statusCode, data: parsed });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function waitForServer(port, timeoutMs = 10000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const res = await request(port, '/', 'GET');
      if (res.status === 200) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error(`Server did not become ready on port ${port}`);
}

async function createRuntime(port, dbPath) {
  const server = createServer({
    config: createConfig({
      env: {
        ...process.env,
        PORT: String(port),
        APP_STATE_DB: dbPath,
        APP_USERNAME: 'studio',
        APP_PASSWORD: 'AIGS2026!'
      }
    })
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, resolve);
  });
  await waitForServer(port);
  return server;
}

async function closeRuntime(server) {
  await new Promise(resolve => server.close(resolve));
  server.appStateStore?.close?.();
}

async function removeWithRetry(filePath, attempts = 10) {
  for (let i = 0; i < attempts; i++) {
    if (!fs.existsSync(filePath)) return;
    try {
      fs.unlinkSync(filePath);
      return;
    } catch (error) {
      if (error.code !== 'EBUSY' && error.code !== 'EPERM') {
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  if (fs.existsSync(filePath)) {
    console.warn(`Warning: temp file not removed immediately: ${filePath}`);
  }
}

async function main() {
  const port = 18000 + Math.floor(Math.random() * 1000);
  const dbPath = path.join(os.tmpdir(), `aigs-task-${Date.now()}.sqlite`);
  let server = null;

  try {
    server = await createRuntime(port, dbPath);
    server.appStateStore.createTask({
      taskId: 'music_persisted_task',
      userId: null,
      feature: 'music',
      status: 'completed',
      progress: 100,
      inputPayload: { prompt: 'persist me' },
      outputPayload: { url: '/output/test.mp3', duration: 1234, size: 5678 }
    });
    await closeRuntime(server);
    server = null;

    server = await createRuntime(port, dbPath);
    const status = await request(port, '/api/music/status', 'POST', { taskId: 'music_persisted_task' });
    if (status.status !== 200) throw new Error(`Expected 200, got ${status.status}`);
    if (status.data.status !== 'completed') throw new Error(`Expected completed task, got ${status.data.status}`);
    if (status.data.url !== '/output/test.mp3') throw new Error('Expected persisted task url to survive restart');

    server.appStateStore.createTask({
      taskId: 'cover_interrupted_task',
      userId: null,
      feature: 'cover',
      status: 'processing',
      progress: 32,
      inputPayload: { prompt: 'in flight' },
      outputPayload: {}
    });
    await closeRuntime(server);
    server = null;

    server = await createRuntime(port, dbPath);
    const interrupted = await request(port, '/api/music-cover/status', 'POST', { taskId: 'cover_interrupted_task' });
    if (interrupted.status !== 200) throw new Error(`Expected 200, got ${interrupted.status}`);
    if (interrupted.data.status !== 'error') throw new Error(`Expected interrupted task to become error, got ${interrupted.data.status}`);

    console.log('✅ Task persistence tests passed');
  } finally {
    if (server) {
      await closeRuntime(server).catch(() => {});
    }
    for (const file of [dbPath, `${dbPath}-shm`, `${dbPath}-wal`]) {
      await removeWithRetry(file);
    }
  }
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
