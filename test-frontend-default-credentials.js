const assert = require('assert');
const fs = require('fs');
const path = require('path');
const AppShell = require('./public/js/app-shell.js');

function main() {
  const appShellSource = fs.readFileSync(path.join(__dirname, 'public', 'js', 'app-shell.js'), 'utf8');

  assert.equal(
    appShellSource.includes('AIGS2026!'),
    false,
    'front-end bundle should not contain the default backend password'
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(AppShell, 'AUTH'),
    false,
    'front-end shell should not export local default credentials'
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(AppShell, 'authenticate'),
    false,
    'front-end shell should not expose local fixed-credential authentication'
  );
  assert.equal(typeof AppShell.createRemotePersistence, 'function', 'remote authentication persistence should remain available');

  console.log('Frontend default credential tests passed');
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
