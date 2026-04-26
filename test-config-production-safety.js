const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { createConfig } = require('./server/config');

function makeEnv(overrides = {}) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aigs-config-safety-'));
  return {
    env: {
      PORT: '18818',
      APP_STATE_DB: path.join(tempRoot, 'app-state.sqlite'),
      OUTPUT_DIR: path.join(tempRoot, 'output'),
      MINIMAX_API_KEY: '',
      CHAT_API_KEY: '',
      ...overrides
    },
    tempRoot
  };
}

function cleanup(tempRoot) {
  if (tempRoot) fs.rmSync(tempRoot, { recursive: true, force: true });
}

function assertConfigThrows(overrides, expectedPattern) {
  const { env, tempRoot } = makeEnv(overrides);
  try {
    assert.throws(() => createConfig({ env }), expectedPattern);
  } finally {
    cleanup(tempRoot);
  }
}

function assertConfigPasses(overrides) {
  const { env, tempRoot } = makeEnv(overrides);
  try {
    return createConfig({ env });
  } finally {
    cleanup(tempRoot);
  }
}

function main() {
  assertConfigThrows({
    NODE_ENV: 'production',
    APP_USERNAME: 'studio',
    APP_PASSWORD: 'AIGS2026!',
    CSRF_SECRET: 'production-csrf-secret'
  }, /APP_PASSWORD/);

  assertConfigThrows({
    NODE_ENV: 'production',
    APP_USERNAME: 'studio',
    APP_PASSWORD: 'ProdSafePassword2026!'
  }, /CSRF_SECRET/);

  const productionConfig = assertConfigPasses({
    NODE_ENV: 'production',
    APP_USERNAME: 'studio',
    APP_PASSWORD: 'ProdSafePassword2026!',
    CSRF_SECRET: 'production-csrf-secret'
  });
  assert.strictEqual(productionConfig.APP_PASSWORD, 'ProdSafePassword2026!');
  assert.strictEqual(productionConfig.CSRF_SECRET, 'production-csrf-secret');

  const developmentConfig = assertConfigPasses({
    NODE_ENV: 'development'
  });
  assert.strictEqual(developmentConfig.APP_PASSWORD, 'AIGS2026!');
  assert.strictEqual(developmentConfig.BIND_HOST, '127.0.0.1');

  const explicitBindHostConfig = assertConfigPasses({
    NODE_ENV: 'development',
    BIND_HOST: '0.0.0.0'
  });
  assert.strictEqual(explicitBindHostConfig.BIND_HOST, '0.0.0.0');

  const envExample = fs.readFileSync(path.join(__dirname, '.env.example'), 'utf8');
  assert.ok(envExample.includes('CSRF_SECRET='), '.env.example should document CSRF_SECRET');
  assert.ok(envExample.includes('APP_PASSWORD='), '.env.example should document APP_PASSWORD');
  assert.ok(envExample.includes('BIND_HOST=127.0.0.1'), '.env.example should document loopback BIND_HOST');

  console.log('Production config safety tests passed');
}

if (require.main === module) {
  main();
}

module.exports = {
  main
};
