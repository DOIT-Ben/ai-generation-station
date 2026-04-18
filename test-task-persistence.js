const fs = require('fs');
const path = require('path');
const os = require('os');
const { createServer } = require('./server/index');
const { createConfig } = require('./server/config');
const { dispatchRequest } = require('./test-live-utils');

function request(server, requestPath, method, body) {
  return dispatchRequest(server, requestPath, method, body);
}

function createRuntime(dbPath) {
  return createServer({
    config: createConfig({
      env: {
        ...process.env,
        PORT: '18797',
        APP_STATE_DB: dbPath,
        APP_USERNAME: 'studio',
        APP_PASSWORD: 'AIGS2026!'
      }
    })
  });
}

async function closeRuntime(server) {
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
  const dbPath = path.join(os.tmpdir(), `aigs-task-${Date.now()}.sqlite`);
  let server = null;

  try {
    server = createRuntime(dbPath);
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

    server = createRuntime(dbPath);
    const status = await request(server, '/api/music/status', 'POST', { taskId: 'music_persisted_task' });
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

    server = createRuntime(dbPath);
    const interrupted = await request(server, '/api/music-cover/status', 'POST', { taskId: 'cover_interrupted_task' });
    if (interrupted.status !== 200) throw new Error(`Expected 200, got ${interrupted.status}`);
    if (interrupted.data.status !== 'error') {
      throw new Error(`Expected interrupted task to become error, got ${interrupted.data.status}`);
    }

    console.log('Task persistence tests passed');
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
