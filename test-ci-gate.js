const fs = require('fs');
const path = require('path');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function readProjectFile(...parts) {
  return fs.readFileSync(path.join(__dirname, ...parts), 'utf8');
}

function main() {
  const gitignore = readProjectFile('.gitignore');
  const ignoredLines = gitignore
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'));

  assert(
    !ignoredLines.includes('package-lock.json'),
    'package-lock.json should be tracked for reproducible CI installs'
  );
  assert(fs.existsSync(path.join(__dirname, 'package-lock.json')), 'package-lock.json should exist');

  const workflowPath = path.join(__dirname, '.github', 'workflows', 'ci.yml');
  assert(fs.existsSync(workflowPath), 'CI workflow should exist at .github\\workflows\\ci.yml');

  const workflow = fs.readFileSync(workflowPath, 'utf8');
  [
    'push:',
    'pull_request:',
    'workflow_dispatch:',
    'node-version: 22',
    'npm ci',
    'npm audit --audit-level=high',
    'node test-secret-scan.js',
    'npm run check',
    'node test-security-gateway.js',
    'node test-state-foreign-keys.js',
    'npm run test:release-core'
  ].forEach(requiredText => {
    assert(workflow.includes(requiredText), `CI workflow should include: ${requiredText}`);
  });

  console.log('CI gate tests passed');
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = {
  main
};
