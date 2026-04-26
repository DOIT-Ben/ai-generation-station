const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { readProjectCss } = require('./test-css-utils');

function getBlock(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`(^|\\n)${escaped}\\s*\\{([\\s\\S]*?)\\}`, 'm'));
  return match ? match[2] : '';
}

function main() {
  const html = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
  const siteShellJs = fs.readFileSync(path.join(__dirname, 'public', 'js', 'site-shell.js'), 'utf8');
  const css = readProjectCss(__dirname);
  const logoBlock = getBlock(css, '.logo-text');
  const logoStrongBlock = getBlock(css, '.logo-text strong');
  const logoGenerationBlock = getBlock(css, '.logo-text span');
  const logoStationBlock = getBlock(css, '.logo-text em');
  const paperLogoBlock = getBlock(css, '[data-theme="paper"] .logo-text strong');
  const portalCopyBlock = getBlock(css, '.portal-brand-copy');
  const portalStationBlock = getBlock(css, '.portal-brand-copy em');

  assert.ok(html.includes('<strong class="logo-ai-mark" aria-label="AI">AI</strong>'), 'workspace brand should expose AI as the compact primary wordmark');
  assert.ok(html.includes('logo-text-line logo-text-line--primary">Generation</span>'), 'workspace brand should expose Generation as the first right-side row');
  assert.ok(html.includes('logo-text-line logo-text-line--station">STATION</em>'), 'workspace brand should expose STATION as the second right-side row');
  assert.ok(siteShellJs.includes('<em>Station</em>'), 'portal brand should use the same Station tier');
  assert.ok(!logoBlock.includes('width: min-content;'), 'brand wordmark should not be squeezed into min-content wrapping');
  assert.ok(logoBlock.includes('max-width: 160px;'), 'brand wordmark should reserve more vertical brand presence without overflowing the sidebar');
  assert.ok(logoBlock.includes('flex-direction: column;'), 'brand wordmark should use a compact vertical lockup');
  assert.ok(logoStrongBlock.includes('font-size: 1.52rem;'), 'brand primary wordmark should scale up for a stronger logo presence');
  assert.ok(logoStrongBlock.includes('font-weight: 850;'), 'brand primary wordmark should use a stronger display weight');
  assert.ok(logoStrongBlock.includes('line-height: 1;'), 'brand primary wordmark should gain a taller silhouette without looking loose');
  assert.ok(logoGenerationBlock.includes('font-size: 1.04rem;'), 'Generation tier should scale up with the larger logo lockup');
  assert.ok(logoGenerationBlock.includes('letter-spacing: 0;'), 'Generation tier should avoid compressed tracking');
  assert.ok(logoStationBlock.includes('font-size: 1.02rem;'), 'Station tier should scale up with the larger logo lockup');
  assert.ok(logoStationBlock.includes('letter-spacing: 0.02em;'), 'Station tier should avoid compressed tracking');
  assert.ok(logoStationBlock.includes('text-transform: uppercase;'), 'Station tier should read as a brand lockup');
  assert.equal(logoBlock.includes('white-space: nowrap;'), false, 'compact stacked brand should no longer depend on nowrap');
  assert.ok(paperLogoBlock.includes('#7b5a1d'), 'paper brand wordmark should use warm paper typography');
  assert.ok(paperLogoBlock.includes('#c79947'), 'paper brand wordmark should retain a refined warm accent');
  assert.ok(portalCopyBlock.includes('font-family: var(--font-display);'), 'portal brand should share display typography');
  assert.ok(portalStationBlock.includes('letter-spacing: 0.24em;'), 'portal Station tier should keep a compact brand rhythm');

  console.log('Brand title typography tests passed');
}

if (require.main === module) {
  main();
}

module.exports = { main };

