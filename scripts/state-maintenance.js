const fs = require('fs');
const path = require('path');
const { createConfig } = require('../server/config');
const { createStateStore } = require('../server/state-store');

function getSeedUser(config) {
  return {
    username: config.APP_USERNAME,
    password: config.APP_PASSWORD,
    displayName: 'Studio Admin',
    role: 'admin',
    planCode: 'internal'
  };
}

function getExcludedOutputEntries() {
  return ['runtime'];
}

function getStateMaintenanceConfig(options = {}) {
  const config = options.config || createConfig(options);
  return {
    repoRoot: config.ROOT_DIR,
    dataDir: config.DATA_DIR,
    outputDir: config.OUTPUT_DIR,
    appStateDb: config.APP_STATE_DB,
    legacyStateFile: config.LEGACY_STATE_FILE,
    backupDir: config.STATE_BACKUP_DIR,
    auditLogRetentionDays: config.AUDIT_LOG_RETENTION_DAYS,
    backupRetentionDays: config.STATE_BACKUP_RETENTION_DAYS,
    excludedOutputEntries: getExcludedOutputEntries()
  };
}

function listOutputEntries(config) {
  if (!fs.existsSync(config.OUTPUT_DIR)) {
    return [];
  }

  return fs.readdirSync(config.OUTPUT_DIR, { withFileTypes: true })
    .filter(entry => !getExcludedOutputEntries().includes(entry.name))
    .map(entry => ({
      name: entry.name,
      isDirectory: entry.isDirectory()
    }));
}

function listBackupEntries(config) {
  if (!fs.existsSync(config.STATE_BACKUP_DIR)) {
    return [];
  }

  return fs.readdirSync(config.STATE_BACKUP_DIR, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => ({
      name: entry.name,
      fullPath: path.join(config.STATE_BACKUP_DIR, entry.name)
    }));
}

function summarizeFilesystem(config) {
  const dbPath = config.APP_STATE_DB;
  const fileSummary = targetPath => {
    if (!fs.existsSync(targetPath)) {
      return {
        path: targetPath,
        exists: false,
        sizeBytes: 0
      };
    }

    const stat = fs.statSync(targetPath);
    return {
      path: targetPath,
      exists: true,
      sizeBytes: stat.size
    };
  };

  return {
    appStateDb: fileSummary(dbPath),
    appStateDbWal: fileSummary(`${dbPath}-wal`),
    appStateDbShm: fileSummary(`${dbPath}-shm`),
    outputEntryCount: listOutputEntries(config).length,
    backupEntryCount: listBackupEntries(config).length
  };
}

function withStateStore(options, work) {
  const config = options.config || createConfig(options);
  const stateStore = createStateStore({
    dbPath: config.APP_STATE_DB,
    legacyFilePath: config.LEGACY_STATE_FILE,
    sessionTtlMs: config.SESSION_TTL_MS,
    maxHistoryItems: config.MAX_HISTORY_ITEMS,
    seedUser: getSeedUser(config)
  });

  try {
    return work(stateStore, config);
  } finally {
    stateStore.close();
  }
}

function getStateMaintenanceSummary(options = {}) {
  return withStateStore(options, (stateStore, config) => ({
    config: getStateMaintenanceConfig({ config }),
    state: stateStore.getMaintenanceSummary({ now: options.now || Date.now() }),
    filesystem: summarizeFilesystem(config)
  }));
}

function pruneAuditLogsMaintenance(options = {}) {
  return withStateStore(options, (stateStore, config) => {
    const olderThanDays = Number(options.olderThanDays || config.AUDIT_LOG_RETENTION_DAYS);
    const result = stateStore.pruneAuditLogs({
      olderThanDays,
      now: options.now || Date.now()
    });
    return {
      ...result,
      config: getStateMaintenanceConfig({ config }),
      state: stateStore.getMaintenanceSummary({ now: options.now || Date.now() })
    };
  });
}

function parseArgs(argv) {
  const result = {
    command: 'summary',
    json: false,
    olderThanDays: null
  };

  const args = Array.isArray(argv) ? argv.slice() : [];
  if (args[0] && !args[0].startsWith('--')) {
    result.command = args.shift();
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--json') {
      result.json = true;
    } else if (arg === '--older-than-days' && args[index + 1]) {
      result.olderThanDays = Number(args[index + 1]);
      index += 1;
    }
  }

  return result;
}

function formatResult(command, payload) {
  if (command === 'config') {
    return [
      `Repo root: ${payload.repoRoot}`,
      `State DB: ${payload.appStateDb}`,
      `Output dir: ${payload.outputDir}`,
      `Backup dir: ${payload.backupDir}`,
      `Audit-log retention days: ${payload.auditLogRetentionDays}`,
      `Backup retention days: ${payload.backupRetentionDays}`,
      `Excluded output entries: ${payload.excludedOutputEntries.join(', ')}`
    ].join('\n');
  }

  if (command === 'prune-audit-logs') {
    return [
      `Audit logs pruned: ${payload.deletedCount}`,
      `Retention days: ${payload.olderThanDays}`,
      `Cutoff: ${new Date(payload.cutoff).toISOString()}`,
      `Remaining audit logs: ${payload.state.auditLogs.total}`
    ].join('\n');
  }

  return [
    `Users: ${payload.state.users}`,
    `Sessions: total=${payload.state.sessions.total} active=${payload.state.sessions.active}`,
    `Auth tokens: total=${payload.state.authTokens.total} active=${payload.state.authTokens.active}`,
    `Rate-limit events: ${payload.state.rateLimitEvents}`,
    `History entries: ${payload.state.historyEntries}`,
    `Tasks: ${payload.state.tasks}`,
    `Audit logs: ${payload.state.auditLogs.total}`,
    `State DB exists: ${payload.filesystem.appStateDb.exists}`,
    `Output entries: ${payload.filesystem.outputEntryCount}`,
    `Backup entries: ${payload.filesystem.backupEntryCount}`
  ].join('\n');
}

async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  let payload;

  switch (args.command) {
    case 'config':
      payload = getStateMaintenanceConfig();
      break;
    case 'summary':
      payload = getStateMaintenanceSummary();
      break;
    case 'prune-audit-logs':
      payload = pruneAuditLogsMaintenance({ olderThanDays: args.olderThanDays });
      break;
    default:
      throw new Error(`Unknown state-maintenance command: ${args.command}`);
  }

  if (args.json) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log(formatResult(args.command, payload));
}

if (require.main === module) {
  main().catch(error => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = {
  getStateMaintenanceConfig,
  getStateMaintenanceSummary,
  pruneAuditLogsMaintenance,
  main
};
