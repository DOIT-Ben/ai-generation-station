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
  const shellBlock = getBlock(css, '.transcription-shell');
  const copyBlock = getBlock(css, '.transcription-shell-copy');
  const dropBlock = getBlock(css, '.transcription-drop-zone');
  const previewBlock = getBlock(css, '.transcription-upload-preview');
  const noteBlock = getBlock(css, '.transcription-shell-note');
  const resultBlock = getBlock(css, '.transcription-result-card');
  const textBlock = getBlock(css, '.transcription-text');
  const lightBlock = getBlock(css, '[data-theme="light"] .transcription-shell');
  const paperBlock = getBlock(css, '[data-theme="paper"] .transcription-shell');

  assert.ok(shellBlock.includes('--transcription-accent:'), 'transcription area should define a local accent token');
  assert.ok(shellBlock.includes('--transcription-panel:'), 'transcription area should define a shared panel token');
  assert.ok(shellBlock.includes('--transcription-border:'), 'transcription area should define a shared border token');

  [copyBlock, dropBlock, previewBlock, noteBlock, resultBlock].forEach((block, index) => {
    assert.ok(block.includes('var(--transcription-border)'), `transcription component ${index + 1} should use the shared border token`);
    assert.ok(block.includes('var(--transcription-panel)'), `transcription component ${index + 1} should use the shared panel token`);
  });

  assert.ok(textBlock.includes('var(--transcription-text-panel)'), 'transcription text should use the shared text panel token');
  assert.ok(lightBlock.includes('--transcription-text-panel:'), 'light theme should tune transcription text panel color');
  assert.ok(paperBlock.includes('--transcription-accent: #8f6a2a;'), 'paper theme should use a warm transcription accent');

  console.log('Transcription color consistency tests passed');
}

if (require.main === module) {
  main();
}

module.exports = { main };

