const fs = require('fs');
const path = require('path');
const assert = require('assert');

function getBlock(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`(^|\\n)${escaped}\\s*\\{([\\s\\S]*?)\\}`, 'm'));
  return match ? match[2] : '';
}

function main() {
  const html = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
  const siteShellJs = fs.readFileSync(path.join(__dirname, 'public', 'js', 'site-shell.js'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, 'public', 'css', 'style.css'), 'utf8');
  const logoBlock = getBlock(css, '.logo-text');
  const logoStrongBlock = getBlock(css, '.logo-text strong');
  const logoStationBlock = getBlock(css, '.logo-text span');
  const paperLogoBlock = getBlock(css, '[data-theme="paper"] .logo-text strong');
  const portalCopyBlock = getBlock(css, '.portal-brand-copy');
  const portalStationBlock = getBlock(css, '.portal-brand-copy span');

  assert.ok(html.includes('<strong>AI Generation</strong>'), 'workspace brand should expose AI Generation as the primary wordmark');
  assert.ok(html.includes('<span>Station</span>'), 'workspace brand should expose Station as a secondary brand tier');
  assert.ok(siteShellJs.includes('<span>Station</span>'), 'portal brand should use the same Station tier');
  assert.ok(!logoBlock.includes('width: min-content;'), 'brand wordmark should not be squeezed into min-content wrapping');
  assert.ok(logoBlock.includes('max-width: 172px;'), 'brand wordmark should have enough room for one-line display');
  assert.ok(logoBlock.includes('flex-direction: column;'), 'brand wordmark should use a refined two-tier lockup');
  assert.ok(logoStrongBlock.includes('font-size: 1.12rem;'), 'brand primary wordmark should use a stable desktop display size');
  assert.ok(logoStrongBlock.includes('font-weight: 850;'), 'brand primary wordmark should use a stronger display weight');
  assert.ok(logoStrongBlock.includes('line-height: 1.02;'), 'brand primary wordmark should avoid a loose stacked look');
  assert.ok(logoStationBlock.includes('letter-spacing: 0.18em;'), 'Station tier should use deliberate display tracking');
  assert.ok(logoStationBlock.includes('text-transform: uppercase;'), 'Station tier should read as a brand lockup');
  assert.ok(logoBlock.includes('white-space: nowrap;'), 'brand wordmark should stay on one line');
  assert.ok(!logoBlock.includes('text-wrap: balance;'), 'brand wordmark should not use two-line balancing');
  assert.ok(paperLogoBlock.includes('#7b5a1d'), 'paper brand wordmark should use warm paper typography');
  assert.ok(paperLogoBlock.includes('#c79947'), 'paper brand wordmark should retain a refined warm accent');
  assert.ok(portalCopyBlock.includes('font-family: var(--font-display);'), 'portal brand should share display typography');
  assert.ok(portalStationBlock.includes('letter-spacing: 0.16em;'), 'portal Station tier should keep a compact brand rhythm');

  console.log('Brand title typography tests passed');
}

if (require.main === module) {
  main();
}

module.exports = { main };
