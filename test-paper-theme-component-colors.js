const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { readProjectCss } = require('./test-css-utils');

function readCss() {
  return readProjectCss(__dirname);
}

function getBlock(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`(^|\\n)${escaped}\\s*\\{([\\s\\S]*?)\\}`, 'm'));
  return match ? match[2] : '';
}

function assertBlockContains(css, selector, expected, message) {
  const block = getBlock(css, selector);
  assert.ok(block, `${selector} block should exist`);
  assert.ok(block.includes(expected), message || `${selector} should include ${expected}`);
}

function main() {
  const css = readCss();

  assertBlockContains(
    css,
    '[data-theme="paper"] .template-recent-strip,\n[data-theme="paper"] .template-category,\n[data-theme="paper"] .template-item',
    'rgba(255, 251, 241, 0.94)',
    'paper template cards should use warm paper surfaces'
  );
  assertBlockContains(
    css,
    '[data-theme="paper"] .template-recent-chip,\n[data-theme="paper"] .template-item button,\n[data-theme="paper"] .template-favorite-btn,\n[data-theme="paper"] .template-save-btn',
    'rgba(199, 153, 71, 0.2)',
    'paper template buttons should use warm gold borders instead of cyan'
  );
  assertBlockContains(
    css,
    '[data-theme="paper"] .btn-secondary,\n[data-theme="paper"] .portal-nav-link,\n[data-theme="paper"] .portal-nav-button,\n[data-theme="paper"] .portal-nav-toggle,\n[data-theme="paper"] .auth-route-links a,\n[data-theme="paper"] .admin-user-actions button,\n[data-theme="paper"] .audit-filter-preset,\n[data-theme="paper"] .audit-filter-chip,\n[data-theme="paper"] .history-actions button',
    'rgba(255, 249, 236, 0.82)',
    'paper secondary and portal buttons should use warm paper backgrounds'
  );
  assertBlockContains(
    css,
    '[data-theme="paper"] .admin-form input,\n[data-theme="paper"] .admin-form select,\n[data-theme="paper"] .admin-user-search',
    'rgba(255, 250, 239, 0.9)',
    'paper admin inputs should use warm input backgrounds'
  );
  assertBlockContains(
    css,
    '[data-theme="paper"] .audit-log-table-wrap',
    'rgba(255, 251, 241, 0.94)',
    'paper audit table should not keep a dark background'
  );
  assertBlockContains(
    css,
    '[data-theme="paper"] .audit-log-details pre',
    'rgba(255, 249, 236, 0.86)',
    'paper audit details should use a light paper code background'
  );

  console.log('Paper theme component color tests passed');
}

if (require.main === module) {
  main();
}

module.exports = { main };

