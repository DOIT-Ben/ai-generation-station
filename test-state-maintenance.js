const fs = require('fs');
const os = require('os');
const path = require('path');
const { createStateStore } = require('./server/state-store');
const {
  getStateMaintenanceConfig,
  getStateMaintenanceSummary,
  pruneAuditLogsMaintenance
} = require('./scripts/state-maintenance');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function createTempPaths() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aigs-state-maintenance-'));
  return {
    tempRoot,
    dbPath: path.join(tempRoot, 'app-state.sqlite'),
    legacyPath: path.join(tempRoot, 'app-state.json'),
    outputDir: path.join(tempRoot, 'output'),
    backupDir: path.join(tempRoot, 'backups')
  };
}

function cleanupTempPaths(paths) {
  if (!paths) return;
  fs.rmSync(paths.tempRoot, { recursive: true, force: true });
}

function createTestStore(paths) {
  fs.mkdirSync(paths.outputDir, { recursive: true });
  fs.mkdirSync(paths.backupDir, { recursive: true });
  fs.writeFileSync(paths.legacyPath, JSON.stringify({ sessions: {}, history: {} }, null, 2));
  return createStateStore({
    dbPath: paths.dbPath,
    legacyFilePath: paths.legacyPath,
    sessionTtlMs: 7 * 24 * 60 * 60 * 1000,
    maxHistoryItems: 12,
    seedUser: {
      username: 'studio',
      password: 'AIGS2026!',
      displayName: 'Studio Admin',
      role: 'admin',
      planCode: 'internal'
    }
  });
}

function testStateStoreMaintenanceSummaryAndPrune() {
  const paths = createTempPaths();
  const stateStore = createTestStore(paths);

  try {
    const user = stateStore.createUser({
      username: 'member',
      password: 'Member2026!',
      displayName: 'Member',
      role: 'user',
      planCode: 'free'
    });

    stateStore.appendAuditLog({
      action: 'old_event',
      actorUserId: user.id,
      actorUsername: user.username,
      createdAt: Date.now() - (120 * 24 * 60 * 60 * 1000)
    });
    stateStore.appendAuditLog({
      action: 'recent_event',
      actorUserId: user.id,
      actorUsername: user.username,
      createdAt: Date.now() - (10 * 24 * 60 * 60 * 1000)
    });

    const summaryBefore = stateStore.getMaintenanceSummary();
    assert(summaryBefore.users >= 2, 'expected maintenance summary to include seeded and created users');
    assert(summaryBefore.auditLogs.total === 2, 'expected two audit logs before prune');

    const pruneResult = stateStore.pruneAuditLogs({ olderThanDays: 90 });
    assert(pruneResult.deletedCount === 1, 'expected one old audit log to be pruned');

    const summaryAfter = stateStore.getMaintenanceSummary();
    assert(summaryAfter.auditLogs.total === 1, 'expected one audit log to remain after prune');
  } finally {
    stateStore.close();
    cleanupTempPaths(paths);
  }
}

function testScriptMaintenanceHelpers() {
  const paths = createTempPaths();
  fs.mkdirSync(paths.outputDir, { recursive: true });
  fs.mkdirSync(paths.backupDir, { recursive: true });
  fs.writeFileSync(path.join(paths.outputDir, 'music.mp3'), 'demo');

  const env = {
    ...process.env,
    APP_STATE_DB: paths.dbPath,
    APP_STATE_FILE: paths.legacyPath,
    OUTPUT_DIR: paths.outputDir,
    STATE_BACKUP_DIR: paths.backupDir,
    APP_USERNAME: 'studio',
    APP_PASSWORD: 'AIGS2026!'
  };

  try {
    const config = getStateMaintenanceConfig({ env });
    assert(config.appStateDb === paths.dbPath, 'expected config helper to resolve custom DB path');
    assert(config.backupDir === paths.backupDir, 'expected config helper to resolve custom backup dir');

    const summary = getStateMaintenanceSummary({ env });
    assert(summary.filesystem.outputEntryCount === 1, 'expected summary helper to count non-runtime output entries');

    const prune = pruneAuditLogsMaintenance({ env, olderThanDays: 90 });
    assert(prune.deletedCount === 0, 'expected prune helper to be safe when there are no audit logs');
  } finally {
    cleanupTempPaths(paths);
  }
}

function main() {
  testStateStoreMaintenanceSummaryAndPrune();
  testScriptMaintenanceHelpers();
  console.log('State maintenance tests passed');
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
