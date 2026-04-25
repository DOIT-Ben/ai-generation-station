const assert = require('assert');
const fs = require('fs');
const path = require('path');

function main() {
  const strategyPath = path.join(__dirname, 'docs', 'dev-records', '2026-04-25-gray-release-strategy.md');
  assert.ok(fs.existsSync(strategyPath), 'gray release strategy should exist in docs\\dev-records');

  const strategy = fs.readFileSync(strategyPath, 'utf8');
  [
    '## 目标',
    '## Feature Flags',
    '## 用户分组',
    '## 监控指标',
    '## 回滚策略',
    '## CI Gate',
    '## 灰度验收流程',
    '## 完成标准',
    'PUBLIC_REGISTRATION_ENABLED',
    'data-feature-state="experimental"',
    'npm run test:release-core'
  ].forEach(requiredText => {
    assert.ok(strategy.includes(requiredText), `gray release strategy should include: ${requiredText}`);
  });

  console.log('Gray release strategy tests passed');
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
