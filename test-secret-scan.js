const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = __dirname;
const SKIP_DIRS = new Set([
  '.git',
  '.claude',
  'node_modules',
  'output',
  'data',
  'resources',
  'test-artifacts',
  'exports'
]);
const SKIP_FILES = new Set([
  '.env',
  'backend/config.local.js'
]);
const SECRET_PATTERNS = [
  { name: 'OpenAI-style or MiniMax-style API key', regex: /sk-[A-Za-z0-9_-]{20,}/g },
  { name: 'GitHub personal access token', regex: /ghp_[A-Za-z0-9_]{20,}/g }
];

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(ROOT, fullPath).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) {
        walk(fullPath, files);
      }
      continue;
    }
    if (!entry.isFile()) continue;
    if (SKIP_FILES.has(relativePath) || SKIP_FILES.has(entry.name)) continue;
    files.push(fullPath);
  }
  return files;
}

function isLikelyText(buffer) {
  if (!buffer.length) return true;
  const sample = buffer.subarray(0, Math.min(buffer.length, 4096));
  return !sample.includes(0);
}

function main() {
  const findings = [];
  for (const file of walk(ROOT)) {
    const buffer = fs.readFileSync(file);
    if (!isLikelyText(buffer)) continue;
    const text = buffer.toString('utf8');
    const relativePath = path.relative(ROOT, file);
    for (const pattern of SECRET_PATTERNS) {
      for (const match of text.matchAll(pattern.regex)) {
        findings.push(`${relativePath}:${match.index}: ${pattern.name}`);
      }
    }
  }

  assert.strictEqual(
    findings.length,
    0,
    `Secret scan found possible committed secrets:\n${findings.join('\n')}`
  );
  console.log('Secret scan passed');
}

if (require.main === module) {
  main();
}

module.exports = { main };
