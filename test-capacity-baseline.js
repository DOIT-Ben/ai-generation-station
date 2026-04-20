const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const { once } = require('events');
const { performance } = require('perf_hooks');
const { createServer } = require('./server/index');
const { createConfig } = require('./server/config');

function parseArgs(argv) {
  const args = {
    port: 18820,
    outputDir: path.join(__dirname, 'test-artifacts', 'performance')
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--port' && argv[index + 1]) {
      args.port = Number(argv[index + 1]);
      index += 1;
    } else if (arg === '--output-dir' && argv[index + 1]) {
      args.outputDir = path.resolve(argv[index + 1]);
      index += 1;
    }
  }

  return args;
}

function percentile(sortedDurations, ratio) {
  if (!sortedDurations.length) return 0;
  const index = Math.min(sortedDurations.length - 1, Math.max(0, Math.ceil(sortedDurations.length * ratio) - 1));
  return Number(sortedDurations[index].toFixed(2));
}

function formatNumber(value) {
  return Number(Number(value || 0).toFixed(2));
}

function toObjectMap(map) {
  return Object.fromEntries(Array.from(map.entries()).sort((a, b) => String(a[0]).localeCompare(String(b[0]))));
}

function removeFileIfExists(filepath) {
  if (fs.existsSync(filepath)) {
    fs.unlinkSync(filepath);
  }
}

