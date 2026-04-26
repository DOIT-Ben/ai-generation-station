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
  const css = readProjectCss(__dirname);

  const selectBlock = getBlock(css, '.chat-model-select');
  const triggerBlock = getBlock(css, '.custom-dropdown .dropdown-trigger');
  const menuBlock = getBlock(css, '.custom-dropdown .dropdown-menu');
  const optionBlock = getBlock(css, '.dropdown-option');
  const paperMenuBlock = getBlock(css, '[data-theme="paper"] .custom-dropdown .dropdown-menu');
  const paperHintBlock = getBlock(css, '[data-theme="paper"] .dropdown-scroll-hint');
  const mediumViewportBlock = css.match(/@media \(max-width: 1365px\) and \(min-width: 1024px\) \{([\s\S]*?)\n\}/m)?.[1] || '';
  const mobileBlock = css.match(/@media \(max-width: 767px\) \{([\s\S]*?)\n\}/m)?.[1] || '';

  assert.ok(selectBlock.includes('width: clamp(196px, 16.8vw, 252px);'), 'chat model select should expose the shortened bounded width contract');
  assert.ok(selectBlock.includes('max-width: min(100%, 252px);'), 'chat model select should keep the shortened max-width cap');
  assert.ok(selectBlock.includes('min-width: min(196px, calc(100vw - 48px));'), 'chat model select should shrink safely under tight viewport widths');
  assert.ok(triggerBlock.includes('height: 42px;'), 'chat dropdown trigger should keep the unified trigger height');
  assert.ok(triggerBlock.includes('border-radius: 14px;'), 'chat dropdown trigger should keep the unified trigger radius');
  assert.ok(css.includes('.custom-dropdown .dropdown-menu,\n.custom-dropdown-sm .dropdown-menu {\n  position: absolute;') || css.includes('.custom-dropdown .dropdown-menu,\r\n.custom-dropdown-sm .dropdown-menu {\r\n  position: absolute;'), 'dropdown menu base contract should exist');
  assert.ok(css.includes('  width: 100%;'), 'chat dropdown menu should match the trigger width');
  assert.ok(css.includes('  min-width: 100%;'), 'chat dropdown menu should not expand beyond the trigger by default');
  assert.ok(optionBlock.includes('min-height: 52px;'), 'chat dropdown option should keep the unified option height rhythm');
  assert.ok(optionBlock.includes('justify-items: start;'), 'dropdown option content should align to the left edge');
  assert.ok(optionBlock.includes('text-align: left;'), 'dropdown option text should stay left-aligned');
  assert.ok(getBlock(css, '.dropdown-option-label').includes('text-align: left;'), 'dropdown option labels should explicitly align left');
  assert.ok(getBlock(css, '.dropdown-option-meta').includes('justify-content: flex-start;'), 'dropdown option meta row should align badges from the left edge');
  assert.ok(getBlock(css, '.dropdown-option-series').includes('font-weight: 800;'), 'dropdown option series badge should stay visually distinct from capability tags');
  assert.ok(getBlock(css, '.dropdown-option-series.series-gpt5').includes('color: #b8f3ff;'), 'GPT-5.x series badge should expose a dedicated accent tone');
  assert.ok(getBlock(css, '.dropdown-option-tags').includes('justify-content: flex-start;'), 'dropdown option tags should start from the same left column');
  assert.ok(getBlock(css, '.dropdown-group-label').includes('text-align: left;'), 'dropdown group labels should align left with their options');
  assert.ok(mediumViewportBlock.includes('width: clamp(188px, 20vw, 236px);'), 'chat dropdown should shorten consistently on medium desktop widths');
  assert.ok(mediumViewportBlock.includes('max-width: min(100%, 236px);'), 'chat dropdown should cap width consistently on medium desktop widths');
  assert.ok(mobileBlock.includes('width: min(210px, calc(100vw - 44px));'), 'chat dropdown should adapt to narrow mobile viewports without overflow');
  assert.ok(mobileBlock.includes('max-width: calc(100vw - 44px);'), 'chat dropdown should follow mobile available width during zoom and resize');
  assert.ok(css.includes('[data-theme="light"] .custom-dropdown .dropdown-option.active') && css.includes('  color: #0f172a;'), 'light theme active option should keep readable foreground contrast');
  assert.ok(paperMenuBlock.includes('background:'), 'paper theme menu should override the dropdown surface');
  assert.ok(paperHintBlock.includes('color: rgba(83, 65, 34, 0.8);'), 'paper theme scroll hint should keep readable contrast');

  console.log('Chat model dropdown visual contract tests passed');
}

if (require.main === module) {
  main();
}

module.exports = {
  main
};

