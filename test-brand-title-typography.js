const fs = require('fs');
const path = require('path');
const assert = require('assert');

function getBlock(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`(^|\\n)${escaped}\\s*\\{([\\s\\S]*?)\\}`, 'm'));
  return match ? match[2] : '';
}

function main() {
  const css = fs.readFileSync(path.join(__dirname, 'public', 'css', 'style.css'), 'utf8');
  const logoBlock = getBlock(css, '.logo-text');
  const paperLogoBlock = getBlock(css, '[data-theme="paper"] .logo-text');

  assert.ok(logoBlock.includes('width: min-content;'), 'brand wordmark should wrap into a refined two-line mark');
  assert.ok(logoBlock.includes('max-width: 138px;'), 'brand wordmark should stay inside the sidebar');
  assert.ok(logoBlock.includes('font-size: clamp(1.1rem, 1.18vw, 1.26rem);'), 'brand wordmark should use a taller responsive size');
  assert.ok(logoBlock.includes('font-weight: 800;'), 'brand wordmark should use a stronger display weight');
  assert.ok(logoBlock.includes('line-height: 0.98;'), 'brand wordmark should use a compact upright line height');
  assert.ok(logoBlock.includes('letter-spacing: 0.018em;'), 'brand wordmark should use subtle positive tracking');
  assert.ok(logoBlock.includes('text-wrap: balance;'), 'brand wordmark should balance its two-line shape');
  assert.ok(paperLogoBlock.includes('#7b5a1d'), 'paper brand wordmark should use warm paper typography');
  assert.ok(paperLogoBlock.includes('#c79947'), 'paper brand wordmark should retain a refined warm accent');

  console.log('Brand title typography tests passed');
}

if (require.main === module) {
  main();
}

module.exports = { main };