function makeRequest({ port, requestPath, method = 'GET', body = null, headers = {} }) {
  return new Promise((resolve, reject) => {
    const payload = body == null ? null : JSON.stringify(body);
    const requestHeaders = { ...headers };
    if (payload) {
      requestHeaders['Content-Type'] = requestHeaders['Content-Type'] || 'application/json';
      requestHeaders['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path: requestPath,
      method,
      headers: requestHeaders
    }, res => {
      let data = '';
      res.on('data', chunk => {
        data += chunk;
      });
      res.on('end', () => {
        let parsed = data;
        try {
          parsed = data ? JSON.parse(data) : null;
        } catch {
          parsed = data;
        }
        resolve({
          status: Number(res.statusCode || 0),
          headers: res.headers || {},
          data: parsed,
          rawBody: data
        });
      });
    });

    req.on('error', reject);
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

async function loginAndGetCookie(port, username, password) {
  const response = await makeRequest({
    port,
    requestPath: '/api/auth/login',
    method: 'POST',
    body: { username, password }
  });

  if (response.status !== 200) {
    throw new Error(`Login failed for ${username}: HTTP ${response.status}`);
  }

  const rawCookieHeader = response.headers['set-cookie'];
  const cookieHeader = Array.isArray(rawCookieHeader) ? rawCookieHeader[0] : rawCookieHeader;
  if (!cookieHeader) {
    throw new Error(`No session cookie returned for ${username}`);
  }
  return String(cookieHeader).split(';')[0];
}

async function withBenchmarkServer(port, fn) {
  const stateDb = path.join(os.tmpdir(), `aigs-capacity-${Date.now()}-${port}.sqlite`);
  const config = createConfig({
    env: {
      ...process.env,
      PORT: String(port),
      APP_STATE_DB: stateDb,
      APP_USERNAME: 'studio',
      APP_PASSWORD: 'AIGS2026!',
      LOGIN_RATE_LIMIT_MAX: '100000',
      LOGIN_RATE_LIMIT_WINDOW_MS: '60000',
      ADMIN_CREATE_USER_RATE_LIMIT_MAX: '100000',
      ADMIN_CREATE_USER_RATE_LIMIT_WINDOW_MS: '60000',
      ADMIN_PASSWORD_RESET_RATE_LIMIT_MAX: '100000',
      ADMIN_PASSWORD_RESET_RATE_LIMIT_WINDOW_MS: '60000'
    }
  });
  const server = createServer({ config });

  server.listen(port, '127.0.0.1');
  await once(server, 'listening');

  try {
    return await fn({ server, port, stateDb });
  } finally {
    await new Promise(resolve => server.close(resolve));
    server.appStateStore?.close?.();
    removeFileIfExists(stateDb);
    removeFileIfExists(`${stateDb}-shm`);
    removeFileIfExists(`${stateDb}-wal`);
  }
}

async function runLoadProfile({ name, concurrency, iterations, warmupIterations, requestFactory }) {
  for (let index = 0; index < warmupIterations; index += 1) {
    await requestFactory(index, true);
  }

  let nextIndex = 0;
  const durations = [];
  const statusCounts = new Map();
  const errorCounts = new Map();
  let successCount = 0;
  let failureCount = 0;
  const startedAt = performance.now();

  async function worker() {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      if (currentIndex >= iterations) {
        return;
      }

      const requestStartedAt = performance.now();
      try {
        const response = await requestFactory(currentIndex, false);
        const requestDuration = performance.now() - requestStartedAt;
        durations.push(requestDuration);
        statusCounts.set(response.status, (statusCounts.get(response.status) || 0) + 1);
        if (response.status >= 200 && response.status < 300) {
          successCount += 1;
        } else {
          failureCount += 1;
          const errorKey = `${response.status}:${response.data?.error || response.rawBody || 'unknown'}`;
          errorCounts.set(errorKey, (errorCounts.get(errorKey) || 0) + 1);
        }
      } catch (error) {
        const requestDuration = performance.now() - requestStartedAt;
        durations.push(requestDuration);
        failureCount += 1;
        const errorKey = `ERR:${error.message}`;
        errorCounts.set(errorKey, (errorCounts.get(errorKey) || 0) + 1);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  const completedAt = performance.now();
  const sortedDurations = durations.slice().sort((a, b) => a - b);
  const totalRequests = successCount + failureCount;
  const meanMs = sortedDurations.length
    ? sortedDurations.reduce((sum, value) => sum + value, 0) / sortedDurations.length
    : 0;

  return {
    name,
    concurrency,
    iterations,
    warmupIterations,
    totalRequests,
    successCount,
    failureCount,
    successRate: totalRequests ? formatNumber((successCount / totalRequests) * 100) : 0,
    throughputPerSecond: formatNumber(totalRequests / ((completedAt - startedAt) / 1000 || 1)),
    meanMs: formatNumber(meanMs),
    p50Ms: percentile(sortedDurations, 0.5),
    p95Ms: percentile(sortedDurations, 0.95),
    maxMs: formatNumber(sortedDurations[sortedDurations.length - 1] || 0),
    statusCounts: toObjectMap(statusCounts),
    errorCounts: toObjectMap(errorCounts)
  };
}

async function createScenarioDefinitions(port, server) {
  const historyUser = server.appStateStore.createUser({
    username: 'bench-history-user',
    password: 'BenchHistory2026!',
    displayName: 'Bench History User',
    role: 'user',
    planCode: 'free'
  });
  for (let index = 0; index < 20; index += 1) {
    server.appStateStore.appendHistory(historyUser.id, 'chat', {
      title: `History ${index + 1}`,
      summary: `Summary ${index + 1}`,
      timestamp: Date.now() + index,
      state: {
        messages: [{ role: 'user', content: `hello ${index + 1}` }]
      }
    });
  }

  const adminCookie = await loginAndGetCookie(port, 'studio', 'AIGS2026!');
  const historyCookie = await loginAndGetCookie(port, 'bench-history-user', 'BenchHistory2026!');

  return [
    {
      id: 'login',
      label: 'Login',
      requestFactory: index => makeRequest({
        port,
        requestPath: '/api/auth/login',
        method: 'POST',
        body: {
          username: 'studio',
          password: 'AIGS2026!'
        },
        headers: {
          'X-Benchmark-Request': `login-${index}`
        }
      })
    },
    {
      id: 'session',
      label: 'SessionCheck',
      requestFactory: index => makeRequest({
        port,
        requestPath: '/api/auth/session',
        method: 'GET',
        headers: {
          Cookie: adminCookie,
          'X-Benchmark-Request': `session-${index}`
        }
      })
    },
    {
      id: 'admin_create_user',
      label: 'AdminCreateUser',
      requestFactory: index => makeRequest({
        port,
        requestPath: '/api/admin/users',
        method: 'POST',
        body: {
          username: `bu${Date.now().toString(36)}${index.toString(36)}${Math.random().toString(36).slice(2, 6)}`,
          displayName: `Bench User ${index + 1}`,
          password: 'BenchUser2026!',
          role: 'user',
          planCode: 'free'
        },
        headers: {
          Cookie: adminCookie,
          'X-Benchmark-Request': `create-${index}`
        }
      })
    },
    {
      id: 'history_read',
      label: 'HistoryRead',
      requestFactory: index => makeRequest({
        port,
        requestPath: '/api/history/chat',
        method: 'GET',
        headers: {
          Cookie: historyCookie,
          'X-Benchmark-Request': `history-${index}`
        }
      })
    }
  ];
}

async function main() {
  const { port, outputDir } = parseArgs(process.argv.slice(2));
  const profiles = [
    { key: 'low', concurrency: 10, iterations: 50, warmupIterations: 5 },
    { key: 'medium', concurrency: 50, iterations: 150, warmupIterations: 10 }
  ];
  const report = {
    generatedAt: new Date().toISOString(),
    outputDir,
    profiles: {}
  };

  for (const profile of profiles) {
    report.profiles[profile.key] = {};
    await withBenchmarkServer(port + (profile.key === 'low' ? 0 : 1), async ({ server, port: activePort }) => {
      const scenarios = await createScenarioDefinitions(activePort, server);
      for (const scenario of scenarios) {
        const result = await runLoadProfile({
          name: scenario.label,
          concurrency: profile.concurrency,
          iterations: profile.iterations,
          warmupIterations: profile.warmupIterations,
          requestFactory: scenario.requestFactory
        });
        report.profiles[profile.key][scenario.id] = result;
      }
    });
  }

  fs.mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, `capacity-baseline-${Date.now()}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf8');

  console.log(`Capacity baseline artifact: ${outputPath}`);
  Object.entries(report.profiles).forEach(([profileKey, scenarios]) => {
    console.log(`\n[${profileKey}]`);
    Object.entries(scenarios).forEach(([scenarioKey, metrics]) => {
      console.log(
        `${scenarioKey}: success=${metrics.successRate}% mean=${metrics.meanMs}ms p95=${metrics.p95Ms}ms throughput=${metrics.throughputPerSecond}/s`
      );
    });
  });
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
