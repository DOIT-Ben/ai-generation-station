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
  const logoStrongBlock = getBlock(css, '.logo-ai-mark');
  const logoGenerationBlock = getBlock(css, '.logo-text span');
  const logoStationBlock = getBlock(css, '.logo-text em');
  const paperLogoBlock = getBlock(css, '[data-theme="paper"] .logo-text');
  const portalCopyBlock = getBlock(css, '.portal-brand-copy');
  const portalStationBlock = getBlock(css, '.portal-brand-copy em');

  assert.ok(html.includes('<span class="logo-icon" aria-hidden="true">'), 'workspace brand should render the AG logo container on the left');
  assert.ok(html.includes('<img src="/images/AG-logo.png" alt="" />'), 'workspace brand should load the published AG logo asset');
  assert.ok(html.includes('class="logo-ai-mark logo-text-line logo-text-line--ai">AI</strong>'), 'workspace brand should expose AI as the first stacked title line');
  assert.ok(html.includes('logo-text-line logo-text-line--primary">Generation</span>'), 'workspace brand should expose Generation as the second stacked line');
  assert.ok(html.includes('logo-text-line logo-text-line--station">Station</em>'), 'workspace brand should expose Station as the third stacked line');
  assert.ok(siteShellJs.includes('class="portal-brand-mark" src="/images/AG-logo.png"'), 'portal brand should reuse the AG logo asset');
  assert.ok(siteShellJs.includes('<em>Station</em>'), 'portal brand should keep the Station tier');
  assert.ok(!logoBlock.includes('width: min-content;'), 'brand wordmark should not be squeezed into min-content wrapping');
  assert.ok(logoBlock.includes('max-width: 160px;'), 'brand wordmark should reserve enough width inside the sidebar');
  assert.ok(logoBlock.includes('flex-direction: column;'), 'brand wordmark should use a stacked lockup');
  assert.ok(logoBlock.includes('var(--glow-cyan)'), 'brand shadow should follow the active theme glow tokens');
  assert.ok(logoStrongBlock.includes('font-size: 1.4rem;'), 'AI title line should use the updated display size');
  assert.ok(logoStrongBlock.includes('font-weight: 800;'), 'AI title line should use a strong display weight');
  assert.ok(logoStrongBlock.includes('var(--accent-cyan)'), 'AI title line should derive color from theme accent tokens');
  assert.ok(logoGenerationBlock.includes('color: var(--fg-primary);'), 'Generation tier should follow theme primary text color');
  assert.ok(logoGenerationBlock.includes('font-size: 1.04rem;'), 'Generation tier should keep the tuned display size');
  assert.ok(logoStationBlock.includes('color: var(--fg-secondary);'), 'Station tier should follow theme secondary text color');
  assert.ok(logoStationBlock.includes('letter-spacing: 0.14em;'), 'Station tier should keep compact uppercase tracking');
  assert.ok(logoStationBlock.includes('text-transform: uppercase;'), 'Station tier should read as a brand lockup');
  assert.equal(logoBlock.includes('white-space: nowrap;'), false, 'stacked brand container should not depend on nowrap');
  assert.ok(paperLogoBlock.includes('rgba(94, 71, 29, 0.1)'), 'paper theme should override the brand shadow with warm paper tone');
  assert.ok(portalCopyBlock.includes('font-family: var(--font-display);'), 'portal brand should share display typography');
  assert.ok(portalStationBlock.includes('color: var(--fg-secondary);'), 'portal Station tier should follow theme secondary text color');
  assert.ok(portalStationBlock.includes('letter-spacing: 0.18em;'), 'portal Station tier should keep a compact brand rhythm');

  console.log('Brand title typography tests passed');
}

if (require.main === module) {
  main();
}

module.exports = { main };

