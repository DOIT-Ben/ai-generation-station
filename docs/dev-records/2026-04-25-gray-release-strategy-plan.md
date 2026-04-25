# 灰度发布策略修复记录

## 目标
修复审查报告中“缺少真实灰度开关、用户分组、回滚策略、监控指标和发布闸门”的问题，先建立项目内可执行的灰度策略文档，并纳入 CI 配置测试，避免继续只有口头流程。

## 范围
- 新增 `docs\dev-records\2026-04-25-gray-release-strategy.md` 灰度策略方案。
- 新增聚焦测试校验灰度方案关键要素。
- 将灰度方案测试加入 CI core gate。
- 不实现完整运行时 feature flag 服务、不接入监控平台、不做真实部署脚本。

## 假设
- 当前项目还没有部署平台和监控系统配置，先用可执行策略文档和 CI gate 固化流程。
- 后续实现真实 feature flag、用户分组和指标采集时，应以该策略为验收基线。
- 本轮是流程和测试基线，不改变业务运行逻辑。

## 风险
- 文档策略不能替代真实灰度系统，后续仍需运行时代码和平台支持。
- CI 只能防止策略缺失，不能证明生产灰度执行到位。

## TODO
1. 新增聚焦测试：验证灰度策略文档存在。
2. 新增聚焦测试：验证策略包含 feature flags、用户分组、监控指标、回滚、CI gate、验收流程。
3. 新增灰度策略方案文档。
4. 将灰度策略测试加入 `.github\workflows\ci.yml`。
5. 运行聚焦测试、CI gate 测试、语法检查。
6. 复盘新问题、边界条件、遗漏点，并回写本文件。
7. 提交本轮灰度策略修复。

## 完成标准
- 灰度策略方案落在 `docs\dev-records`。
- 测试能阻止关键灰度章节被删除。
- CI core gate 会运行灰度策略测试。
- 本轮验证命令通过。

## 验证方式
- `node test-gray-release-strategy.js`
- `node test-ci-gate.js`
- `npm run check`

## 执行记录
- 已完成根因调查：项目已有 CI core gate，但没有项目内灰度策略文档，也没有测试约束 feature flags、用户分组、监控指标和回滚策略。
- TODO 1-2 已新增聚焦测试：`test-gray-release-strategy.js` 校验灰度策略文档和关键章节。
- 预修复验证：`node test-gray-release-strategy.js` 失败，失败点为灰度策略文档不存在，符合预期。
- TODO 3 已完成：新增 `docs\dev-records\2026-04-25-gray-release-strategy.md`，覆盖 feature flags、用户分组、监控指标、回滚策略、CI gate 和灰度验收流程。
- TODO 4 已完成：`.github\workflows\ci.yml` 加入 `node test-gray-release-strategy.js`。

## 验证结果
- `node test-gray-release-strategy.js`：通过。
- `node test-ci-gate.js`：通过。
- `npm run check`：通过。

## 复盘
- TODO 1-2 复盘：测试先锁住灰度策略的最低内容要求；本轮不声称已有真实生产灰度系统，只建立可执行策略和 CI 防回归。
- TODO 3-6 复盘：本轮把灰度策略从口头建议变成项目内方案和 CI 契约。真实 feature flag 服务、指标采集和部署回滚仍需要后续结合部署平台实现。
