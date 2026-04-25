const assert = require('assert');
const fs = require('fs');
const path = require('path');

function main() {
  const html = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
  const appJs = fs.readFileSync(path.join(__dirname, 'public', 'js', 'app.js'), 'utf8');

  const navMatch = html.match(/<button class="nav-item" data-tab="transcription"[\s\S]*?<\/button>/);
  assert.ok(navMatch, 'transcription nav item should exist');
  const navHtml = navMatch[0];

  const sectionMatch = html.match(/<section id="tab-transcription"[\s\S]*?<\/section>/);
  assert.ok(sectionMatch, 'transcription section should exist');
  const sectionHtml = sectionMatch[0];

  assert.ok(navHtml.includes('data-feature-state="experimental"'), 'transcription nav should expose experimental state');
  assert.ok(navHtml.includes('nav-badge'), 'transcription nav should show a compact experimental badge');
  assert.ok(sectionHtml.includes('data-feature-state="experimental"'), 'transcription section should expose experimental state');
  assert.ok(sectionHtml.includes('实验'), 'transcription section should visibly communicate experimental status');

  assert.equal(sectionHtml.includes('开始提取'), false, 'transcription CTA should not imply real extraction');
  assert.equal(sectionHtml.includes('转写结果占位'), false, 'transcription result should not imply a real transcription result');
  assert.equal(appJs.includes('转写承接区已就绪'), false, 'transcription script should not render pseudo-ready transcription copy');
  assert.equal(appJs.includes('请先上传音频或视频文件'), false, 'experimental plan should not require upload before showing status');
  assert.ok(appJs.includes('renderTranscriptionExperimentalPlan'), 'transcription script should render an experimental plan');

  console.log('Transcription experimental gate tests passed');
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
