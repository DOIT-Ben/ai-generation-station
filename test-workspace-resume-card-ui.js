const assert = require('assert');
const fs = require('fs');
const path = require('path');

function main() {
  const html = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
  const appJs = fs.readFileSync(path.join(__dirname, 'public', 'js', 'app.js'), 'utf8');

  assert.equal(html.includes('id="workspace-resume-card"'), false, 'workspace resume card markup should be removed from the workspace template');
  assert.equal(html.includes('id="workspace-clear-draft"'), false, 'workspace clear-draft action should be removed with the retired resume card');
  assert.equal(html.includes('id="workspace-asset-strip"'), false, 'workspace asset strip markup should be removed from the workspace template');
  assert.equal(
    appJs.includes('renderWorkspaceAssetStrip'),
    false,
    'workspace asset strip helper and its calls should be fully removed after the strip is retired'
  );
  assert.equal(
    appJs.includes('renderWorkspaceResumeCard'),
    false,
    'workspace resume card render helper should be removed after the shell is deleted'
  );

  console.log('Workspace resume card UI tests passed');
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
