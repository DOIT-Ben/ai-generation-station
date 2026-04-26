const fs = require('fs');
const path = require('path');

const CSS_MODULES = [
  'reset.css',
  'common.css',
  'index.css',
  'chat-message.css',
  'chat-workspace.css',
  'chat-dropdown.css',
  'workspace-responsive.css',
  'auth-gate.css',
  'templates.css',
  'admin.css',
  'portal.css',
  'auth.css',
  'portal-components.css',
  'account.css',
  'responsive.css'
];

function readProjectCss(rootDir = __dirname) {
  return CSS_MODULES
    .map(file => fs.readFileSync(path.join(rootDir, 'public', 'css', file), 'utf8'))
    .join('\n')
    .replace(/\r\n/g, '\n');
}

module.exports = {
  CSS_MODULES,
  readProjectCss
};
